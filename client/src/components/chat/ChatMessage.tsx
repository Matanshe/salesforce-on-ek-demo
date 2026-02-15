import { type ReactNode, useCallback } from "react";
import type { Message, CitationHoverCardData } from "../../types/message";
import { Card } from "@/components/ui/card";
import agentforceLogo from "../../assets/agentforce_logo.webp";

export type CitationBehaviorType = "fullPage" | "modal";

interface ChatMessageProps {
  message: Message;
  onClick: (message: Message) => void;
  isFetching?: boolean;
  isFetched?: boolean;
  /** Article title from get-hudmo (attributes.title), shown as "View Source: Title" when available */
  articleTitle?: string | null;
  /** When "modal", citations open in modal; hover can show chunk preview */
  citationBehavior?: CitationBehaviorType;
  /** Chunk text preview for tooltip when citationBehavior === "modal" */
  chunkPreviewForMessage?: string | null;
  /** Hover card data (metadata, title, source, summary) when citationBehavior === "modal" */
  hoverCardData?: CitationHoverCardData | null;
  /** Called when citation hover starts (messageId) or ends (null); card is shown in slot above input */
  onCitationHoverChange?: (messageId: string | null) => void;
  onCitationHoverScheduleHide?: () => void;
  /** Called when user hovers citation (modal mode) so parent can fetch chunk preview */
  onHoverCitation?: (message: Message) => void;
}

const extractUrlParams = (
  url: string
): { dccid: string | null; hudmo: string | null; chunkObjectApiName: string | null; chunkRecordIds: string | null } => {
  try {
    const cleanUrl = url.replace(/[).,;!?]+$/, "");
    const urlObj = new URL(cleanUrl);

    let dccid = urlObj.searchParams.get("c__dccid");
    let hudmo = urlObj.searchParams.get("c__hudmo");

    if (!dccid && !hudmo) {
      dccid = urlObj.searchParams.get("c__contentId");
      hudmo = urlObj.searchParams.get("c__objectApiName");
    }

    const chunkObjectApiName = urlObj.searchParams.get("c__chunkObjectApiName");
    const chunkRecordIds = urlObj.searchParams.get("c__chunkRecordIds");

    return { dccid, hudmo, chunkObjectApiName, chunkRecordIds };
  } catch {
    return { dccid: null, hudmo: null, chunkObjectApiName: null, chunkRecordIds: null };
  }
};

const extractUrlsFromContent = (content: string | null | undefined): string[] => {
  const raw = content != null && typeof content === "string" ? content : "";
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const matches = raw.match(urlRegex) || [];
  return matches.map((url) => url.replace(/[).,;!?]+$/, ""));
};

const handleUrlClick = (url: string, e: React.MouseEvent) => {
  e.stopPropagation();

  window.open(url, "_blank", "noopener,noreferrer");
};




/** Parses message content into text and links. Never throws; returns safe fallback on error. */
const parseMessageContent = (content: string | null | undefined): ReactNode => {
  const raw = content != null && typeof content === "string" ? content : "";
  try {
    const cleanedContent = raw;

    // Use one regex for split (needs capture group); use a separate regex for "is URL?" check
    // so we don't reuse a /g regex in a loop (lastIndex would cause wrong results).
    const urlRegexSplit = /(https?:\/\/[^\s)]+)/g;
    const parts = cleanedContent.split(urlRegexSplit);
    const urlPatternOne = /^https?:\/\/[^\s)]+$/;

    return parts.map((part, index) => {
      if (typeof part !== "string") return <span key={index} />;
      if (urlPatternOne.test(part)) {
        const cleanUrl = part.replace(/[).,;!?]+$/, "");
        const trailingPunct = part.slice(cleanUrl.length);
        return (
          <span key={index}>
            <a
              href={cleanUrl}
              title={cleanUrl}
              className="text-blue-500 hover:text-blue-700 underline break-words cursor-pointer"
              onClick={(e) => handleUrlClick(cleanUrl, e)}
              target="_blank"
              rel="noopener noreferrer"
            >
              link
            </a>
            {trailingPunct}
          </span>
        );
      }
      return (
        <span key={`text-${index}`} style={{ whiteSpace: "pre-wrap" }}>
          {part}
        </span>
      );
    });
  } catch {
    return <span style={{ whiteSpace: "pre-wrap" }}>{raw || ""}</span>;
  }
};



export const ChatMessage = ({
  message,
  onClick,
  isFetching = false,
  isFetched: _isFetched = false,
  articleTitle,
  citationBehavior = "fullPage",
  chunkPreviewForMessage: _chunkPreviewForMessage,
  hoverCardData: _hoverCardData,
  onCitationHoverChange,
  onCitationHoverScheduleHide,
  onHoverCitation,
}: ChatMessageProps) => {
  // Defensive: ensure message has required shape so rendering never throws
  const safeContent = message?.content != null && typeof message.content === "string" ? message.content : "";
  const safeMessage: Message = {
    ...message,
    id: message?.id ?? "unknown",
    content: safeContent,
    sender: message?.sender === "user" ? "user" : "bot",
    timestamp: message?.timestamp instanceof Date ? message.timestamp : new Date(typeof message?.timestamp === "string" || typeof message?.timestamp === "number" ? message.timestamp : Date.now()),
    qa: Array.isArray(message?.qa) ? message.qa : undefined,
    summary: typeof message?.summary === "string" ? message.summary : undefined,
    articleTitle: typeof message?.articleTitle === "string" ? message.articleTitle : undefined,
  };

  const isUser = safeMessage.sender === "user";
  const isBot = safeMessage.sender === "bot";

  const getCitationUrl = (): string | null => {
    const urls = extractUrlsFromContent(safeMessage.content);
    if (urls.length > 0) return urls[0];
    const refs = safeMessage.citedReferences;
    if (Array.isArray(refs) && refs.length > 0 && refs[0]?.url) {
      const u = refs[0].url;
      return typeof u === "string" ? u : null;
    }
    return null;
  };

  const hasCitationData = () => {
    if (safeMessage.dccid && safeMessage.hudmo) return true;
    const url = getCitationUrl();
    if (url) {
      const { dccid, hudmo } = extractUrlParams(url);
      return !!(dccid && hudmo);
    }
    return false;
  };

  const canViewArticle = hasCitationData();

  const showCard = useCallback(() => {
    onCitationHoverChange?.(safeMessage.id);
  }, [safeMessage.id, onCitationHoverChange]);

  const scheduleHideCard = useCallback(() => {
    onCitationHoverScheduleHide?.();
  }, [onCitationHoverScheduleHide]);

  const handleMessageClick = () => {
    if (!canViewArticle) return;
    const url = getCitationUrl();
    let updatedMessage = safeMessage;
    if (url) {
      const { dccid, hudmo, chunkObjectApiName, chunkRecordIds } = extractUrlParams(url);
      if (dccid && hudmo) {
        updatedMessage = {
          ...safeMessage,
          dccid,
          hudmo,
          ...(chunkObjectApiName && chunkRecordIds
            ? { chunkObjectApiName, chunkRecordIds }
            : {}),
        };
        onClick(updatedMessage);
        return;
      }
    }
    onClick(updatedMessage);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 sm:mb-4 items-start gap-2 sm:gap-3`}>
      {isBot && (
        <div className="flex-shrink-0 mt-1">
          <img 
            src={agentforceLogo} 
            alt="Agentforce" 
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border-2 border-[#0176D3]"
          />
        </div>
      )}
      <Card
        className={`
          max-w-[85%] sm:max-w-[80%] p-0 transition-all text-left
          ${
            isUser
              ? "bg-[#0176D3] text-white hover:bg-[#014486] border-[#0176D3]"
              : "bg-white text-gray-900 hover:bg-gray-50 hover:shadow-md border-gray-200"
          }
          ${isBot ? "cursor-default" : ""}
        `}
      >
        <div className="px-3 sm:px-4 py-2">
          <p className="text-xs sm:text-sm text-left wrap-break-word break-words whitespace-pre-wrap">{parseMessageContent(safeMessage.content)}</p>

          <span className="text-[10px] sm:text-xs opacity-70 mt-1 block text-left">
            {safeMessage.timestamp instanceof Date
              ? safeMessage.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date(safeMessage.timestamp as string | number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isBot && canViewArticle && (
            <div
              className="relative mt-2 pt-2 border-t border-gray-300 border-opacity-30"
              onMouseEnter={() => {
                if (citationBehavior === "modal") {
                  showCard();
                  onHoverCitation?.(safeMessage);
                }
              }}
              onMouseLeave={scheduleHideCard}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={handleMessageClick}
                onKeyDown={(e) => e.key === "Enter" && handleMessageClick()}
                className="cursor-pointer"
              >
                <div className="flex items-center text-[#0176D3]">
                  {isFetching ? (
                    <span className="text-[10px] sm:text-xs font-semibold">Preparing article...</span>
                  ) : (
                    <span className="text-[10px] sm:text-xs font-semibold">
                      View Source{articleTitle ? `: ${articleTitle}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};