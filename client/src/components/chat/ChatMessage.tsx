import type { Message } from "../../types/message";
import { Card } from "@/components/ui/card";

interface ChatMessageProps {
  message: Message;
  onClick: (message: Message) => void;
  isFetching?: boolean;
  isFetched?: boolean;
}

const extractUrlParams = (url: string): { dccid: string | null; hudmo: string | null } => {
  try {
    const cleanUrl = url.replace(/[).,;!?]+$/, "");
    const urlObj = new URL(cleanUrl);

    let dccid = urlObj.searchParams.get("c__dccid");
    let hudmo = urlObj.searchParams.get("c__hudmo");

    if (!dccid && !hudmo) {
      dccid = urlObj.searchParams.get("c__contentId");
      hudmo = urlObj.searchParams.get("c__objectApiName");
    }

    return { dccid, hudmo };
  } catch {
    return { dccid: null, hudmo: null };
  }
};

const extractUrlsFromContent = (content: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const matches = content.match(urlRegex) || [];

  return matches.map((url) => url.replace(/[).,;!?]+$/, ""));
};

const handleUrlClick = (url: string, e: React.MouseEvent) => {
  e.stopPropagation();

  window.open(url, "_blank", "noopener,noreferrer");
};

const parseMessageContent = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const cleanUrl = part.replace(/[).,;!?]+$/, "");
      const trailingPunct = part.slice(cleanUrl.length);

      return (
        <span key={index}>
          <a
            href={cleanUrl}
            className="text-blue-500 hover:text-blue-700 underline break-all"
            onClick={(e) => handleUrlClick(cleanUrl, e)}
          >
            {cleanUrl}
          </a>
          {trailingPunct}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export const ChatMessage = ({ message, onClick, isFetching = false, isFetched = false }: ChatMessageProps) => {
  const isUser = message.sender === "user";
  const isBot = message.sender === "bot";

  // Check if message has citation data (either directly or extractable from URLs)
  const hasCitationData = () => {
    // Check if message already has dccid and hudmo
    if (message.dccid && message.hudmo) {
      return true;
    }

    // Check if we can extract citation data from URLs in content
    const urls = extractUrlsFromContent(message.content);
    if (urls.length > 0) {
      const { dccid, hudmo } = extractUrlParams(urls[0]);
      return !!(dccid && hudmo);
    }

    return false;
  };

  const canViewArticle = hasCitationData();

  const handleMessageClick = () => {
    if (!canViewArticle) return;

    const urls = extractUrlsFromContent(message.content);

    let updatedMessage = message;

    if (urls.length > 0) {
      const { dccid, hudmo } = extractUrlParams(urls[0]);

      if (dccid && hudmo) {
        console.log("Extracted URL parameters from message:", { dccid, hudmo });
        updatedMessage = {
          ...message,
          dccid,
          hudmo,
        };
      }
    }

    onClick(updatedMessage);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 sm:mb-4`}>
      <Card
        onClick={handleMessageClick}
        className={`
          max-w-[85%] sm:max-w-[80%] p-0 transition-all text-left
          ${
            isUser
              ? "bg-[#0176D3] text-white hover:bg-[#014486] border-[#0176D3]"
              : "bg-white text-gray-900 hover:bg-gray-50 hover:shadow-md border-gray-200"
          }
          ${isBot && canViewArticle ? "cursor-pointer" : ""}
        `}
      >
        <div className="px-3 sm:px-4 py-2">
          <p className="text-xs sm:text-sm text-left wrap-break-word break-words">{parseMessageContent(message.content)}</p>
          <span className="text-[10px] sm:text-xs opacity-70 mt-1 block text-left">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isBot && canViewArticle && (
            <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-30">
              <div className="flex items-center gap-1 sm:gap-1.5 text-[#0176D3]">
                {isFetching ? (
                  <>
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-[10px] sm:text-xs font-semibold">Preparing article...</span>
                  </>
                ) : isFetched ? (
                  <>
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-[10px] sm:text-xs font-semibold">Ready to view article</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span className="text-[10px] sm:text-xs font-semibold">Click to view article</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
