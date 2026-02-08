import type { ReactNode } from "react";
import type { Message } from "../../types/message";
import { Card } from "@/components/ui/card";
import agentforceLogo from "../../assets/agentforce_logo.webp";

interface ChatMessageProps {
  message: Message;
  onClick: (message: Message) => void;
  isFetching?: boolean;
  isFetched?: boolean;
  /** Article title from get-hudmo (attributes.title), shown as "View Source: Title" when available */
  articleTitle?: string | null;
}

const extractUrlParams = (url: string): { dccid: string | null; hudmo: string | null } => {
  try {
    const cleanUrl = url.replace(/[).,;!?]+$/, "");
    const urlObj = new URL(cleanUrl);

    // Try primary parameter names first
    let dccid = urlObj.searchParams.get("c__dccid");
    let hudmo = urlObj.searchParams.get("c__hudmo");

    // If either is missing, try fallback parameter names
    if (!dccid) {
      dccid = urlObj.searchParams.get("c__contentId");
    }
    if (!hudmo) {
      hudmo = urlObj.searchParams.get("c__objectApiName");
    }

    console.log("extractUrlParams: Extracted from URL:", { url: cleanUrl, dccid, hudmo, allParams: Object.fromEntries(urlObj.searchParams) });
    return { dccid, hudmo };
  } catch (error) {
    console.error("extractUrlParams: Error parsing URL:", url, error);
    return { dccid: null, hudmo: null };
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
    let cleanedContent = raw;
    const removedPieces: string[] = [];

    // Remove the "For more details" section with official documentation link
    const officialDocPattern = /For more details, you can check the official documentation\s*["']here["']\s*\([^)]*runtime_cdp__dataHarmonizedModelObjRefRecordHome[^)]*\)\.?\s*Let me know if you need further assistance!?/gi;
    const matches1 = cleanedContent.match(officialDocPattern);
    if (matches1) {
      removedPieces.push(...matches1);
      cleanedContent = cleanedContent.replace(officialDocPattern, "").trim();
    }

    const pattern2 = /For more details[^.!?]*official documentation[^.!?]*here[^.!?]*\([^)]*runtime_cdp__dataHarmonizedModelObjRefRecordHome[^)]*\)[^.!?]*\.?/gi;
    const matches2 = cleanedContent.match(pattern2);
    if (matches2) {
      removedPieces.push(...matches2);
      cleanedContent = cleanedContent.replace(pattern2, "").trim();
    }

    const pattern3 = /Let me know if you need further assistance!?/gi;
    const matches3 = cleanedContent.match(pattern3);
    if (matches3) {
      removedPieces.push(...matches3);
      cleanedContent = cleanedContent.replace(pattern3, "").trim();
    }

    if (removedPieces.length > 0) {
      console.log('🗑️ Removed "For more details" sections:', removedPieces);
    }

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
              className="text-blue-500 hover:text-blue-700 underline break-words"
              onClick={(e) => handleUrlClick(cleanUrl, e)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {cleanUrl}
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



export const ChatMessage = ({ message, onClick, isFetching = false, isFetched: _isFetched = false, articleTitle }: ChatMessageProps) => {
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

  const hasCitationData = (): boolean => {
    if (safeMessage.dccid && safeMessage.hudmo) return true;
    if (message?.citedReferences && Array.isArray(message.citedReferences) && message.citedReferences.length > 0) {
      const firstCitation = message.citedReferences[0];
      if (firstCitation?.url) {
        const { dccid, hudmo } = extractUrlParams(firstCitation.url);
        if (dccid && hudmo) return true;
      }
    }
    const urls = extractUrlsFromContent(safeMessage.content);
    if (urls.length > 0) {
      const { dccid, hudmo } = extractUrlParams(urls[0]);
      return !!(dccid && hudmo);
    }
    return false;
  };

  const canViewArticle = hasCitationData();

  const handleMessageClick = () => {
    if (!canViewArticle) return;
    if (message?.citedReferences && Array.isArray(message.citedReferences) && message.citedReferences.length > 0) {
      const firstCitation = message.citedReferences[0];
      if (firstCitation?.url) {
        const { dccid, hudmo } = extractUrlParams(firstCitation.url);
        if (dccid && hudmo) {
          onClick({ ...safeMessage, dccid, hudmo });
          return;
        }
      }
    }
    const urls = extractUrlsFromContent(safeMessage.content);
    let updatedMessage = safeMessage;
    if (urls.length > 0) {
      const { dccid, hudmo } = extractUrlParams(urls[0]);
      if (dccid && hudmo) {
        updatedMessage = { ...safeMessage, dccid, hudmo };
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
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border-2 border-[var(--theme-primary)]"
          />
        </div>
      )}
      <Card
        onClick={handleMessageClick}
        className={`
          max-w-[85%] sm:max-w-[80%] p-0 transition-all text-left
          ${
            isUser
              ? "bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary-hover)] border-[var(--theme-primary)]"
              : "bg-white text-gray-900 hover:bg-gray-50 hover:shadow-md border-gray-200"
          }
          ${isBot && canViewArticle ? "cursor-pointer" : ""}
        `}
      >
        <div className="px-3 sm:px-4 py-2">
          <p className="text-xs sm:text-sm text-left wrap-break-word break-words whitespace-pre-wrap">{parseMessageContent(safeMessage.content)}</p>

          {/* Summary Section */}
          {isBot && safeMessage.summary && (
            <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 sm:w-4 sm:h-4 shrink-0 mt-0.5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Summary</p>
                  <p className="text-xs sm:text-sm text-gray-600 wrap-break-word break-words whitespace-pre-wrap">{safeMessage.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Q&A Section */}
          {isBot && Array.isArray(safeMessage.qa) && safeMessage.qa.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
              <div className="flex items-start gap-2 mb-2">
                <svg className="w-4 h-4 sm:w-4 sm:h-4 shrink-0 mt-0.5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-700">Q&A</p>
              </div>
              <div className="space-y-3">
                {safeMessage.qa.map((qaItem, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-200">
                    {qaItem && typeof qaItem === "object" && qaItem.question != null && (
                      <div className="mb-2">
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Q:</p>
                        <p className="text-xs sm:text-sm text-gray-800 wrap-break-word break-words whitespace-pre-wrap">{String(qaItem.question)}</p>
                      </div>
                    )}
                    {qaItem && typeof qaItem === "object" && qaItem.answer != null && (
                      <div>
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">A:</p>
                        <p className="text-xs sm:text-sm text-gray-600 wrap-break-word break-words whitespace-pre-wrap">{String(qaItem.answer)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <span className="text-[10px] sm:text-xs opacity-70 mt-1 block text-left">
            {safeMessage.timestamp instanceof Date
              ? safeMessage.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date(safeMessage.timestamp as string | number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isBot && canViewArticle && (
            <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-30">
              <div
                className="flex items-center text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)] cursor-pointer hover:underline"
                onClick={handleMessageClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleMessageClick();
                  }
                }}
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-[10px] sm:text-xs font-semibold">
                  {isFetching ? "Preparing article..." : articleTitle ? `View Source: ${articleTitle}` : "View Article"}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};