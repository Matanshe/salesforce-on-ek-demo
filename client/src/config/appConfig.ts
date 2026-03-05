/**
 * App config: citation behavior and embed layout.
 * Read from env (build-time) with optional URL override so the same build
 * can be used in full-page and embedded (static site) contexts.
 */

export type CitationBehavior = "fullPage" | "modal";

function parseCitationBehavior(value: string | undefined): CitationBehavior {
  const v = (value ?? "").toLowerCase();
  if (v === "modal") return "modal";
  return "fullPage";
}

function parseEmbedLayout(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseFeatureFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  const v = value.toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return defaultValue;
}

export interface EmbedFeatures {
  hover: boolean;
  preview: boolean;
  toc: boolean;
}

export interface EmbedConfig {
  embedLayout: boolean;
  citationBehavior: CitationBehavior;
  embedFeatures: EmbedFeatures;
}

const defaultOn = true;
const envFeatures: EmbedFeatures = {
  hover: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_HOVER, defaultOn),
  preview: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_PREVIEW, defaultOn),
  toc: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_TOC, defaultOn),
};

/** Derive embed config from current URL params (e.g. after client-side nav to /proofpoint?embed=1). */
export function getEmbedConfigFromParams(params: URLSearchParams): EmbedConfig {
  const embedLayout =
    params.get("embed") === "1" || params.get("embed") === "true";
  const citationBehavior = embedLayout
    ? parseCitationBehavior(params.get("citation") ?? "modal")
    : parseCitationBehavior(import.meta.env.VITE_CITATION_BEHAVIOR);
  const embedFeatures: EmbedFeatures = {
    hover: parseFeatureFlag(params.get("hover") ?? undefined, envFeatures.hover),
    preview: parseFeatureFlag(params.get("preview") ?? undefined, envFeatures.preview),
    toc: parseFeatureFlag(params.get("toc") ?? undefined, envFeatures.toc),
  };
  return { embedLayout, citationBehavior, embedFeatures };
}

/**
 * Citation behavior: fullPage = navigate to article; modal = open citation in modal.
 */
export const citationBehavior: CitationBehavior = (() => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const embed = params.get("embed");
    const citation = params.get("citation");
    if (embed === "1" || embed === "true") return parseCitationBehavior(citation ?? "modal");
    if (citation === "modal" || citation === "fullPage") return parseCitationBehavior(citation);
  }
  return parseCitationBehavior(import.meta.env.VITE_CITATION_BEHAVIOR);
})();

/**
 * Embed layout: when true, only show chat widget (e.g. fixed right), no main app chrome.
 */
export const embedLayout: boolean = (() => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "1" || params.get("embed") === "true") return true;
  }
  return parseEmbedLayout(import.meta.env.VITE_EMBED_LAYOUT);
})();

/**
 * Embed content features: hover card, preview modal, TOC in modal.
 * Only relevant when embedLayout is true; read from URL params (hover, preview, toc) or env.
 */
export const embedFeatures: EmbedFeatures = (() => {
  const defaultOn = true;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return {
      hover: parseFeatureFlag(
        params.get("hover") ?? undefined,
        parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_HOVER, defaultOn)
      ),
      preview: parseFeatureFlag(
        params.get("preview") ?? undefined,
        parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_PREVIEW, defaultOn)
      ),
      toc: parseFeatureFlag(
        params.get("toc") ?? undefined,
        parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_TOC, defaultOn)
      ),
    };
  }
  return {
    hover: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_HOVER, defaultOn),
    preview: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_PREVIEW, defaultOn),
    toc: parseFeatureFlag(import.meta.env.VITE_EMBED_FEATURE_TOC, defaultOn),
  };
})();
