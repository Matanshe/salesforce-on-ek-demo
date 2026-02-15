import { useState } from "react";
import type { CitationHoverCardData } from "@/types/message";

interface CitationHoverCardProps {
  data: CitationHoverCardData | null;
  isLoading?: boolean;
  onPreview: () => void;
  /** "slot" = rendered in fixed slot above input (block, max-height, no absolute). "inline" = above citation. */
  position?: "slot" | "inline";
  className?: string;
}

/** Small star icon for AI Summary section (purple) */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 0l1.5 4.5L13 5l-4 3.5L10 14L7 11.5 4 14l1-5.5L1 5l4.5-.5L7 0z" />
    </svg>
  );
}

/** External link icon */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function CitationHoverCard({
  data,
  isLoading,
  onPreview,
  position = "inline",
  className = "",
}: CitationHoverCardProps) {
  const [copied, setCopied] = useState(false);
  const isSlot = position === "slot";

  const handleCopy = () => {
    const text = (data?.summary ?? data?.chunkPreview ?? "").trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sourceLabel = data?.originalContentType ?? data?.source ?? "Document";
  const title = data?.title?.trim() ?? "";
  const sourceUrl = data?.sourceUrl?.trim() ?? "";
  const summary = data?.summary?.trim() ?? "";
  const lastUpdated = data?.lastUpdated ?? "";
  const originalFormat = data?.originalFormat ?? "";
  const hasCopyText = (data?.summary ?? data?.chunkPreview ?? "").trim().length > 0;

  return (
    <div
      className={
        isSlot
          ? `rounded-xl border border-gray-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden w-full max-w-[min(100%,420px)] max-h-[min(65vh,380px)] flex flex-col z-[9999] ${className}`
          : `absolute bottom-full right-0 mb-1 z-[100] w-[min(100%,360px)] rounded-xl border border-gray-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden ${className}`
      }
      role="dialog"
      aria-label="Source preview"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`p-4 ${isSlot ? "overflow-y-auto flex-1 min-h-0" : ""}`}>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <div className="w-4 h-4 border-2 border-[#0176D3] border-t-transparent rounded-full animate-spin" />
            <span>Loading source…</span>
          </div>
        ) : (
          <>
            {/* Source / Original content type */}
            <p className="text-xs text-gray-500 mb-1">{sourceLabel}</p>

            {/* Title + link to original source */}
            <div className="flex items-start gap-1.5 mb-3">
              {title ? (
                <a
                  href={sourceUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0176D3] font-semibold text-sm leading-snug hover:underline break-words flex-1 min-w-0"
                  onClick={(e) => sourceUrl && e.stopPropagation()}
                >
                  {title}
                </a>
              ) : (
                <span className="text-gray-700 font-medium text-sm">Untitled</span>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[#0176D3] hover:text-[#014486] p-0.5"
                  aria-label="Open original source"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* AI Summary */}
            {summary && (
              <div className="mb-3 min-h-[4.5rem]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                  <StarIcon className="w-3.5 h-3.5 text-purple-500" />
                  <span>AI Summary</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-8">{summary}</p>
              </div>
            )}

            {/* Last Updated & Original Format */}
            <div className="space-y-0.5 text-xs text-gray-500 mb-4">
              {lastUpdated && (
                <p>
                  <span className="font-medium text-gray-600">Last Updated</span> {lastUpdated}
                </p>
              )}
              {originalFormat && (
                <p>
                  <span className="font-medium text-gray-600">Original Format</span> {originalFormat}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!hasCopyText}
                className="text-sm font-medium text-[#0176D3] hover:text-[#014486] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPreview();
                }}
                className="text-sm font-medium text-[#0176D3] hover:text-[#014486] cursor-pointer"
              >
                Preview
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
