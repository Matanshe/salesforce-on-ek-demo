import { type ErrorInfo, type ReactNode, Component, useState, useCallback, useEffect, useRef } from "react";
import type { Message } from "./types/message";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { WelcomeContent } from "./components/content/WelcomeContent";
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-white">
          <p className="text-gray-700 mb-4">Something went wrong opening the document.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-[#0176D3] underline"
          >
            Try again
          </button>
          <button type="button" onClick={this.props.onClose} className="mt-2 text-gray-600 underline">
            Close
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [messageSequence, setMessageSequence] = useState(1);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [agentforceSessionId, setAgentforceSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hudmoData, setHudmoData] = useState<HudmoData | null>(null);
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);
  const [prefetchedHudmoData, setPrefetchedHudmoData] = useState<Map<string, HudmoData>>(new Map());
  const [fetchingHudmoFor, setFetchingHudmoFor] = useState<Set<string>>(new Set());
  const prefetchedHudmoDataRef = useRef(prefetchedHudmoData);
  prefetchedHudmoDataRef.current = prefetchedHudmoData;

  const OBJECT_API_NAME = "SFDCHelp7_DMO_harmonized__dlm";

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
      console.log("this is the agent response:", data.messages?.[0]);
      
      // Check for URL_Redacted in agent response
      if (agentResponse?.message?.includes("URL_Redacted") || agentResponse?.message?.includes("(URL_Redacted)")) {
        console.log("⚠️ Found URL_Redacted in agent response message:", agentResponse.message);
      }

      if (!agentResponse) {
        throw new Error("No message received from agent");
      }

      const botMessage: Message = {
        id: agentResponse.id || `msg-${Date.now()}-bot`,
        content: agentResponse.message || "Response received",
        timestamp: new Date(),
        sender: "bot",
        type: agentResponse.type,
        feedbackId: agentResponse.feedbackId,
        isContentSafe: agentResponse.isContentSafe,
        message: agentResponse.message,
        metrics: agentResponse.metrics,
        planId: agentResponse.planId,
        result: agentResponse.result,
        citedReferences: agentResponse.citedReferences,
      };

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
        setIsArticleOpen(true);
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

      // Update message with Q&A, summary, and title when we have the get-hudmo response
      if (messageId && (qa || summary || articleTitle)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, qa, summary, articleTitle }
              : msg
          )
        );
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
          setIsArticleOpen(true);
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

      // If message has citation data, open article view and extract Q&A/summary
          if (dccid && hudmo) {
            setCurrentContentId(dccid);
            fetchHarmonizationData(dccid, hudmo, message.id, false);
          }
    }
  };

  const handleCloseArticle = () => {
    setIsArticleOpen(false);
    setHudmoData(null);
    setCurrentContentId(null);
  };

  const handleTocContentClick = useCallback((contentId: string) => {
    // Load content using content ID as dccid
    fetchHarmonizationData(contentId, OBJECT_API_NAME);
  }, [fetchHarmonizationData]);

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
        const welcomeMessage: Message = {
          id: data.messages[0].id || `msg-${Date.now()}-welcome`,
          content: data.messages[0].message || "Hi, I'm Agentforce on EK. How can I help you?",
          timestamp: new Date(),
          sender: "bot",
          type: data.messages[0].type,
          feedbackId: data.messages[0].feedbackId,
          isContentSafe: data.messages[0].isContentSafe,
          message: data.messages[0].message,
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
        const welcomeMessage: Message = {
          id: data.messages[0].id || `msg-${Date.now()}-welcome`,
          content: data.messages[0].message || "Hi, I'm Agentforce on EK. How can I help you?",
          timestamp: new Date(),
          sender: "bot",
          type: data.messages[0].type,
          feedbackId: data.messages[0].feedbackId,
          isContentSafe: data.messages[0].isContentSafe,
          message: data.messages[0].message,
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

  const handleChatToggle = async () => {
    const newIsOpen = !isChatOpen;

    if (newIsOpen && !sessionInitialized) {
      await initializeSession();
    }
    
    setIsChatOpen(newIsOpen);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 relative overflow-hidden flex">
        {isArticleOpen && (
          <div className="w-64 border-r border-gray-200 bg-white flex-shrink-0">
            <TOC 
              onContentClick={handleTocContentClick}
              currentContentId={currentContentId}
              isVisible={isArticleOpen}
            />
          </div>
        )}
        <div className="flex-1 relative overflow-hidden">{isArticleOpen && hudmoData ? (
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
  );
}

export default App;
