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
  const [theme, setTheme] = useState<ThemeConfig | null>(() =>
    customerId ? getDefaultTheme(customerId) : null
  );

  const loadTheme = useCallback(async (id: string, useEmbedTheme: boolean) => {
    const defaultForCustomer = () => getDefaultTheme(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/customers/${id}`);
      if (!res.ok) {
        const theme = defaultForCustomer();
        setTheme(theme);
        applyThemeToDocument(theme);
        return;
      }
      const data = await res.json();
      const ui = data.customer?.ui;
      const embedUi = data.customer?.embedUi;
      const source = useEmbedTheme && embedUi?.colors && embedUi?.labels ? embedUi : ui;
      if (source?.colors && source?.labels) {
        const merged: ThemeConfig = {
          colors: { ...defaultForCustomer().colors, ...source.colors },
          labels: { ...defaultForCustomer().labels, ...source.labels },
          homeUrl: source.homeUrl ?? defaultForCustomer().homeUrl,
          logoUrl: source.logoUrl ?? null,
          footerLinks: Array.isArray(source.footerLinks) ? source.footerLinks : defaultForCustomer().footerLinks,
        };
        setTheme(merged);
        applyThemeToDocument(merged);
      } else {
        const theme = defaultForCustomer();
        setTheme(theme);
        applyThemeToDocument(theme);
      }
    } catch {
      const theme = defaultForCustomer();
      setTheme(theme);
      applyThemeToDocument(theme);
    }
  }, []);

  useEffect(() => {
    if (customerId) {
      setTheme(getDefaultTheme(customerId));
      applyThemeToDocument(getDefaultTheme(customerId));
      loadTheme(customerId, embedLayout);
    } else {
      setTheme(null);
    }
  }, [customerId, embedLayout, loadTheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(customerId?: string | null): ThemeConfig {
  const theme = useContext(ThemeContext);
  return theme ?? getDefaultTheme(customerId);
}