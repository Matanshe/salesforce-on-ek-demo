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
  children,
}: {
  customerId: string | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeConfig | null>(() =>
    customerId ? getDefaultTheme(customerId) : null
  );

  const loadTheme = useCallback(async (id: string) => {
    const defaultForCustomer = () => getDefaultTheme(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/customers/${id}`);
      if (!res.ok) return setTheme(defaultForCustomer()), applyThemeToDocument(defaultForCustomer());
      const data = await res.json();
      const ui = data.customer?.ui;
      if (ui?.colors && ui?.labels) {
        const merged: ThemeConfig = {
          colors: { ...defaultForCustomer().colors, ...ui.colors },
          labels: { ...defaultForCustomer().labels, ...ui.labels },
          homeUrl: ui.homeUrl ?? defaultForCustomer().homeUrl,
          logoUrl: ui.logoUrl ?? null,
          footerLinks: Array.isArray(ui.footerLinks) ? ui.footerLinks : defaultForCustomer().footerLinks,
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
      loadTheme(customerId);
    } else {
      setTheme(null);
    }
  }, [customerId, loadTheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(customerId?: string | null): ThemeConfig {
  const theme = useContext(ThemeContext);
  return theme ?? getDefaultTheme(customerId);
}