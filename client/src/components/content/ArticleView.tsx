import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ParsedMetaTag {
  name?: string;
  property?: string;
  content: string;
}

/**
 * Extracts name/property and content from a meta tag attribute string.
 * Handles both double- and single-quoted values; value can contain the other quote.
 */
function getMetaAttr(attrs: string, attrName: string): string | undefined {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(["'])([^"']*)\\1`, "i");
  const m = attrs.match(re);
  return m ? m[2].trim() : undefined;
}

/**
 * Parses <meta> tags from the HTML string (get-hudmo response attributes.content).
 * Uses regex so full documents with <head><meta .../></head> are reliably parsed.
 */
function parseMetaTagsFromHtml(html: string): ParsedMetaTag[] {
  if (typeof html !== "string" || !html.trim()) return [];

  const result: ParsedMetaTag[] = [];
  // Match <meta ...> or <meta .../> anywhere in the string (handles full HTML like your sample)
  const metaRegex = /<meta\s+([^>]*?)\s*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const content = getMetaAttr(attrs, "content");
    if (!content) continue;
    const name = getMetaAttr(attrs, "name");
    const property = getMetaAttr(attrs, "property");
    if (name || property) result.push({ name, property, content });
  }
  return result;
}

/** Get nested value by path (e.g. "DC.Language" or "data.ReleaseName") */
function getMetaValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const METADATA_FIELDS: { path: string; title: string }[] = [
  { path: "DC.Language", title: "Language" },
  { path: "sfdcProducts", title: "Products" },
  { path: "DC.Type", title: "Type" },
  { path: "data.ReleaseName", title: "Release" },
  { path: "updatedAt", title: "Last updated" },
  { path: "abstract", title: "Abstract" },
  { path: "description", title: "Description" },
];

/** Format a single metadata value for display (safe for circular refs) */
function formatMetaValue(value: unknown, path: string): string {
  if (value == null) return "";
  if (path === "updatedAt" && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  if (path === "updatedAt" && typeof value === "object" && value !== null && "toISOString" in (value as Date)) {
    return (value as Date).toLocaleString();
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : String(v))).join(", ");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Build display entries from both attributes.metadata and HTML meta tags.
 * For each field we check API metadata first, then meta tags (name or property matching path).
 */
function buildDisplayEntries(
  metadata: Record<string, unknown> | undefined,
  metaTags: ParsedMetaTag[]
): { title: string; value: string; isLongText?: boolean }[] {
  const metaByKey = new Map<string, string>();
  for (const m of metaTags) {
    const key = m.property ?? m.name;
    if (key && m.content) metaByKey.set(key, m.content);
  }

  const safeMeta = metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : undefined;

  const entries: { title: string; value: string; isLongText?: boolean }[] = [];
  for (const { path, title } of METADATA_FIELDS) {
    let raw: unknown;
    if (safeMeta) {
      // Try nested path (e.g. metadata.DC.Language) then flat key (e.g. metadata["DC.Language"])
      raw = path.includes(".") ? getMetaValue(safeMeta, path) : safeMeta[path];
      if ((raw == null || raw === "") && path.includes(".")) {
        raw = safeMeta[path];
      }
    }
    if ((raw == null || raw === "") && metaByKey.has(path)) {
      raw = metaByKey.get(path);
    }
    // Also check common meta names used in HTML
    if ((raw == null || raw === "") && path === "description") {
      raw = metaByKey.get("og:description") ?? metaByKey.get("description");
    }
    if ((raw == null || raw === "") && path === "abstract") {
      raw = metaByKey.get("abstract");
    }
    if ((raw == null || raw === "") && path === "data.ReleaseName") {
      raw = metaByKey.get("releaseName") ?? metaByKey.get("ReleaseName");
    }
    if (raw == null || raw === "") continue;
    const value = formatMetaValue(raw, path);
    if (!value) continue;
    entries.push({
      title,
      value,
      isLongText: path === "abstract" || path === "description",
    });
  }
  return entries;
}

interface QaItem {
  question?: string;
  answer?: string;
}

interface ArticleViewProps {
  data: {
    attributes?: {
      content?: string;
      title?: string;
      metadata?: Record<string, unknown>;
      summary?: string;
      qa?: QaItem[];
    };
  } | null;
  onClose: () => void;
}

export const ArticleView = ({ data, onClose }: ArticleViewProps) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [qaExpanded, setQaExpanded] = useState(false);

  const summary = data?.attributes?.summary;
  const qa = data?.attributes?.qa;
  const hasSummary = typeof summary === "string" && summary.trim() !== "";
  const hasQa = Array.isArray(qa) && qa.length > 0;

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = e.target instanceof HTMLElement ? e.target.closest("a[data-dccid]") : null;
    if (anchor instanceof HTMLAnchorElement) {
      const dccid = anchor.getAttribute("data-dccid");
      if (dccid) {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/article/${encodeURIComponent(dccid)}`);
      }
    }
  };

  // Meta tags parsed from the get-hudmo response HTML (data.attributes.content)
  const metaTags = useMemo(() => {
    const content = data?.attributes?.content;
    return typeof content === "string" ? parseMetaTagsFromHtml(content) : [];
  }, [data?.attributes?.content]);

  // Merge attributes.metadata + HTML meta tags into display entries (only relevant fields)
  const metadataEntries = useMemo(
    () => buildDisplayEntries(data?.attributes?.metadata, metaTags),
    [data?.attributes?.metadata, metaTags]
  );

  const metaFields = metadataEntries.filter((e) => !e.isLongText);
  const abstractEntry = metadataEntries.find((e) => e.title === "Abstract");
  const descriptionEntry = metadataEntries.find((e) => e.title === "Description");

  const hasMeta = metadataEntries.length > 0;

  useEffect(() => {
    if (data?.attributes) {
      console.log("Article attributes.metadata (API):", data.attributes.metadata);
      const metaKeys = metaTags.map((m) => m.property ?? m.name).filter(Boolean);
      if (metaKeys.length > 0) console.log("HTML meta name/property keys:", metaKeys);
    }
    if (metadataEntries.length > 0) console.log("Metadata (merged):", metadataEntries);
  }, [data?.attributes?.metadata, metaTags, metadataEntries]);

  // Scroll to top when content changes
  useEffect(() => {
    if (data && scrollContainerRef.current) {
      const scrollArea = scrollContainerRef.current.closest('[data-slot="scroll-area"]');
      const viewport = scrollArea?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [data?.attributes?.content, data?.attributes?.title]);

  if (!data) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-row items-center justify-between shrink-0 bg-white">
        <div className="flex-1 min-w-0 pr-2">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
            {data.attributes?.title || "Article"}
          </h1>
        </div>
        <Button onClick={onClose} variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-10 sm:w-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 sm:h-5 sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollContainerRef} className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {/* AI-generated document summary (above description), Salesforce blue highlight */}
          {hasSummary && (
            <div className="mb-4 p-3 sm:p-4 rounded-lg bg-[#0176D3]/10 border border-[#0176D3]/30">
              <h2 className="text-sm font-semibold text-[#0176D3] mb-2">AI-generated document summary</h2>
              <p className="text-sm text-[#014486] leading-relaxed whitespace-pre-wrap break-words">
                {summary}
              </p>
            </div>
          )}

          {hasMeta && (
            <div className="mb-4 space-y-4">
              {/* Detail fields: small chips in one row, blue styling */}
              {metaFields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {metaFields.map(({ title, value }) => (
                    <span
                      key={title}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#0176D3]/10 text-[#0176D3] border border-[#0176D3]/30"
                    >
                      <span className="text-[#0176D3]/80">{title}:</span>
                      <span className="text-gray-800">{value}</span>
                    </span>
                  ))}
                </div>
              )}
              {/* Abstract: only when there is no description */}
              {abstractEntry && !descriptionEntry && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Abstract</h2>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                    {abstractEntry.value}
                  </p>
                </div>
              )}
              {/* Description: show when present (hides abstract when both exist) */}
              {descriptionEntry && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                    {descriptionEntry.value}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Q&A expand/collapse */}
          {hasQa && (
            <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setQaExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
                aria-expanded={qaExpanded}
              >
                <span className="text-sm font-semibold text-gray-700">Q&A</span>
                <svg
                  className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${qaExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {qaExpanded && (
                <div className="border-t border-gray-200 bg-white">
                  <div className="p-3 sm:p-4 space-y-4">
                    {qa!.map((qaItem, index) => (
                      <div key={index} className="rounded-lg p-3 bg-gray-50 border border-gray-200">
                        {qaItem?.question != null && String(qaItem.question).trim() !== "" && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Q:</p>
                            <p className="text-sm text-gray-800 wrap-break-word break-words whitespace-pre-wrap">
                              {String(qaItem.question)}
                            </p>
                          </div>
                        )}
                        {qaItem?.answer != null && String(qaItem.answer).trim() !== "" && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">A:</p>
                            <p className="text-sm text-gray-600 wrap-break-word break-words whitespace-pre-wrap">
                              {String(qaItem.answer)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {data.attributes?.content ? (
            <div
              role="article"
              onClick={handleContentClick}
              className="content-prose pb-6 sm:pb-8"
              dangerouslySetInnerHTML={{ __html: data.attributes.content }}
            />
          ) : (
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto border border-gray-700">
              <pre className="text-sm text-green-400 font-mono">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

