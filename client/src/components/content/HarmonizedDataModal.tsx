import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HarmonizedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    attributes?: {
      content?: string;
      title?: string;
      metadata?: {
        sourceUrl?: string;
      };
    };
  } | null;
}

export const HarmonizedDataModal = ({ isOpen, onClose, data }: HarmonizedDataModalProps) => {
  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl! w-full h-dvh sm:h-[90vh] flex flex-col p-0 gap-0 sm:rounded-lg">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center space-y-0 gap-3 shrink-0">
          <div className="bg-linear-to-r from-teal-500 to-cyan-600 rounded-lg p-2 shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex-1 flex flex-col items-center px-4">
            <DialogTitle className="text-xl font-bold text-gray-900 mb-1">
              {data.attributes?.title || "Harmonized Content"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View harmonized data content from Salesforce Data Cloud
            </DialogDescription>
            {data.attributes?.metadata?.sourceUrl && (
              <a
                href={data.attributes.metadata.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                View Source
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-6 min-h-full">
            {data.attributes?.content ? (
              <div
                className="prose prose-lg max-w-none text-left prose-headings:font-bold prose-headings:text-gray-900 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-li:text-gray-700 prose-li:my-2 prose-li:marker:text-gray-500 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:text-gray-700 [&_li]:my-2 [&_li]:ml-0 pb-6"
                dangerouslySetInnerHTML={{ __html: data.attributes.content }}
              />
            ) : (
              <div className="bg-gray-900 rounded-lg p-4 overflow-auto border border-gray-700">
                <pre className="text-sm text-green-400 font-mono">{JSON.stringify(data, null, 2)}</pre>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="bg-gray-50 px-6 py-4 border-t shrink-0">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
