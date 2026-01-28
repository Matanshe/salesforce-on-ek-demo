import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ArticleViewProps {
  data: {
    attributes?: {
      content?: string;
      title?: string;
      metadata?: {
        sourceUrl?: string;
      };
    };
  } | null;
  onClose: () => void;
}

export const ArticleView = ({ data, onClose }: ArticleViewProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when content changes
  useEffect(() => {
    if (data && scrollContainerRef.current) {
      // Find the ScrollArea viewport element
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
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2">
          <div className="bg-[#0176D3] rounded-lg p-1.5 sm:p-2 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
              {data.attributes?.title || "Article"}
            </h1>
          </div>
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
          {data.attributes?.content ? (
            <div
              className="prose prose-sm sm:prose-base md:prose-lg max-w-none text-left prose-headings:font-bold prose-headings:text-gray-900 prose-h1:text-xl sm:prose-h1:text-2xl md:prose-h1:text-3xl prose-h2:text-lg sm:prose-h2:text-xl md:prose-h2:text-2xl prose-h3:text-base sm:prose-h3:text-lg md:prose-h3:text-xl prose-h4:text-sm sm:prose-h4:text-base md:prose-h4:text-lg prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-sm sm:prose-p:text-base prose-a:text-[#0176D3] prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:my-3 sm:prose-ul:my-4 prose-ul:list-disc prose-ul:pl-4 sm:prose-ul:pl-6 prose-ol:my-3 sm:prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-4 sm:prose-ol:pl-6 prose-li:text-gray-700 prose-li:my-1 sm:prose-li:my-2 prose-li:marker:text-gray-500 prose-li:text-sm sm:prose-li:text-base [&_ul]:my-3 sm:[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-4 sm:[&_ul]:pl-6 [&_ol]:my-3 sm:[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-4 sm:[&_ol]:pl-6 [&_li]:text-gray-700 [&_li]:my-1 sm:[&_li]:my-2 [&_li]:ml-0 [&_li]:text-sm sm:[&_li]:text-base pb-4 sm:pb-6"
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

