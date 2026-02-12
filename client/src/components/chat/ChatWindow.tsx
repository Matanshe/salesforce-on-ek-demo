import { type ErrorInfo, type ReactNode, Component, useRef, useEffect } from "react";
import type { Message } from "../../types/message";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ChatWindowProps {
  messages: Message[];
  onMessageClick: (message: Message) => void;
  onSendMessage: (content: string) => void;
  onDeleteSession: () => void;
  onStartNewSession: () => void;
  sessionInitialized: boolean;
  isLoading: boolean;
  onClose: () => void;
  embedded?: boolean;
  minimized?: boolean;
  fetchingHudmoFor?: Set<string>;
  prefetchedHudmoData?: Map<string, unknown>;
  citationBehavior?: "fullPage" | "modal";
  chunkPreviewByMessageId?: Record<string, string>;
  onHoverCitation?: (message: Message) => void;
}

const extractUrlParams = (url: string): { dccid: string | null; hudmo: string | null } => {
  try {
    const cleanUrl = url.replace(/[).,;!?]+$/, "");
    const urlObj = new URL(cleanUrl);
    let dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
    let hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
    return { dccid, hudmo };
  } catch {
    return { dccid: null, hudmo: null };
  }
};

/** Catches errors rendering a single message so one bad message does not break the whole chat. */
class MessageErrorBoundary extends Component<
  { children: ReactNode; messageId: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ChatMessage render error:", this.props.messageId, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex justify-start mb-3 sm:mb-4">
          <Card className="max-w-[85%] sm:max-w-[80%] p-3 bg-white border-gray-200 text-gray-500 text-sm">
            Message could not be displayed.
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Safe extraction of cache key; never throws. */
const getCacheKey = (message: Message): string | null => {
  try {
    if (message?.dccid && message?.hudmo) {
      return `${String(message.dccid)}-${String(message.hudmo)}`;
    }
    const content = message?.content;
    if (typeof content !== "string") return null;
    const urls = content.match(/(https?:\/\/[^\s)]+)/g) || [];
    if (urls.length > 0 && urls[0]) {
      const { dccid, hudmo } = extractUrlParams(urls[0]);
      if (dccid && hudmo) return `${dccid}-${hudmo}`;
    }
  } catch {
    // ignore
  }
  return null;
};

export const ChatWindow = ({
  messages,
  onMessageClick,
  onSendMessage,
  onDeleteSession,
  onStartNewSession,
  sessionInitialized,
  isLoading,
  onClose,
  embedded = false,
  minimized = false,
  fetchingHudmoFor = new Set(),
  prefetchedHudmoData = new Map(),
  citationBehavior = "fullPage",
  chunkPreviewByMessageId,
  onHoverCitation,
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the last message (bottom) when the agent adds a message or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  return (
    <div className={`w-full ${minimized ? 'h-full' : embedded ? 'h-[500px] sm:h-[600px] md:h-[700px]' : 'sm:w-96 h-dvh sm:h-[600px] sm:rounded-lg'} bg-white ${embedded || minimized ? '' : 'shadow-2xl'} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="bg-[#0176D3] text-white p-2.5 sm:p-3 md:p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#2E844A] rounded-full shrink-0"></div>
          <h3 className="font-semibold text-xs sm:text-sm md:text-base truncate">Agentforce on EK</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onDeleteSession}
            variant="ghost"
            size="icon"
            className="hover:bg-black hover:bg-opacity-20 text-white"
            title="End Session"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
          {!embedded && !minimized && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="hover:bg-black hover:bg-opacity-20 text-white"
              title="Close Chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 md:p-4 bg-gray-50">
        {messages.length === 0 && !isLoading && !sessionInitialized ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 sm:gap-4 px-3 sm:px-4">
            <p className="text-center text-xs sm:text-sm md:text-base">
              Session ended
              <br />
              <span className="text-xs">Ready to start a new conversation?</span>
            </p>
            <Button onClick={onStartNewSession} size="lg" className="shadow-md hover:shadow-lg bg-[#0176D3] hover:bg-[#014486] text-white text-sm sm:text-base px-4 sm:px-6">
              Start New Session
            </Button>
          </div>
        ) : messages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 px-3 sm:px-4">
            <p className="text-center text-xs sm:text-sm md:text-base">
              Welcome to Agentforce on EK!
              <br />
              <span className="text-xs sm:text-sm">Ask any question about Salesforce products and features.</span>
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const cacheKey = getCacheKey(message);
              const isFetching = cacheKey ? fetchingHudmoFor.has(cacheKey) : false;
              const isFetched = cacheKey ? prefetchedHudmoData.has(cacheKey) : false;
              const prefetched = cacheKey ? (prefetchedHudmoData.get(cacheKey) as { attributes?: { title?: string } } | undefined) : undefined;
              const articleTitle = prefetched?.attributes?.title ?? message.articleTitle ?? null;
              // Stable unique key: id can be missing or duplicated from API; index keeps list order correct
              const messageKey = message?.id ? `${String(message.id)}-${index}` : `msg-${index}`;

              return (
                <MessageErrorBoundary key={messageKey} messageId={message?.id ?? String(index)}>
                  <ChatMessage
                    message={message}
                    onClick={onMessageClick}
                    isFetching={isFetching}
                    isFetched={isFetched}
                    articleTitle={articleTitle}
                    citationBehavior={citationBehavior}
                    chunkPreviewForMessage={message?.id ? chunkPreviewByMessageId?.[message.id] : undefined}
                    onHoverCitation={onHoverCitation}
                  />
                </MessageErrorBoundary>
              );
            })}
            {isLoading && (
              <div className="flex justify-start mb-3 sm:mb-4">
                <div className="max-w-[80%] px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-600">
                      {messages.length === 0 ? "Starting Agentforce on EK..." : "Searching for answers..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput onSend={onSendMessage} />
      </div>
    </div>
  );
};
