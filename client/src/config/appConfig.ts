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
