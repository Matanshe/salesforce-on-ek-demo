import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArticleView } from "./ArticleView";
import TOC from "@/components/TOC";
import type { ChunkRow } from "@/types/message";

export interface CitationModalHudmoData {
  attributes?: {
    content?: string;
    title?: string;
    metadata?: { sourceUrl?: string; contentType?: string };
    qa?: Array<{ question?: string; answer?: string }>;
    summary?: string;
  };
}

interface CitationModalProps {
  open: boolean;
  onClose: () => void;
  hudmoData: CitationModalHudmoData | null;
  chunkRows: ChunkRow[];
  articleTitle?: string | null;
  /** Current article contentId (for TOC highlight and related DMO lookup) */
  currentContentId?: string | null;
  /** Customer id (e.g. proofpoint, salesforce) so ArticleView can fetch product/relationship DMO */
  customerId?: string | null;
  /** When user clicks another TOC item in expanded view, load that article */
  onTocContentClick?: (contentId: string) => void;
  /** When false, hide "Show table of contents" and TOC sidebar in expanded view */
  enableToc?: boolean;
  /** TOC XML URL for the current customer (e.g. Proofpoint vs Salesforce). When missing, TOC uses default. */
  tocUrl?: string | null;
  /** Multiple TOC URLs. When provided, the TOC that contains the current article is shown. */
  tocUrls?: string[] | null;
  /** When true, use transparent overlay (e.g. embed mode to avoid semi-transparent padding) */
  transparentOverlay?: boolean;
  /** When true, the article is still being fetched: show a loader instead of empty content. */
  loading?: boolean;
  /** Accent color for the loader spinner (defaults to Salesforce blue). */
  accentColor?: string;
}

export function CitationModal({
  open,
  onClose,
  hudmoData,
  chunkRows,
  currentContentId,
  customerId,
  onTocContentClick,
  enableToc = true,
  tocUrl,
  tocUrls,
  transparentOverlay = false,
  loading = false,
  accentColor = "#0176D3",
}: CitationModalProps) {
  // ToC is open by default; user can collapse it. Hidden entirely when the ToC has no usable data.
  const [tocOpen, setTocOpen] = useState(true);
  const [tocHasData, setTocHasData] = useState(false);
  const isImage = typeof hudmoData?.attributes?.metadata?.contentType === "string" &&
    hudmoData.attributes.metadata.contentType.startsWith("image/");
  // Only mount/consider the ToC for non-image articles when enabled.
  const tocEligible = enableToc && !isImage;
  const showToc = tocEligible && tocHasData;

  // Default the ToC to open when the modal opens. Not tied to currentContentId, so switching
  // articles via the ToC keeps the user's expand/collapse choice (and the ToC stays in place).
  useEffect(() => {
    if (open) setTocOpen(true);
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  // Widen the dialog only once we know the ToC has data (so no-ToC articles stay compact/centered).
  // The ToC itself always mounts when eligible (in a 0-width box) so it can report data presence.
  const wide = showToc;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={true}
        overlayClassName={transparentOverlay ? "!bg-transparent" : undefined}
        className={
          wide
            ? "sm:max-w-7xl w-[calc(100vw-2rem)] h-[85vh] flex flex-col p-0 gap-0"
            : "sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0"
        }
      >
        {loading || hudmoData ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-row w-full">
            {/* ToC sidebar: open by default, smooth width collapse, removed from DOM only when no data.
                Always mounted (hidden via width) when eligible so onDataLoaded can report data presence.
                Kept mounted across article switches (including while the next article loads) so it never
                remounts/refetches or flickers. The collapse control lives INSIDE the ToC header
                (onCollapse); a slim rail with an expand button takes its place when collapsed. */}
            {tocEligible && (
              <div
                className="relative shrink-0 min-h-0 overflow-hidden transition-[width] duration-300 ease-in-out"
                style={{ width: showToc && tocOpen ? 260 : 0 }}
              >
                <div className="w-[260px] h-full min-h-0 flex flex-col border-r border-gray-200 overflow-hidden">
                  <TOC
                    tocUrl={tocUrl}
                    tocUrls={tocUrls}
                    currentContentId={currentContentId ?? null}
                    isVisible={true}
                    embedded={true}
                    onContentClick={onTocContentClick}
                    onDataLoaded={setTocHasData}
                    onCollapse={() => setTocOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Collapsed rail: slim strip with an expand button, sitting where the ToC was. */}
            {showToc && !tocOpen && (
              <div className="shrink-0 w-11 min-h-0 flex flex-col items-center border-r border-gray-200 bg-[#f3f2f2] py-3">
                <button
                  type="button"
                  onClick={() => setTocOpen(true)}
                  title="Show contents"
                  aria-label="Show table of contents"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
                <span
                  className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 select-none"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Contents
                </span>
              </div>
            )}

            {/* Content area: only this swaps between loader and article, so the ToC stays put. */}
            <div className="relative flex-1 min-w-[320px] min-h-0 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 py-16">
                  <div
                    className="w-10 h-10 rounded-full border-[3px] border-gray-200 animate-spin"
                    style={{ borderTopColor: accentColor }}
                  />
                  <p className="text-sm font-medium text-gray-500">Loading article…</p>
                </div>
              ) : hudmoData ? (
                <ArticleView
                  data={hudmoData}
                  chunkRows={chunkRows}
                  onClose={onClose}
                  customerId={customerId}
                  contentId={currentContentId ?? undefined}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
