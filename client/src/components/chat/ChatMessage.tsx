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

  let cleanedContent = content;
  const removedPieces: string[] = [];
  
  // Remove the "For more details" section with official documentation link
  const officialDocPattern = /For more details, you can check the official documentation\s*["']here["']\s*\([^)]*runtime_cdp__dataHarmonizedModelObjRefRecordHome[^)]*\)\.?\s*Let me know if you need further assistance!?/gi;
  const matches1 = cleanedContent.match(officialDocPattern);
  if (matches1) {
    removedPieces.push(...matches1);
    cleanedContent = cleanedContent.replace(officialDocPattern, '').trim();
  }
  
  // Also remove standalone patterns
  const pattern2 = /For more details[^.!?]*official documentation[^.!?]*here[^.!?]*\([^)]*runtime_cdp__dataHarmonizedModelObjRefRecordHome[^)]*\)[^.!?]*\.?/gi;
  const matches2 = cleanedContent.match(pattern2);
  if (matches2) {
    removedPieces.push(...matches2);
    cleanedContent = cleanedContent.replace(pattern2, '').trim();
  }
  
  const pattern3 = /Let me know if you need further assistance!?/gi;
  const matches3 = cleanedContent.match(pattern3);
  if (matches3) {
    removedPieces.push(...matches3);
    cleanedContent = cleanedContent.replace(pattern3, '').trim();
  }
  
  // Log removed pieces if any were found
  if (removedPieces.length > 0) {
    console.log('🗑️ Removed "For more details" sections:', removedPieces);
    console.log('📝 Original content length:', content.length);
    console.log('✨ Cleaned content length:', cleanedContent.length);
  }
  
  // Preserve the original content formatting - don't modify newlines or whitespace
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = cleanedContent.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
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
    } else {
      return (
        <span key={`text-${index}`} style={{ whiteSpace: "pre-wrap" }}>
          {part}
        </span>
      );
    }
  });
};



export const ChatMessage = ({ message, onClick, isFetching = false, isFetched: _isFetched = false, articleTitle }: ChatMessageProps) => {
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
          <p className="text-xs sm:text-sm text-left wrap-break-word break-words whitespace-pre-wrap">{parseMessageContent(message.content)}</p>
          
          {/* Summary Section */}
          {isBot && message.summary && (
            <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 sm:w-4 sm:h-4 shrink-0 mt-0.5 text-[#0176D3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Summary</p>
                  <p className="text-xs sm:text-sm text-gray-600 wrap-break-word break-words whitespace-pre-wrap">{message.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Q&A Section */}
          {isBot && message.qa && message.qa.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
              <div className="flex items-start gap-2 mb-2">
                <svg className="w-4 h-4 sm:w-4 sm:h-4 shrink-0 mt-0.5 text-[#0176D3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-700">Q&A</p>
              </div>
              <div className="space-y-3">
                {message.qa.map((qaItem, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-200">
                    {qaItem.question && (
                      <div className="mb-2">
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">Q:</p>
                        <p className="text-xs sm:text-sm text-gray-800 wrap-break-word break-words whitespace-pre-wrap">{qaItem.question}</p>
                      </div>
                    )}
                    {qaItem.answer && (
                      <div>
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">A:</p>
                        <p className="text-xs sm:text-sm text-gray-600 wrap-break-word break-words whitespace-pre-wrap">{qaItem.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <span className="text-[10px] sm:text-xs opacity-70 mt-1 block text-left">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isBot && canViewArticle && (
            <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-30">
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
          )}
        </div>
      </Card>
    </div>
  );
};