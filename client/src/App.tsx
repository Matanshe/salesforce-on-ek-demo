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
    console.error("ArticleErrorBoundary caught error:", error);
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

  // Debug: Log state changes
  useEffect(() => {
    console.log("🔍 State update - isArticleOpen:", isArticleOpen, "hudmoData:", !!hudmoData, "currentContentId:", currentContentId);
    if (hudmoData) {
      console.log("🔍 hudmoData structure:", {
        hasAttributes: !!hudmoData.attributes,
        hasContent: !!hudmoData.attributes?.content,
        hasTitle: !!hudmoData.attributes?.title,
        contentLength: hudmoData.attributes?.content?.length || 0,
      });
    }
  }, [isArticleOpen, hudmoData, currentContentId]);
  const [prefetchedHudmoData, setPrefetchedHudmoData] = useState<Map<string, HudmoData>>(new Map());
  const [fetchingHudmoFor, setFetchingHudmoFor] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>("salesforce");
  const [objectApiName, setObjectApiName] = useState<string>("SFDCHelp7_DMO_harmonized__dlm");
  const prefetchedHudmoDataRef = useRef(prefetchedHudmoData);
  prefetchedHudmoDataRef.current = prefetchedHudmoData;

  // Track if this is the initial load and previous customer ID
  const isInitialLoadRef = useRef(true);
  const previousCustomerIdRef = useRef<string | null>("salesforce");
  
  // Reset session when customer changes
  const handleCustomerChange = useCallback(async (customerId: string | null) => {
    const previousCustomerId = previousCustomerIdRef.current;
    console.log(`Customer changed from ${previousCustomerId} to: ${customerId} (initialLoad: ${isInitialLoadRef.current})`);
    
    // Only reset session state if customer actually changed (not on initial load)
    const customerChanged = previousCustomerId !== customerId && !isInitialLoadRef.current;
    
    setSelectedCustomerId(customerId);
    previousCustomerIdRef.current = customerId;
    
    // Fetch customer details to get objectApiName
    if (customerId) {
      try {
        const response = await fetch(`${API_URL}/api/v1/customers/${customerId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.customer?.objectApiName) {
            console.log(`Setting objectApiName to: ${data.customer.objectApiName} for customer: ${customerId}`);
            setObjectApiName(data.customer.objectApiName);
          } else {
            console.warn(`No objectApiName found for customer: ${customerId}`);
          }
        } else {
          const errorText = await response.text();
          console.error(`Failed to fetch customer details: ${response.status} ${response.statusText}`, errorText);
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    }
    
    // Reset session state only when customer actually changes (not on initial load)
    if (customerChanged) {
      console.log('Resetting session state due to customer change');
      setSessionInitialized(false);
      setAgentforceSessionId(null);
      setMessages([]);
      setMessageSequence(1);
      setPrefetchedHudmoData(new Map());
      setFetchingHudmoFor(new Set());
      setIsArticleOpen(false);
      setHudmoData(null);
      setCurrentContentId(null);
    } else {
      console.log('Initial load or same customer - skipping session reset');
      isInitialLoadRef.current = false;
    }
  }, []);

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
          customerId: selectedCustomerId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      setMessageSequence((prev) => prev + 1);

      const agentResponse = data.messages?.[0];
      console.log("this is the agent response:", data.messages?.[0]);
      console.log("Agent response citedReferences:", agentResponse?.citedReferences);
      
      // Check for URL_Redacted in agent response
      if (agentResponse?.message?.includes("URL_Redacted") || agentResponse?.message?.includes("(URL_Redacted)")) {
        console.log("⚠️ Found URL_Redacted in agent response message:", agentResponse.message);
        console.log("⚠️ But citedReferences might contain actual URLs:", agentResponse?.citedReferences);
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
      console.log("✅ Bot message added to messages, current message count:", messages.length + 1);
      console.log("✅ Bot message details:", {
        id: botMessage.id,
        sender: botMessage.sender,
        hasContent: !!botMessage.content,
        hasCitedReferences: !!botMessage.citedReferences && botMessage.citedReferences.length > 0,
        customerId: selectedCustomerId,
      });

      // Pre-fetch citation data if available - wrap in try-catch to prevent crashes
      try {
        console.log("🔍 Starting pre-fetch logic for bot message");
        // First try citedReferences (more reliable when URLs are redacted)
        if (botMessage.citedReferences && Array.isArray(botMessage.citedReferences) && botMessage.citedReferences.length > 0) {
          const firstCitation = botMessage.citedReferences[0];
          if (firstCitation && firstCitation.url) {
            try {
              const urlObj = new URL(firstCitation.url);
              let dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
              let hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
              
              // Override hudmo with current customer's objectApiName only if they don't match
              if (dccid && hudmo && objectApiName && hudmo !== objectApiName) {
                console.log(`Pre-fetch (citedReferences): Using objectApiName ${objectApiName} instead of ${hudmo} from URL`);
                hudmo = objectApiName;
              }
              
              if (dccid && hudmo) {
                console.log(`Pre-fetching from citedReferences: dccid=${dccid}, hudmo=${hudmo}`);
                fetchHarmonizationData(dccid, hudmo, botMessage.id, true).catch((err) => {
                  console.error("Error pre-fetching from citedReferences:", err);
                });
              }
            } catch (error) {
              console.log("Could not extract citation data from citedReferences for pre-fetch:", error);
            }
          }
        }
        
        // Fallback to extracting from message content
        const urls = botMessage.content.match(/(https?:\/\/[^\s)]+)/g) || [];
        if (urls.length > 0 && urls[0]) {
          try {
            const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
            const urlObj = new URL(cleanUrl);
            let dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
            let hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
            
            // Override hudmo with current customer's objectApiName only if they don't match
            if (dccid && hudmo && objectApiName && hudmo !== objectApiName) {
              console.log(`Pre-fetch (content): Using objectApiName ${objectApiName} instead of ${hudmo} from URL`);
              hudmo = objectApiName;
            }
            
            if (dccid && hudmo) {
              console.log(`Pre-fetching from content: dccid=${dccid}, hudmo=${hudmo}`);
              // Pre-fetch in background
              fetchHarmonizationData(dccid, hudmo, botMessage.id, true).catch((err) => {
                console.error("Error pre-fetching from content:", err);
              });
            }
          } catch (error) {
            // URL parsing failed, skip pre-fetch
            console.log("Could not extract citation data from content for pre-fetch:", error);
          }
        }
      } catch (error) {
        console.error("❌ Error in pre-fetch logic:", error);
        console.error("❌ Error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Don't crash the app if pre-fetch fails
      }
      console.log("✅ Pre-fetch logic completed");
    } catch (error) {
      console.error("❌ Error sending message:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

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
          customerId: selectedCustomerId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch harmonization data: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Validate response structure
      if (!result || !result.data) {
        console.error("❌ Invalid API response structure:", result);
        throw new Error("Invalid API response: missing data property");
      }
      
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
      
      // Validate that we have at least some content
      if (!result.data.attributes?.content && !result.data.attributes?.title) {
        console.warn("⚠️ API response has no content or title:", result.data);
      }

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
          console.log(`Article fetch result - has data: ${!!data}, has content: ${!!data?.attributes?.content}, has title: ${!!data?.attributes?.title}`);
          console.log(`Article fetch result - full data structure:`, JSON.stringify(data, null, 2));
          if (data && (data.attributes?.content != null || data.attributes?.title != null)) {
            console.log(`Setting hudmoData and opening article for customer: ${selectedCustomerId}`);
            console.log(`Data being set:`, JSON.stringify(data, null, 2));
            // Use setTimeout to ensure state updates happen in the right order
            setCurrentContentId(dccid);
            setHudmoData(data);
            setIsArticleOpen(true);
            console.log("✅ Successfully loaded harmonization data and opened article");
            console.log("✅ State after update - isArticleOpen should be true, hudmoData should be set");
          } else {
            console.warn("❌ get-hudmo returned no usable content:", result);
            console.warn("❌ Full result object:", JSON.stringify(result, null, 2));
            if (!prefetch) {
              alert(`Article could not be loaded. The API returned no content. Please check if the object "${hudmo}" and content ID "${dccid}" are correct for customer "${selectedCustomerId}".`);
            }
          }
        }
    } catch (error) {
      console.error("❌ Error fetching harmonization data:", error);
      console.error("❌ Error details:", {
        dccid,
        hudmo,
        customerId: selectedCustomerId,
        prefetch,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      if (!prefetch) {
        // Show error message to user if not a prefetch
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ Showing error alert to user:", errorMsg);
        alert(`Failed to load article. Please try again.\n\nError: ${errorMsg}\n\nCheck the browser console for more details.`);
        // Don't set article open state if there's an error
        setIsArticleOpen(false);
        setHudmoData(null);
        setCurrentContentId(null);
      }
      if (prefetch && messageId) {
        setFetchingHudmoFor((prev) => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
      }
    }
  }, [prefetchedHudmoData, fetchingHudmoFor, objectApiName, selectedCustomerId]);

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

      // Override hudmo with current customer's objectApiName only if they don't match
      // This ensures we use the correct object name for the selected customer
      if (dccid && hudmo && objectApiName && hudmo !== objectApiName) {
        console.log(`Using objectApiName ${objectApiName} instead of ${hudmo} from URL for customer ${selectedCustomerId}`);
        hudmo = objectApiName;
      }

      // If message has citation data, open article view and extract Q&A/summary
      if (dccid && hudmo) {
        console.log(`🔵 Opening article - dccid: ${dccid}, hudmo: ${hudmo}, objectApiName: ${objectApiName}, customerId: ${selectedCustomerId}`);
        console.log(`🔵 Setting state: setIsArticleOpen(true), setCurrentContentId(${dccid})`);
        console.log(`🔵 Current state before update - isArticleOpen: ${isArticleOpen}, hasHudmoData: ${!!hudmoData}`);
        setCurrentContentId(dccid);
        setIsArticleOpen(true); // Explicitly set article open state
        console.log(`🔵 State set - isArticleOpen should now be true, fetching data...`);
        fetchHarmonizationData(dccid, hudmo, message.id, false).catch((error) => {
          console.error("🔴 Error fetching harmonization data in handleMessageClick:", error);
          // Reset state on error
          setIsArticleOpen(false);
          setHudmoData(null);
          setCurrentContentId(null);
        });
      } else {
        console.warn("Missing citation data - dccid:", dccid, "hudmo:", hudmo, "objectApiName:", objectApiName);
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
    if (!objectApiName) {
      console.error('objectApiName is not set, cannot fetch harmonization data');
      return;
    }
    fetchHarmonizationData(contentId, objectApiName);
  }, [fetchHarmonizationData, objectApiName]);

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
      const customerParam = selectedCustomerId ? `&customerId=${encodeURIComponent(selectedCustomerId)}` : '';

      console.log("Initializing new Agentforce session...");

      const { timestamp, signature } = await generateSignature(
        "GET",
        `/api/v1/start-session?sessionId=${newSessionKey}${customerParam}`
      );

      const response = await fetch(`${API_URL}/api/v1/start-session?sessionId=${newSessionKey}${customerParam}`, {
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
      console.log("Agent ID:", data.agentId ?? "not provided");
      console.log("Customer ID:", selectedCustomerId);

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
    if (sessionInitialized || !selectedCustomerId) return;

    setIsLoading(true);

    try {
      console.log("Initializing Agentforce session...");
      const customerParam = selectedCustomerId ? `&customerId=${encodeURIComponent(selectedCustomerId)}` : '';

      const { timestamp, signature } = await generateSignature(
        "GET",
        `/api/v1/start-session?sessionId=${externalSessionKey}${customerParam}`
      );

      const response = await fetch(`${API_URL}/api/v1/start-session?sessionId=${externalSessionKey}${customerParam}`, {
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
      console.log("Agent ID:", data.agentId ?? "not provided");
      console.log("Customer ID:", selectedCustomerId);
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
  }, [externalSessionKey, sessionInitialized, selectedCustomerId]);

  // Auto-initialize session when on welcome page and customer is selected
  // Initialize objectApiName when selectedCustomerId changes
  useEffect(() => {
    const loadCustomerObjectApiName = async () => {
      if (selectedCustomerId) {
        try {
          const response = await fetch(`${API_URL}/api/v1/customers/${selectedCustomerId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.customer?.objectApiName) {
              console.log(`Setting objectApiName to: ${data.customer.objectApiName} for customer: ${selectedCustomerId}`);
              setObjectApiName(data.customer.objectApiName);
            } else {
              console.warn(`No objectApiName found for customer: ${selectedCustomerId}`);
            }
          } else {
            const errorText = await response.text();
            console.error(`Failed to fetch customer details: ${response.status} ${response.statusText}`, errorText);
          }
        } catch (error) {
          console.error('Error fetching customer objectApiName:', error);
        }
      }
    };
    
    loadCustomerObjectApiName();
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!sessionInitialized && selectedCustomerId) {
      console.log(`Initializing session for customer: ${selectedCustomerId}`);
      initializeSession().catch((error) => {
        console.error(`Error initializing session for ${selectedCustomerId}:`, error);
      });
    }
  }, [sessionInitialized, initializeSession, selectedCustomerId]);

  const handleChatToggle = async () => {
    const newIsOpen = !isChatOpen;

    if (newIsOpen && !sessionInitialized && selectedCustomerId) {
      await initializeSession();
    }
    
    setIsChatOpen(newIsOpen);
  };

  // Add error boundary for the entire app
  if (!selectedCustomerId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading customer configuration...</p>
        </div>
      </div>
    );
  }

  // Debug logging for rendering state
  console.log("🔍 App render state:", {
    isArticleOpen,
    hasHudmoData: !!hudmoData,
    hudmoDataStructure: hudmoData ? {
      hasAttributes: !!hudmoData.attributes,
      hasContent: !!hudmoData.attributes?.content,
      hasTitle: !!hudmoData.attributes?.title,
      contentLength: hudmoData.attributes?.content?.length || 0,
    } : null,
    currentContentId,
    objectApiName,
    selectedCustomerId,
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Debug indicator - always visible */}
      <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black text-xs p-1 z-50 text-center">
        DEBUG: App rendering - Customer: {selectedCustomerId || 'none'} | Article Open: {String(isArticleOpen)} | Has Data: {String(!!hudmoData)}
      </div>
      <div className="pt-6"> {/* Add padding to account for debug bar */}
      <Header onCustomerChange={handleCustomerChange} />

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
        <div className="flex-1 relative overflow-hidden bg-gray-100" style={{ minHeight: '100vh', position: 'relative' }}>
          {(() => {
            console.log("🔍 Rendering main content area:", { isArticleOpen, hasHudmoData: !!hudmoData });
            if (isArticleOpen) {
              if (hudmoData) {
                console.log("🔍 Rendering article view with data");
                return (
                  <div className="flex flex-col md:flex-row h-full w-full bg-white" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
                    {/* Article View - Main Content */}
                    <div className="flex-1 min-w-0 overflow-hidden order-2 md:order-1 bg-white" style={{ minHeight: '100%' }}>
                      <ArticleErrorBoundary onClose={handleCloseArticle}>
                        {hudmoData && hudmoData.attributes ? (
                          <ArticleView data={hudmoData} onClose={handleCloseArticle} customerId={selectedCustomerId} />
                        ) : (
                          <div className="flex items-center justify-center h-full p-8 bg-yellow-50">
                            <div className="text-center">
                              <p className="text-gray-600 mb-4">Invalid article data</p>
                              <p className="text-sm text-gray-500">hudmoData: {JSON.stringify(hudmoData, null, 2)}</p>
                            </div>
                          </div>
                        )}
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
                );
              } else {
                console.log("🔍 Rendering loading state (no hudmoData)");
                return (
                  <div className="flex items-center justify-center h-full bg-white" style={{ minHeight: '100vh' }}>
                    <div className="text-center p-8">
                      <p className="text-gray-600 mb-4">Loading article...</p>
                      <p className="text-sm text-gray-500 mb-2">objectApiName: {objectApiName || "not set"}</p>
                      <p className="text-sm text-gray-500 mb-2">currentContentId: {currentContentId || "not set"}</p>
                      <p className="text-sm text-gray-500 mb-4">isArticleOpen: {String(isArticleOpen)}</p>
                      <p className="text-sm text-gray-500">hudmoData: {hudmoData ? "exists" : "null"}</p>
                    </div>
                  </div>
                );
              }
            } else {
              console.log("🔍 Rendering welcome content (article not open)");
              return (
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
              );
            }
          })()}
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
      </div> {/* Close padding div */}
    </div>
  );
}

export default App;
