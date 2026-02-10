import { type ErrorInfo, type ReactNode, Component, useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Message } from "./types/message";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { WelcomeContent } from "./components/content/WelcomeContent";
import { SearchResultsPage } from "./components/content/SearchResultsPage";
import { ChatWidget } from "./components/chat/ChatWidget";
import { ArticleView } from "./components/content/ArticleView";
import { generateSignature } from "./utils/requestSigner";
import TOC from "./components/TOC";
import "./App.css";

class ArticleErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false as boolean, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ArticleView error:", error, errorInfo);
  }

  handleCloseDialog = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "The document could not be loaded.";
      return (
        <>
          <div className="flex flex-col items-center justify-center h-full p-6 bg-white text-center">
            <p className="text-gray-500 text-sm">There was a problem opening this document. See the message below.</p>
          </div>
          <Dialog open={true} onOpenChange={(open) => { if (!open) this.handleCloseDialog(); }}>
            <DialogContent showCloseButton={true} className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#0176D3]">Document error</DialogTitle>
                <DialogDescription className="text-gray-600 pt-1">
                  {message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4 gap-2">
                <Button onClick={this.handleCloseDialog} variant="outline">
                  Try again
                </Button>
                <Button onClick={this.props.onClose} className="bg-[#0176D3] hover:bg-[#014486]">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    return this.props.children;
  }
}

/** Catches render errors and shows a dialog popup over the app shell (no white screen). */
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false as boolean, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App render error (recovered):", error, errorInfo);
  }

  handleClose = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "An unexpected error occurred.";
      return (
        <>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            <main className="flex-1 flex items-center justify-center px-4 py-8">
              <p className="text-gray-500 text-sm text-center max-w-md">
                Something went wrong. Use the button below to try again or refresh the page.
              </p>
            </main>
            <Footer />
          </div>
          <Dialog open={true} onOpenChange={(open) => { if (!open) this.handleClose(); }}>
            <DialogContent showCloseButton={true} className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#0176D3]">Something went wrong</DialogTitle>
                <DialogDescription className="text-gray-600 pt-1">
                  {message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4">
                <Button onClick={this.handleClose} className="bg-[#0176D3] hover:bg-[#014486]">
                  Try again
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    return this.props.children;
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? "";

/** Extract display text from Agentforce API message (supports .message string or .messageParts array). Never throws. */
function getAgentMessageText(
  msg: { message?: string; messageParts?: Array<{ type?: string; text?: string }> } | null | undefined,
  fallback: string
): string {
  try {
    if (!msg || typeof msg !== "object") return fallback;
    if (typeof msg.message === "string" && msg.message.trim()) return msg.message;
    const parts = msg.messageParts;
    if (Array.isArray(parts)) {
      const text = parts
        .map((p) => (p && typeof p === "object" && typeof (p as { text?: string }).text === "string" ? (p as { text: string }).text : ""))
        .join("");
      if (typeof text === "string" && text.trim()) return text;
    }
  } catch (_e) {
    // API may return unexpected shape; avoid crashing the app
  }
  return fallback;
}

interface HudmoData {
  attributes?: {
    content?: string;
    title?: string;
    metadata?: {
      sourceUrl?: string;
    };
    qa?: Array<{ question?: string; answer?: string }>;
    summary?: string;
  };
}

/** Path pattern for article URLs: /article/:contentId */
const ARTICLE_PATH_REGEX = /^\/article\/([^/?#]+)/;

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [messageSequence, setMessageSequence] = useState(1);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [agentforceSessionId, setAgentforceSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hudmoData, setHudmoData] = useState<HudmoData | null>(null);
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);
  const [prefetchedHudmoData, setPrefetchedHudmoData] = useState<Map<string, HudmoData>>(new Map());
  const [fetchingHudmoFor, setFetchingHudmoFor] = useState<Set<string>>(new Set());
  const prefetchedHudmoDataRef = useRef(prefetchedHudmoData);
  prefetchedHudmoDataRef.current = prefetchedHudmoData;

  const OBJECT_API_NAME = "SFDCHelp7_DMO_harmonized__dlm";

  // Derive article state from URL
  const articleMatch = location.pathname.match(ARTICLE_PATH_REGEX);
  const contentIdFromUrl = articleMatch ? articleMatch[1] : null;
  const hudmoFromUrl = contentIdFromUrl
    ? searchParams.get("hudmo") || OBJECT_API_NAME
    : OBJECT_API_NAME;
  const isArticleOpen = !!contentIdFromUrl;
  const isSearchPage = location.pathname === "/search";

  const [externalSessionKey] = useState<string>(() => {
    const existingSession = sessionStorage.getItem("agentforce-session-key");

    if (existingSession) {
      console.log("Using existing external session key:", existingSession);

      return existingSession;
    }

    const newSessionKey = crypto.randomUUID();
    sessionStorage.setItem("agentforce-session-key", newSessionKey);
    console.log("Generated new external session key:", newSessionKey);

    return newSessionKey;
  });

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      timestamp: new Date(),
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { timestamp, signature } = await generateSignature("POST", "/api/v1/send-message");

      const response = await fetch(`${API_URL}/api/v1/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
        body: JSON.stringify({
          sessionId: agentforceSessionId,
          message: content,
          sequenceId: messageSequence,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      setMessageSequence((prev) => prev + 1);

      const agentResponse = data.messages?.[0];
      // Inspect full agent response shape (chunks table, chunk record id, citation metadata)
      if (agentResponse) {
        console.log("[Agent response shape] Top-level keys:", Object.keys(agentResponse));
        if (Array.isArray(agentResponse.citedReferences) && agentResponse.citedReferences.length > 0) {
          console.log("[Agent response shape] citedReferences count:", agentResponse.citedReferences.length);
          console.log("[Agent response shape] First citedReference keys:", Object.keys(agentResponse.citedReferences[0]));
          console.log("[Agent response shape] First citedReference (full):", JSON.stringify(agentResponse.citedReferences[0], null, 2));
          console.log("[Agent response shape] All citedReferences:", JSON.stringify(agentResponse.citedReferences, null, 2));
        }
        if (agentResponse.result != null) {
          console.log("[Agent response shape] result type:", Array.isArray(agentResponse.result) ? "array" : typeof agentResponse.result);
          console.log("[Agent response shape] result (full):", JSON.stringify(agentResponse.result, null, 2));
        }
        console.log("[Agent response shape] Full message:", JSON.stringify(agentResponse, null, 2));
      }

      if (!agentResponse) {
        throw new Error("No message received from agent");
      }

      const messageText = getAgentMessageText(agentResponse, "Response received");
      if (messageText.includes("URL_Redacted") || messageText.includes("(URL_Redacted)")) {
        console.log("⚠️ Found URL_Redacted in agent response message:", messageText);
      }

      // Build bot message with only safe, serializable values so rendering never throws.
      // Ensure unique id so React keys stay stable (API may reuse or omit id).
      const baseId = typeof agentResponse.id === "string" ? agentResponse.id : `msg-${Date.now()}-bot`;
      const safeId = `${baseId}-${Date.now()}`;
      const safeContent = typeof messageText === "string" ? messageText : "Response received";
      const botMessage: Message = {
        id: safeId,
        content: safeContent,
        timestamp: new Date(),
        sender: "bot",
      };
      if (typeof agentResponse.type === "string") botMessage.type = agentResponse.type;
      if (typeof agentResponse.feedbackId === "string") botMessage.feedbackId = agentResponse.feedbackId;
      if (typeof agentResponse.isContentSafe === "boolean") botMessage.isContentSafe = agentResponse.isContentSafe;
      if (agentResponse.message !== undefined && typeof agentResponse.message === "string") botMessage.message = agentResponse.message;
      if (agentResponse.metrics != null && typeof agentResponse.metrics === "object" && !Array.isArray(agentResponse.metrics)) botMessage.metrics = agentResponse.metrics;
      if (typeof agentResponse.planId === "string") botMessage.planId = agentResponse.planId;
      if (Array.isArray(agentResponse.result)) botMessage.result = agentResponse.result;
      if (Array.isArray(agentResponse.citedReferences)) botMessage.citedReferences = agentResponse.citedReferences;

      setMessages((prev) => [...prev, botMessage]);

      // Pre-fetch citation data if available
      const urls = botMessage.content.match(/(https?:\/\/[^\s)]+)/g) || [];
      if (urls.length > 0 && urls[0]) {
        try {
          const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
          const urlObj = new URL(cleanUrl);
          const dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
          const hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
          
          if (dccid && hudmo) {
            // Pre-fetch in background
            fetchHarmonizationData(dccid, hudmo, botMessage.id, true);
          }
        } catch (error) {
          // URL parsing failed, skip pre-fetch
          console.log("Could not extract citation data for pre-fetch:", error);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        content: "Sorry, there was an error processing your request.",
        timestamp: new Date(),
        sender: "bot",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHarmonizationData = useCallback(async (dccid: string, hudmo: string, messageId?: string, prefetch = false) => {
    const cacheKey = `${dccid}-${hudmo}`;
    const cache = prefetchedHudmoDataRef.current;

    // If prefetching and already cached, skip
    if (prefetch && cache.has(cacheKey)) {
      return;
    }

    // If prefetching and already fetching, skip
    if (prefetch && fetchingHudmoFor.has(cacheKey)) {
      return;
    }

    // If not prefetching, check cache first (use ref so we always have latest)
    if (!prefetch && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (cached && (cached.attributes?.content != null || cached.attributes?.title != null)) {
        setHudmoData(cached);
        setCurrentContentId(dccid);
        return;
      }
    }

    // Mark as fetching
    if (prefetch && messageId) {
      setFetchingHudmoFor((prev) => new Set(prev).add(cacheKey));
    }

    try {
      const { timestamp, signature } = await generateSignature("POST", "/api/v1/get-hudmo");

      const response = await fetch(`${API_URL}/api/v1/get-hudmo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
        body: JSON.stringify({
          hudmoName: hudmo,
          dccid: dccid,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch harmonization data: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log the full content API response
      console.log("📄 Content API Response (get-hudmo):", JSON.stringify(result, null, 2));
      console.log("📄 Content API Response (data):", result.data);
      console.log("📄 Content API Response (attributes):", result.data?.attributes);
      
      // Check for URL_Redacted in content API response
      const contentStr = JSON.stringify(result);
      if (contentStr.includes("URL_Redacted") || contentStr.includes("(URL_Redacted)")) {
        console.log("⚠️ Found URL_Redacted in content API response");
        console.log("⚠️ Content with URL_Redacted:", result.data?.attributes?.content);
      }
      
      // Extract Q&A, summary, and title from content API response
      const qa = result.data?.attributes?.qa;
      const summary = result.data?.attributes?.summary;
      const articleTitle = result.data?.attributes?.title;

      console.log("📋 Extracted Q&A:", qa);
      console.log("📝 Extracted Summary:", summary);
      console.log("📌 Extracted Title:", articleTitle);

      // Update message with Q&A, summary, and title when we have the get-hudmo response (only set safe values)
      if (messageId) {
        const safeQa = Array.isArray(qa) ? qa : undefined;
        const safeSummary = typeof summary === "string" ? summary : undefined;
        const safeArticleTitle = typeof articleTitle === "string" ? articleTitle : undefined;
        if (safeQa || safeSummary || safeArticleTitle) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, ...(safeQa && { qa: safeQa }), ...(safeSummary && { summary: safeSummary }), ...(safeArticleTitle && { articleTitle: safeArticleTitle }) }
                : msg
            )
          );
        }
      }
      
      if (prefetch) {
        // Store in cache for later use
        setPrefetchedHudmoData((prev) => {
          const newMap = new Map(prev);
          newMap.set(cacheKey, result.data);
          return newMap;
        });
        setFetchingHudmoFor((prev) => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
        console.log("Pre-fetched harmonization data for:", cacheKey);
        if (qa || summary) {
          console.log("Extracted Q&A and Summary from content API:", { qa, summary });
        }
      } else {
        // Open article only if we have valid data
        const data = result?.data;
        if (data && (data.attributes?.content != null || data.attributes?.title != null)) {
          setHudmoData(data);
          setCurrentContentId(dccid);
          console.log("Harmonization data:", data);
        } else {
          console.warn("get-hudmo returned no usable content:", result);
        }
      }
    } catch (error) {
      console.error("Error fetching harmonization data:", error);
      if (prefetch && messageId) {
        setFetchingHudmoFor((prev) => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
      }
    }
  }, [prefetchedHudmoData, fetchingHudmoFor]);

  const handleMessageClick = (message: Message) => {
    if (message.sender === "bot") {
      // Extract citation data if not already present
      let dccid: string | null = message.dccid || null;
      let hudmo: string | null = message.hudmo || null;

      if (!dccid || !hudmo) {
        const urls = message.content.match(/(https?:\/\/[^\s)]+)/g) || [];
        if (urls.length > 0 && urls[0]) {
          try {
            const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
            const urlObj = new URL(cleanUrl);
            dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
            hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
          } catch (error) {
            console.error("Error extracting citation data:", error);
          }
        }
      }

      // If message has citation data, navigate to article URL (same URL supports direct links)
      if (dccid && hudmo) {
        const hudmoQuery =
          hudmo !== OBJECT_API_NAME ? `?hudmo=${encodeURIComponent(hudmo)}` : "";
        navigate(`/article/${encodeURIComponent(dccid)}${hudmoQuery}`);
        fetchHarmonizationData(dccid, hudmo, message.id, false);
      }
    }
  };

  const handleCloseArticle = () => {
    navigate("/", { replace: true });
    setHudmoData(null);
    setCurrentContentId(null);
  };

  const handleTocContentClick = useCallback(
    (contentId: string) => {
      navigate(`/article/${encodeURIComponent(contentId)}`);
    },
    [navigate]
  );

  const handleDeleteSession = async () => {
    if (!agentforceSessionId) {
      console.log("No active session to delete");
      return;
    }

    try {
      console.log("Deleting Agentforce session...");

      const { timestamp, signature } = await generateSignature("DELETE", "/api/v1/delete-session");

      const response = await fetch(`${API_URL}/api/v1/delete-session`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
        body: JSON.stringify({
          sessionId: agentforceSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      console.log("Session deleted successfully");

      setMessages([]);
      setSessionInitialized(false);
      setAgentforceSessionId(null);
      setMessageSequence(1);

      const newSessionKey = crypto.randomUUID();
      sessionStorage.setItem("agentforce-session-key", newSessionKey);
      console.log("Generated new external session key:", newSessionKey);
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleStartNewSession = async () => {
    setIsLoading(true);

    try {
      const newSessionKey = sessionStorage.getItem("agentforce-session-key") || crypto.randomUUID();

      console.log("Initializing new Agentforce session...");

      const { timestamp, signature } = await generateSignature(
        "GET",
        `/api/v1/start-session?sessionId=${newSessionKey}`
      );

      const response = await fetch(`${API_URL}/api/v1/start-session?sessionId=${newSessionKey}`, {
        headers: {
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start new session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("New session initialized:", data);

      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);

      if (data.messages?.[0]) {
        const welcomeText = getAgentMessageText(data.messages[0], "Hi, I'm Agentforce on EK. How can I help you?");
        const welcomeMessage: Message = {
          id: data.messages[0].id || `msg-${Date.now()}-welcome`,
          content: welcomeText,
          timestamp: new Date(),
          sender: "bot",
          type: data.messages[0].type,
          feedbackId: data.messages[0].feedbackId,
          isContentSafe: data.messages[0].isContentSafe,
          message: welcomeText,
          metrics: data.messages[0].metrics,
          planId: data.messages[0].planId,
          result: data.messages[0].result,
          citedReferences: data.messages[0].citedReferences,
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error("Error starting new session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSession = useCallback(async () => {
    if (sessionInitialized) return;

    setIsLoading(true);

    try {
      console.log("Initializing Agentforce session...");

      const { timestamp, signature } = await generateSignature(
        "GET",
        `/api/v1/start-session?sessionId=${externalSessionKey}`
      );

      const response = await fetch(`${API_URL}/api/v1/start-session?sessionId=${externalSessionKey}`, {
        headers: {
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Session initialized:", data);
      console.log("response:", response);

      // Store the actual session ID returned by Agentforce
      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);

      // Optionally add the welcome message from Agentforce
      if (data.messages?.[0]) {
        const welcomeText = getAgentMessageText(data.messages[0], "Hi, I'm Agentforce on EK. How can I help you?");
        const welcomeMessage: Message = {
          id: data.messages[0].id || `msg-${Date.now()}-welcome`,
          content: welcomeText,
          timestamp: new Date(),
          sender: "bot",
          type: data.messages[0].type,
          feedbackId: data.messages[0].feedbackId,
          isContentSafe: data.messages[0].isContentSafe,
          message: welcomeText,
          metrics: data.messages[0].metrics,
          planId: data.messages[0].planId,
          result: data.messages[0].result,
          citedReferences: data.messages[0].citedReferences,
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error("Error initializing session:", error);
    } finally {
      setIsLoading(false);
    }
  }, [externalSessionKey, sessionInitialized]);

  // Auto-initialize session when on welcome page
  useEffect(() => {
    if (!sessionInitialized) {
      initializeSession();
    }
  }, [sessionInitialized, initializeSession]);

  // Sync URL -> article state: load article when URL is /article/:contentId, clear when on /
  useEffect(() => {
    if (contentIdFromUrl) {
      setCurrentContentId(contentIdFromUrl);
      fetchHarmonizationData(contentIdFromUrl, hudmoFromUrl);
    } else {
      setHudmoData(null);
      setCurrentContentId(null);
    }
  }, [contentIdFromUrl, hudmoFromUrl, fetchHarmonizationData]);

  const handleChatToggle = async () => {
    const newIsOpen = !isChatOpen;

    if (newIsOpen && !sessionInitialized) {
      await initializeSession();
    }
    
    setIsChatOpen(newIsOpen);
  };

  return (
    <AppErrorBoundary>
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 relative overflow-hidden flex">
        {isArticleOpen && !isSearchPage && (
          <div className="w-64 border-r border-gray-200 bg-white flex-shrink-0">
            <TOC 
              onContentClick={handleTocContentClick}
              currentContentId={currentContentId}
              isVisible={isArticleOpen}
            />
          </div>
        )}
        <div className="flex-1 relative overflow-hidden">
          {isSearchPage ? (
            <SearchResultsPage />
          ) : isArticleOpen ? (
            hudmoData ? (
              <div className="flex flex-col md:flex-row h-full absolute inset-0">
                {/* Article View - Main Content */}
                <div className="flex-1 min-w-0 overflow-hidden order-2 md:order-1">
                  <ArticleErrorBoundary onClose={handleCloseArticle}>
                    <ArticleView data={hudmoData} onClose={handleCloseArticle} />
                  </ArticleErrorBoundary>
                </div>
                {/* Minimized Chat Widget - Right Side (hidden on mobile, shown on desktop) */}
                <div className="hidden md:block w-80 border-l border-gray-200 bg-white flex-shrink-0 overflow-hidden order-1 md:order-2">
                  <ChatWidget
                    messages={messages}
                    onMessageClick={handleMessageClick}
                    onSendMessage={handleSendMessage}
                    onDeleteSession={handleDeleteSession}
                    onStartNewSession={handleStartNewSession}
                    sessionInitialized={sessionInitialized}
                    isLoading={isLoading}
                    isOpen={true}
                    onToggle={handleChatToggle}
                    minimized={true}
                    fetchingHudmoFor={fetchingHudmoFor}
                    prefetchedHudmoData={prefetchedHudmoData}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full bg-white">
                <p className="text-gray-500">Loading article…</p>
              </div>
            )
          ) : (
          <WelcomeContent
            messages={messages}
            onMessageClick={handleMessageClick}
            onSendMessage={handleSendMessage}
            onDeleteSession={handleDeleteSession}
            onStartNewSession={handleStartNewSession}
            sessionInitialized={sessionInitialized}
            isLoading={isLoading}
            isOpen={isChatOpen}
            onToggle={handleChatToggle}
            fetchingHudmoFor={fetchingHudmoFor}
            prefetchedHudmoData={prefetchedHudmoData}
          />
          )}
        </div>
      </main>

      {/* Mobile Chat Toggle Button - Only show when article is open on mobile */}
      {isArticleOpen && (
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          <ChatWidget
            messages={messages}
            onMessageClick={handleMessageClick}
            onSendMessage={handleSendMessage}
            onDeleteSession={handleDeleteSession}
            onStartNewSession={handleStartNewSession}
            sessionInitialized={sessionInitialized}
            isLoading={isLoading}
            isOpen={isChatOpen}
            onToggle={handleChatToggle}
            fetchingHudmoFor={fetchingHudmoFor}
            prefetchedHudmoData={prefetchedHudmoData}
          />
        </div>
      )}

      <Footer />

    </div>
    </AppErrorBoundary>
  );
}

export default App;
