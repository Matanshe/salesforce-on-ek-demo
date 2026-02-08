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

const extractUrlsFromContent = (content: string): string[] => {
  if (!content) {
    console.log("extractUrlsFromContent: No content provided");
    return [];
  }
  
  console.log("extractUrlsFromContent: Content:", content);
  
  // Use the same regex pattern that works in App.tsx for consistency
  // This matches http:// or https:// followed by non-whitespace and non-closing-paren characters
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const matches = content.match(urlRegex) || [];
  
  console.log("extractUrlsFromContent: Found matches:", matches);

  // Clean up trailing punctuation from matched URLs
  const cleanedUrls = matches.map((url) => {
    // Remove trailing punctuation that's likely not part of the URL
    const cleaned = url.replace(/[).,;!?]+$/, "");
    console.log("extractUrlsFromContent: Cleaned URL:", cleaned, "from:", url);
    return cleaned;
  });
  
  console.log("extractUrlsFromContent: Returning", cleanedUrls.length, "URLs");
  return cleanedUrls;
};

const handleUrlClick = (url: string, e: React.MouseEvent) => {
  e.stopPropagation();

  window.open(url, "_blank", "noopener,noreferrer");
};




const parseMessageContent = (content: string) => {
  if (!content || typeof content !== 'string') {
    console.warn("parseMessageContent: Invalid content:", content);
    return [<span key="invalid">Invalid content</span>];
  }

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
  try {
    if (!message) {
      console.error("ChatMessage: message is null or undefined");
      return null;
    }

    const isUser = message.sender === "user";
    const isBot = message.sender === "bot";
    
    console.log("ChatMessage: Message sender:", message.sender, "isBot:", isBot, "isUser:", isUser, "message ID:", message.id);
    console.log("ChatMessage: Message has citedReferences:", !!message.citedReferences, "count:", message.citedReferences?.length || 0);
    console.log("ChatMessage: Message content preview:", (message.content || message.message || "").substring(0, 100));

    // Check if message has citation data (either directly or extractable from URLs or citedReferences)
    const hasCitationData = () => {
    try {
    // Check if message already has dccid and hudmo
    if (message.dccid && message.hudmo) {
      console.log("ChatMessage: Found citation data in message properties:", { dccid: message.dccid, hudmo: message.hudmo });
      return true;
    }

    // Check citedReferences first (these contain actual URLs even when message text has URL_Redacted)
    try {
      if (message.citedReferences && Array.isArray(message.citedReferences) && message.citedReferences.length > 0) {
        console.log("ChatMessage: Found citedReferences:", message.citedReferences);
        const firstCitation = message.citedReferences[0];
        if (firstCitation && firstCitation.url) {
          console.log("ChatMessage: Checking URL from citedReferences:", firstCitation.url);
          const { dccid, hudmo } = extractUrlParams(firstCitation.url);
          const hasData = !!(dccid && hudmo);
          if (hasData) {
            console.log("ChatMessage: ✅ Extracted citation data from citedReferences URL:", { dccid, hudmo, url: firstCitation.url });
            return true;
          }
        }
      }
    } catch (error) {
      console.error("ChatMessage: Error checking citedReferences:", error);
    }

    // Get content from message.content or message.message (fallback)
    const contentToCheck = message.content || message.message || "";
    console.log("ChatMessage: Checking for URLs in content, content length:", contentToCheck?.length);
    console.log("ChatMessage: Full content:", contentToCheck);
    
    // Check if content contains URL_Redacted
    if (contentToCheck.includes("URL_Redacted")) {
      console.log("ChatMessage: ⚠️ Content contains 'URL_Redacted' - URLs are redacted in message text");
      console.log("ChatMessage: ⚠️ This means we MUST rely on citedReferences for the actual URLs");
      // If we have citedReferences, we already checked them above, so return false here
      // If we don't have citedReferences, we can't extract URLs from redacted text
      return false;
    }
    
    const urls = extractUrlsFromContent(contentToCheck);
    console.log("ChatMessage: extractUrlsFromContent returned:", urls.length, "URLs");
    if (urls.length > 0) {
      console.log("ChatMessage: All URLs found:", urls);
      console.log("ChatMessage: First URL:", urls[0]);
      const { dccid, hudmo } = extractUrlParams(urls[0]);
      const hasData = !!(dccid && hudmo);
      console.log("ChatMessage: Extracted params:", { dccid, hudmo, hasData });
      if (hasData) {
        console.log("ChatMessage: ✅ Extracted citation data from URL:", JSON.stringify({ dccid, hudmo, url: urls[0] }));
        console.log("ChatMessage: ✅ hasCitationData will return TRUE - button should appear");
      } else {
        console.log("ChatMessage: ❌ Could not extract citation data from URL:", JSON.stringify({ dccid, hudmo, url: urls[0] }));
        console.log("ChatMessage: ❌ hasCitationData will return FALSE - button will NOT appear");
      }
      return hasData;
    }

    console.log("ChatMessage: ❌ No URLs found in message content. Content preview:", contentToCheck?.substring(0, 500));
    return false;
    } catch (error) {
      console.error("ChatMessage: Error in hasCitationData:", error);
      return false;
    }
  };

  const canViewArticle = hasCitationData();
  console.log("ChatMessage: canViewArticle =", canViewArticle, "for message ID:", message.id);
  console.log("ChatMessage: Button render condition - isBot:", isBot, "canViewArticle:", canViewArticle, "will render:", isBot && canViewArticle);
  console.log("ChatMessage: Full message object:", {
    id: message.id,
    sender: message.sender,
    hasDccid: !!message.dccid,
    hasHudmo: !!message.hudmo,
    hasCitedReferences: !!message.citedReferences,
    citedRefsCount: message.citedReferences?.length || 0,
    contentPreview: (message.content || message.message || "").substring(0, 50),
  });

  const handleMessageClick = () => {
    if (!canViewArticle) {
      console.log("ChatMessage: handleMessageClick called but canViewArticle is false");
      return;
    }

    let updatedMessage = message;

    // Try to get URL from citedReferences first (works even when URLs are redacted in message text)
    try {
      if (message.citedReferences && Array.isArray(message.citedReferences) && message.citedReferences.length > 0) {
        const firstCitation = message.citedReferences[0];
        if (firstCitation && firstCitation.url) {
          const { dccid, hudmo } = extractUrlParams(firstCitation.url);
          if (dccid && hudmo) {
            console.log("Extracted URL parameters from citedReferences:", { dccid, hudmo, url: firstCitation.url });
            updatedMessage = {
              ...message,
              dccid,
              hudmo,
            };
            onClick(updatedMessage);
            return;
          }
        }
      }
    } catch (error) {
      console.error("ChatMessage: Error extracting from citedReferences:", error);
    }

    // Fallback to extracting from message content
    const contentToCheck = message.content || message.message || "";
    const urls = extractUrlsFromContent(contentToCheck);

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
          <p className="text-xs sm:text-sm text-left wrap-break-word break-words whitespace-pre-wrap">{parseMessageContent(message.content || message.message || "")}</p>
          
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
            {message.timestamp instanceof Date 
              ? message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {(() => {
            const shouldRender = isBot && canViewArticle;
            console.log("ChatMessage: Rendering button section - shouldRender:", shouldRender, "isBot:", isBot, "canViewArticle:", canViewArticle, "articleTitle:", articleTitle, "isFetching:", isFetching);
            if (shouldRender) {
              const buttonText = isFetching 
                ? "Preparing article..." 
                : articleTitle && articleTitle.trim() 
                  ? `View Source: ${articleTitle}` 
                  : "View Article";
              console.log("ChatMessage: Button will render with text:", JSON.stringify(buttonText), "length:", buttonText.length);
              return (
                <div className="mt-2 pt-2 border-t border-gray-300 border-opacity-30">
                  <div 
                    className="flex items-center text-[#0176D3] cursor-pointer hover:underline" 
                    onClick={handleMessageClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMessageClick();
                      }
                    }}
                    style={{ color: '#0176D3' }}
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#0176D3' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span 
                      className="text-[10px] sm:text-xs font-semibold" 
                      style={{ 
                        color: '#0176D3', 
                        display: 'inline-block',
                        visibility: 'visible',
                        opacity: 1
                      }}
                    >
                      {buttonText || "View Article"}
                    </span>
                  </div>
                </div>
              );
            }
            console.log("ChatMessage: Button NOT rendered - isBot:", isBot, "canViewArticle:", canViewArticle);
            return null;
          })()}
        </div>
      </Card>
    </div>
  );
  } catch (error) {
    console.error("ChatMessage: Error rendering message:", error);
    console.error("ChatMessage: Message that caused error:", message);
    return (
      <div className="flex gap-2 sm:gap-3 p-2 sm:p-3">
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <p className="font-semibold">Error displaying message</p>
          <p className="text-xs mt-1">{error instanceof Error ? error.message : String(error)}</p>
        </div>
      </div>
    );
  }
};