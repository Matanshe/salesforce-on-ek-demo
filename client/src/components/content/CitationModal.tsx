import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArticleView } from "./ArticleView";
import TOC from "@/components/TOC";
import type { ChunkRow } from "@/types/message";

export interface CitationModalHudmoData {
  attributes?: {
    content?: string;
    title?: string;
    metadata?: { sourceUrl?: string };
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
  /** When true, use transparent overlay (e.g. embed mode to avoid semi-transparent padding) */
  transparentOverlay?: boolean;
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
  transparentOverlay = false,
}: CitationModalProps) {
  const [expanded, setExpanded] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setExpanded(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={true}
        overlayClassName={transparentOverlay ? "!bg-transparent" : undefined}
        className={
          expanded && enableToc
            ? "sm:max-w-7xl w-[calc(100vw-2rem)] h-[85vh] flex flex-col p-0 gap-0"
            : "sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0"
        }
      >
        {expanded && hudmoData && enableToc ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-row w-full">
            <div className="w-[260px] shrink-0 min-h-0 flex flex-col border-r border-gray-200 overflow-hidden">
              <TOC
                tocUrl={tocUrl}
                currentContentId={currentContentId ?? null}
                isVisible={true}
                embedded={true}
                onContentClick={onTocContentClick}
              />
            </div>
            <div className="flex-1 min-w-[320px] min-h-0 overflow-hidden flex flex-col">
              <ArticleView
                data={hudmoData}
                chunkRows={chunkRows}
                onClose={() => setExpanded(false)}
                customerId={customerId}
                contentId={currentContentId ?? undefined}
              />
            </div>
          </div>
        ) : hudmoData ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ArticleView
              data={hudmoData}
              chunkRows={chunkRows}
              onClose={onClose}
              customerId={customerId}
              contentId={currentContentId ?? undefined}
            />
            {enableToc && (
              <div className="shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Hover for chunk preview · Click for full article · Expand for TOC
                </p>
                <Button
                  className="bg-[#0176D3] hover:bg-[#014486] shrink-0"
                  onClick={() => setExpanded(true)}
                >
                  Show table of contents
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
