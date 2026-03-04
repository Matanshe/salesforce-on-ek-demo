import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ThemeConfig } from "../types/theme";
import { getDefaultTheme } from "../types/theme";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type ThemeContextValue = ThemeConfig | null;

const ThemeContext = createContext<ThemeContextValue>(null);

const CSS_VAR_NAMES = {
  primary: "--theme-primary",
  primaryHover: "--theme-primary-hover",
  accent: "--theme-accent",
} as const;

function applyThemeToDocument(theme: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty(CSS_VAR_NAMES.primary, theme.colors.primary);
  root.style.setProperty(CSS_VAR_NAMES.primaryHover, theme.colors.primaryHover);
  root.style.setProperty(CSS_VAR_NAMES.accent, theme.colors.accent);
}

export function ThemeProvider({
  customerId,
  embedLayout = false,
  children,
}: {
  customerId: string | null;
  embedLayout?: boolean;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeConfig | null>(null);

  const loadTheme = useCallback(async (id: string, useEmbedTheme: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/customers/${id}`);
      if (!res.ok) return setTheme(getDefaultTheme());
      const data = await res.json();
      const ui = data.customer?.ui;
      const embedUi = data.customer?.embedUi;
      const source = useEmbedTheme && embedUi?.colors && embedUi?.labels ? embedUi : ui;
      if (source?.colors && source?.labels) {
        const merged: ThemeConfig = {
          colors: { ...getDefaultTheme().colors, ...source.colors },
          labels: { ...getDefaultTheme().labels, ...source.labels },
          homeUrl: source.homeUrl ?? getDefaultTheme().homeUrl,
          logoUrl: source.logoUrl ?? null,
          footerLinks: Array.isArray(source.footerLinks) ? source.footerLinks : getDefaultTheme().footerLinks,
        };
        setTheme(merged);
        applyThemeToDocument(merged);
      } else {
        const defaultTheme = getDefaultTheme();
        setTheme(defaultTheme);
        applyThemeToDocument(defaultTheme);
      }
    } catch {
      const defaultTheme = getDefaultTheme();
      setTheme(defaultTheme);
      applyThemeToDocument(defaultTheme);
    }
  }, []);

  useEffect(() => {
    if (customerId) {
      loadTheme(customerId, embedLayout);
    } else {
      setTheme(null);
    }
  }, [customerId, embedLayout, loadTheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeConfig {
  const theme = useContext(ThemeContext);
  return theme ?? getDefaultTheme();
}