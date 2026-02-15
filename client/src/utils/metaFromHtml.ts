/**
 * Extracts name/property and content from a meta tag attribute string.
 */
function getMetaAttr(attrs: string, attrName: string): string | undefined {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(["'])([^"']*)\\1`, "i");
  const m = attrs.match(re);
  return m ? m[2].trim() : undefined;
}

/**
 * Parses <meta> tags from HTML (e.g. get-hudmo response attributes.content)
 * and returns the description from meta name="description" or property="og:description".
 */
export function getDescriptionFromHtmlContent(html: string): string | null {
  if (typeof html !== "string" || !html.trim()) return null;
  const metaRegex = /<meta\s+([^>]*?)\s*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const content = getMetaAttr(attrs, "content");
    if (!content) continue;
    const name = getMetaAttr(attrs, "name");
    const property = getMetaAttr(attrs, "property");
    const key = (property ?? name ?? "").trim();
    if (key === "og:description" || key === "description") return content.trim() || null;
  }
  return null;
}
