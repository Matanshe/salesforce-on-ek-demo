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
  /** Current article contentId (for TOC highlight in expanded view) */
  currentContentId?: string | null;
  /** When user clicks another TOC item in expanded view, load that article */
  onTocContentClick?: (contentId: string) => void;
}

export function CitationModal({
  open,
  onClose,
  hudmoData,
  chunkRows,
  currentContentId,
  onTocContentClick,
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
        className={
          expanded
            ? "sm:max-w-5xl h-[85vh] flex flex-col p-0 gap-0"
            : "sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0"
        }
      >
        {expanded && hudmoData ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-row">
            <div className="w-64 shrink-0 min-h-0 flex flex-col border-r border-gray-200">
              <TOC
                currentContentId={currentContentId ?? null}
                isVisible={true}
                embedded={true}
                onContentClick={onTocContentClick}
              />
            </div>
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
              <ArticleView
                data={hudmoData}
                chunkRows={chunkRows}
                onClose={() => setExpanded(false)}
              />
            </div>
          </div>
        ) : hudmoData ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ArticleView
              data={hudmoData}
              chunkRows={chunkRows}
              onClose={onClose}
            />
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
