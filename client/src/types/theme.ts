export interface ThemeColors {
  primary: string;
  primaryHover: string;
  accent: string;
}

export interface ThemeLabels {
  siteName: string;
  helpLabel: string;
  welcomeBadge: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  chatHeaderTitle: string;
  chatPlaceholder: string;
  backToHelp: string;
  openInHelp: string;
  footerCopyright: string;
}

export interface ThemeFooterLink {
  label: string;
  href: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  labels: ThemeLabels;
  homeUrl: string;
  logoUrl: string | null;
  footerLinks: ThemeFooterLink[];
}

const SALESFORCE_DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: "#0176D3",
    primaryHover: "#014486",
    accent: "#2E844A",
  },
  labels: {
    siteName: "Salesforce",
    helpLabel: "Help",
    welcomeBadge: "Salesforce Help Portal",
    welcomeTitle: "Welcome to Salesforce Help",
    welcomeSubtitle: "Salesforce Help on Enterprise Knowledge demo site",
    chatHeaderTitle: "Agentforce on EK",
    chatPlaceholder: "Ask any question about Salesforce products and features.",
    backToHelp: "← Back to Help",
    openInHelp: "Open in Help",
    footerCopyright: "© {year} salesforce.com, inc. All rights reserved. Various trademarks held by their respective owners.",
  },
  homeUrl: "https://www.salesforce.com",
  logoUrl: null,
  footerLinks: [
    { label: "Salesforce.com", href: "https://www.salesforce.com" },
    { label: "Help & Training", href: "https://help.salesforce.com" },
    { label: "Trailhead", href: "https://trailhead.salesforce.com" },
    { label: "Developer Center", href: "https://developer.salesforce.com" },
  ],
};

const PROOFPOINT_DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: "#C41E3A",
    primaryHover: "#9e1830",
    accent: "#333333",
  },
  labels: {
    siteName: "Proofpoint",
    helpLabel: "Help",
    welcomeBadge: "Proofpoint Help Portal",
    welcomeTitle: "Welcome to Proofpoint Help",
    welcomeSubtitle: "Proofpoint Help on Enterprise Knowledge demo site",
    chatHeaderTitle: "Agentforce on EK",
    chatPlaceholder: "Ask a question.",
    backToHelp: "← Back to Help",
    openInHelp: "Open in Help",
    footerCopyright: "© Proofpoint.",
  },
  homeUrl: "https://www.proofpoint.com",
  logoUrl: null,
  footerLinks: [{ label: "Proofpoint.com", href: "https://www.proofpoint.com" }],
};

/** Returns customer-specific default when known, so fallback never shows wrong brand (e.g. Proofpoint never shows "Salesforce"). */
export function getDefaultTheme(customerId?: string | null): ThemeConfig {
  if (customerId === "proofpoint") return PROOFPOINT_DEFAULT_THEME;
  return SALESFORCE_DEFAULT_THEME;
}

export function formatFooterCopyright(template: string): string {
  return template.replace("{year}", String(new Date().getFullYear()));
}
