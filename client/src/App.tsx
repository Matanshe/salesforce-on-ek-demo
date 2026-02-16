import { type ErrorInfo, type ReactNode, Component, useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams, useParams } from "react-router-dom";
import type { Message, ChunkRow, CitationHoverCardData } from "./types/message";
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
import { EmbedChatToggle } from "./components/chat/EmbedChatToggle";
import { ArticleView } from "./components/content/ArticleView";
import { CitationModal } from "./components/content/CitationModal";
import { generateSignature } from "./utils/requestSigner";
import TOC from "./components/TOC";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CustomerRouteProvider } from "./contexts/CustomerRouteContext";
import { citationBehavior, embedLayout } from "./config/appConfig";
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
                <DialogTitle className="text-[var(--theme-primary)]">Document error</DialogTitle>
                <DialogDescription className="text-gray-600 pt-1">
                  {message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4 gap-2">
                <Button onClick={this.handleCloseDialog} variant="outline">
                  Try again
                </Button>
                <Button onClick={this.props.onClose} className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)]">
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
            <Header customers={[]} />
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
                <DialogTitle className="text-[var(--theme-primary)]">Something went wrong</DialogTitle>
                <DialogDescription className="text-gray-600 pt-1">
                  {message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4">
                <Button onClick={this.handleClose} className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)]">
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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
      updatedAt?: string;
      "DC.Type"?: string;
      originalFormat?: string;
      source?: string;
      [key: string]: unknown;
    };
    qa?: Array<{ question?: string; answer?: string }>;
    summary?: string;
  };
}

/** Build hover card data from hudmo API response (and optional chunk text). */
function buildHoverCardData(
  hudmoData: HudmoData | undefined,
  chunkText?: string
): CitationHoverCardData {
  const attrs = hudmoData?.attributes;
  const meta = attrs?.metadata as Record<string, unknown> | undefined;
  const updatedAt = meta?.updatedAt;
  const lastUpdated =
    typeof updatedAt === "string"
      ? (() => {
          const d = new Date(updatedAt);
          return Number.isNaN(d.getTime()) ? updatedAt : d.toLocaleString();
        })()
      : null;
  const dcType = meta?.["DC.Type"];
  const sourceLabel =
    typeof meta?.source === "string" ? `Document ${meta.source}` : "Document";
  return {
    title: attrs?.title ?? null,
    sourceUrl: (meta?.sourceUrl as string) ?? null,
    summary: attrs?.summary ?? null,
    chunkPreview: (chunkText?.trim() || null) ?? null,
    lastUpdated: lastUpdated ?? null,
    originalFormat:
      (typeof dcType === "string" ? dcType : null) ??
      (typeof meta?.originalFormat === "string" ? meta.originalFormat : null) ??
      null,
    originalContentType: sourceLabel,
    source: (meta?.source as string) ?? null,
  };
}

/** Build article URL query string (hudmo + optional chunk params). */
function buildArticleQuery(params: {
  hudmo: string;
  objectApiName: string;
  chunkObjectApiName?: string | null;
  chunkRecordIds?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params.hudmo !== params.objectApiName) {
    search.set("hudmo", params.hudmo);
  }
  if (params.chunkObjectApiName) {
    search.set("chunkObjectApiName", params.chunkObjectApiName);
  }
  if (params.chunkRecordIds) {
    search.set("chunkRecordIds", params.chunkRecordIds);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Path pattern for article URLs: /:customerId/article/:contentId */
const ARTICLE_PATH_REGEX = /^\/[^/]+\/article\/([^/?#]+)/;

interface CustomerItem {
  id: string;
  name: string;
}

function App() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const selectedCustomerId = customerIdParam && !customerNotFound ? customerIdParam : null;
  const basePath = selectedCustomerId ? `/${encodeURIComponent(selectedCustomerId)}` : "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(() => !embedLayout);
  const [messageSequence, setMessageSequence] = useState(1);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [agentforceSessionId, setAgentforceSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hudmoData, setHudmoData] = useState<HudmoData | null>(null);
  const [chunkRows, setChunkRows] = useState<ChunkRow[]>([]);
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);
  const [prefetchedHudmoData, setPrefetchedHudmoData] = useState<Map<string, HudmoData>>(new Map());
  const [fetchingHudmoFor, setFetchingHudmoFor] = useState<Set<string>>(new Set());
  const [objectApiName, setObjectApiName] = useState<string>("SFDCHelp7_DMO_harmonized__dlm");
  const [tocUrl, setTocUrl] = useState<string | null>(null);
  const prefetchedHudmoDataRef = useRef(prefetchedHudmoData);
  prefetchedHudmoDataRef.current = prefetchedHudmoData;
  const chunkParamsByMessageIdRef = useRef<Record<string, { chunkObjectApiName: string; chunkRecordIds: string }>>({});

  const [citationModalData, setCitationModalData] = useState<{
    hudmoData: HudmoData;
    chunkRows: ChunkRow[];
    articleTitle: string | null;
    contentId: string;
  } | null>(null);
  const [chunkPreviewByMessageId, setChunkPreviewByMessageId] = useState<Record<string, string>>({});
  const [hoverCardDataByMessageId, setHoverCardDataByMessageId] = useState<Record<string, CitationHoverCardData | null>>({});
  const [activeHoverCitationMessageId, setActiveHoverCitationMessageId] = useState<string | null>(null);
  const citationCardHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CITATION_CARD_HIDE_DELAY_MS = 300;

  const onCitationHoverChange = useCallback((messageId: string | null) => {
    if (citationCardHideTimeoutRef.current) {
      clearTimeout(citationCardHideTimeoutRef.current);
      citationCardHideTimeoutRef.current = null;
    }
    setActiveHoverCitationMessageId(messageId);
  }, []);

  const onCitationHoverScheduleHide = useCallback(() => {
    if (citationCardHideTimeoutRef.current) {
      clearTimeout(citationCardHideTimeoutRef.current);
      citationCardHideTimeoutRef.current = null;
    }
    citationCardHideTimeoutRef.current = setTimeout(() => {
      citationCardHideTimeoutRef.current = null;
      setActiveHoverCitationMessageId(null);
    }, CITATION_CARD_HIDE_DELAY_MS);
  }, []);

  const onCitationHoverCancelHide = useCallback(() => {
    if (citationCardHideTimeoutRef.current) {
      clearTimeout(citationCardHideTimeoutRef.current);
      citationCardHideTimeoutRef.current = null;
    }
  }, []);

  // Fetch customers list for header links and validation
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { customers?: CustomerItem[] } | null) => {
        if (!cancelled && data?.customers) setCustomers(data.customers);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Validate customerId from URL; reset session when switching customer
  useEffect(() => {
    if (!customerIdParam) return;
    if (customers.length === 0) return; // wait until customers loaded
    const valid = customers.some((c) => c.id === customerIdParam);
    setCustomerNotFound(!valid);
    if (valid) {
      setSessionInitialized(false);
      setAgentforceSessionId(null);
      setMessages([]);
      setMessageSequence(1);
      setPrefetchedHudmoData(new Map());
      setFetchingHudmoFor(new Set());
      setHudmoData(null);
      setCurrentContentId(null);
    }
  }, [customerIdParam, customers]);

  // Derive article state from URL (support /article/:id and Lightning-style ?c__contentId=...)
  const articleMatch = location.pathname.match(ARTICLE_PATH_REGEX);
  const contentIdFromPath = articleMatch ? articleMatch[1] : null;
  const contentIdFromSearch = searchParams.get("c__contentId");
  const contentIdFromUrl = contentIdFromPath ?? contentIdFromSearch ?? null;
  const hudmoFromUrl = contentIdFromUrl
    ? searchParams.get("hudmo") || searchParams.get("c__objectApiName") || objectApiName
    : objectApiName;
  const chunkObjectApiNameFromUrl = contentIdFromUrl
    ? searchParams.get("chunkObjectApiName") ?? searchParams.get("c__chunkObjectApiName") ?? null
    : null;
  const chunkRecordIdsFromUrl = contentIdFromUrl
    ? searchParams.get("chunkRecordIds") ?? searchParams.get("c__chunkRecordIds") ?? null
    : null;
  const isArticleOpen = !!contentIdFromUrl;
  const isSearchPage = location.pathname.endsWith("/search");

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

      // #region agent log
      const _keys = data ? Object.keys(data) : [];
      const _msgs = data?.messages;
      const _first = _msgs?.[0];
      fetch('http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:handleSendMessage',message:'client received sendMessage response',data:{responseKeys:_keys,messagesLength:Array.isArray(_msgs)?_msgs.length:null,firstMessageKeys:_first?Object.keys(_first):null,hasMessageText:!!_first?.message,citedRefsCount:_first?.citedReferences?.length??null},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      fetch('http://127.0.0.1:7242/ingest/bebf9a71-04a2-4e86-a513-895cda001ee7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:first message',message:'first message content',data:{firstType:_first?.type,hasContent:!!_first?.message},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
      // #endregion

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
      console.log("✅ Bot message added to messages, current message count:", messages.length + 1);
      console.log("✅ Bot message details:", {
        id: botMessage.id,
        sender: botMessage.sender,
        hasContent: !!botMessage.content,
        hasCitedReferences: !!botMessage.citedReferences && botMessage.citedReferences.length > 0,
        customerId: selectedCustomerId,
      });

      // Pre-fetch citation data: get URL from message content or from citedReferences
      let citationUrl: string | null = null;
      const contentUrls = botMessage.content.match(/(https?:\/\/[^\s)]+)/g) || [];
      if (contentUrls.length > 0 && contentUrls[0]) {
        citationUrl = contentUrls[0].replace(/[).,;!?]+$/, "");
      } else if (Array.isArray(botMessage.citedReferences) && botMessage.citedReferences.length > 0) {
        const refUrl = botMessage.citedReferences[0]?.url;
        if (typeof refUrl === "string") citationUrl = refUrl;
      }
      if (citationUrl) {
        try {
          const urlObj = new URL(citationUrl);
          let dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
          let hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
          if (dccid && hudmo && objectApiName && hudmo !== objectApiName) {
            hudmo = objectApiName;
          }
          const chunkObjectApiName = urlObj.searchParams.get("c__chunkObjectApiName");
          const chunkRecordIds = urlObj.searchParams.get("c__chunkRecordIds");
          const prefetchChunkParams =
            chunkObjectApiName && chunkRecordIds
              ? { chunkObjectApiName, chunkRecordIds }
              : undefined;
          if (dccid && hudmo) {
            if (prefetchChunkParams && chunkObjectApiName && chunkRecordIds) {
              chunkParamsByMessageIdRef.current[botMessage.id] = {
                chunkObjectApiName,
                chunkRecordIds,
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMessage.id
                    ? { ...m, dccid, hudmo, chunkObjectApiName: chunkObjectApiName ?? undefined, chunkRecordIds: chunkRecordIds ?? undefined }
                    : m
                )
              );
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === botMessage.id ? { ...m, dccid, hudmo } : m))
              );
            }
            fetchHarmonizationData(dccid, hudmo, botMessage.id, true, prefetchChunkParams);
          }
        } catch (error) {
          console.log("Could not extract citation data for pre-fetch:", error);
        }
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

  const fetchHarmonizationData = useCallback(
    async (
      dccid: string,
      hudmo: string,
      messageId?: string,
      prefetch = false,
      chunkParams?: { chunkObjectApiName: string; chunkRecordIds: string }
    ) => {
      console.log("[chunk] fetchHarmonizationData called: dccid=" + dccid + " prefetch=" + prefetch + " chunkParams=" + (chunkParams ? JSON.stringify({ chunkObjectApiName: chunkParams.chunkObjectApiName, chunkRecordIdsLen: chunkParams.chunkRecordIds?.length }) : "none"));
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
          if (!chunkParams) {
            setChunkRows([]);
            return;
          }
          // With chunk params, still fetch chunk rows then return
          try {
            console.log("[chunk] Cache hit with chunk params; fetching get-chunks:", chunkParams.chunkObjectApiName, chunkParams.chunkRecordIds?.slice(0, 50));
            const { timestamp: ts2, signature: sig2 } = await generateSignature("POST", "/api/v1/get-chunks");
            const chunksRes = await fetch(`${API_URL}/api/v1/get-chunks`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Timestamp": ts2,
                "X-Signature": sig2,
              },
              body: JSON.stringify({
                chunkObjectApiName: chunkParams.chunkObjectApiName,
                chunkRecordIds: chunkParams.chunkRecordIds,
              }),
            });
            if (chunksRes.ok) {
              const chunksResult = await chunksRes.json();
              const rawRows = chunksResult?.chunkRows ?? chunksResult?.data?.chunkRows;
              const rows: ChunkRow[] = Array.isArray(rawRows)
                ? rawRows.map((r: ChunkRow & Record<string, unknown> | unknown[]) => {
                    const row = r as ChunkRow & Record<string, unknown>;
                    let chunk = typeof row.Chunk__c === "string" ? row.Chunk__c : typeof row.chunk__c === "string" ? row.chunk__c : "";
                    if (!chunk && Array.isArray(r) && (r as unknown[]).length >= 2) {
                      const arr = r as unknown[];
                      if (typeof arr[2] === "string") chunk = arr[2];
                      else if (typeof arr[1] === "string") chunk = arr[1];
                    }
                    const cit = row.Citation__c ?? row.citation__c;
                    return {
                      Chunk__c: chunk,
                      Citation__c: cit == null || typeof cit === "string" ? cit : null,
                    };
                  })
                : [];
              setChunkRows(rows);
              console.log("[chunk] get-chunks (cache path) returned", rows.length, "chunk(s); sample length:", rows[0]?.Chunk__c?.length ?? 0);
            } else {
              setChunkRows([]);
              console.warn("[chunk] get-chunks (cache path) failed:", chunksRes.status);
            }
          } catch (e) {
            setChunkRows([]);
            console.warn("[chunk] get-chunks (cache path) error:", e);
          }
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

        let rows: ChunkRow[] = [];
        const shouldFetchChunks = chunkParams?.chunkObjectApiName && chunkParams?.chunkRecordIds;
        if (shouldFetchChunks) {
          try {
            console.log("[chunk] Fetching get-chunks:", chunkParams.chunkObjectApiName, "ids:", chunkParams.chunkRecordIds?.slice(0, 80));
            const { timestamp: ts2, signature: sig2 } = await generateSignature("POST", "/api/v1/get-chunks");
            const chunksRes = await fetch(`${API_URL}/api/v1/get-chunks`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Timestamp": ts2,
                "X-Signature": sig2,
              },
              body: JSON.stringify({
                chunkObjectApiName: chunkParams.chunkObjectApiName,
                chunkRecordIds: chunkParams.chunkRecordIds,
              }),
            });
            if (chunksRes.ok) {
              const chunksResult = await chunksRes.json();
              const rawRows = chunksResult?.chunkRows ?? chunksResult?.data?.chunkRows;
              rows = Array.isArray(rawRows)
                ? rawRows.map((r: ChunkRow & Record<string, unknown> | unknown[]) => {
                    const row = r as ChunkRow & Record<string, unknown>;
                    let chunk = typeof row.Chunk__c === "string" ? row.Chunk__c : typeof row.chunk__c === "string" ? row.chunk__c : "";
                    if (!chunk && Array.isArray(r) && (r as unknown[]).length >= 2) {
                      const arr = r as unknown[];
                      if (typeof arr[2] === "string") chunk = arr[2];
                      else if (typeof arr[1] === "string") chunk = arr[1];
                    }
                    const cit = row.Citation__c ?? row.citation__c;
                    return {
                      Chunk__c: chunk,
                      Citation__c: cit == null || typeof cit === "string" ? cit : null,
                    };
                  })
                : [];
              console.log("[chunk] get-chunks returned", rows.length, "chunk(s); sample Chunk__c length:", rows[0]?.Chunk__c?.length ?? 0);
            } else {
              console.warn("[chunk] get-chunks failed:", chunksRes.status, await chunksRes.text().catch(() => ""));
            }
          } catch (chunkErr) {
            console.warn("[chunk] get-chunks error:", chunkErr);
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
          // Pre-fetch chunk text for hover preview (modal mode)
          if (messageId && shouldFetchChunks && rows.length > 0) {
            const firstChunk = rows[0];
            const chunkText: string =
              typeof firstChunk?.Chunk__c === "string"
                ? firstChunk.Chunk__c
                : typeof (firstChunk as Record<string, unknown>)?.chunk__c === "string"
                  ? String((firstChunk as Record<string, unknown>).chunk__c)
                  : "";
            if (chunkText.trim()) {
              setChunkPreviewByMessageId((prev) => ({ ...prev, [messageId]: chunkText }));
            }
          }
        } else {
          // Open article only if we have valid data
          const data = result?.data;
          if (data && (data.attributes?.content != null || data.attributes?.title != null)) {
            setHudmoData(data);
            setCurrentContentId(dccid);
            setChunkRows(chunkParams ? rows : []);
            if (chunkParams) {
              console.log("[chunk] Article opened with chunkRows:", rows.length, "(will highlight in ArticleView)");
            }
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
    },
    [prefetchedHudmoData, fetchingHudmoFor, selectedCustomerId, navigate]
  );

  const fetchForCitationModal = useCallback(
    async (
      dccid: string,
      hudmo: string,
      chunkParams?: { chunkObjectApiName: string; chunkRecordIds: string }
    ): Promise<{ hudmoData: HudmoData; chunkRows: ChunkRow[]; articleTitle: string | null } | null> => {
      try {
        const { timestamp, signature } = await generateSignature("POST", "/api/v1/get-hudmo");
        const response = await fetch(`${API_URL}/api/v1/get-hudmo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
          },
          body: JSON.stringify({ hudmoName: hudmo, dccid }),
        });
        if (!response.ok) return null;
        const result = await response.json();
        const data = result?.data;
        if (!data || (data.attributes?.content == null && data.attributes?.title == null)) return null;

        let rows: ChunkRow[] = [];
        if (chunkParams?.chunkObjectApiName && chunkParams?.chunkRecordIds) {
          const { timestamp: ts2, signature: sig2 } = await generateSignature("POST", "/api/v1/get-chunks");
          const chunksRes = await fetch(`${API_URL}/api/v1/get-chunks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Timestamp": ts2, "X-Signature": sig2 },
            body: JSON.stringify({
              chunkObjectApiName: chunkParams.chunkObjectApiName,
              chunkRecordIds: chunkParams.chunkRecordIds,
            }),
          });
          if (chunksRes.ok) {
            const chunksResult = await chunksRes.json();
            const rawRows = chunksResult?.chunkRows ?? chunksResult?.data?.chunkRows;
            rows = Array.isArray(rawRows)
              ? rawRows.map((r: ChunkRow & Record<string, unknown>) => {
                  const cit = r.Citation__c ?? r.citation__c;
                  return {
                    Chunk__c: typeof r.Chunk__c === "string" ? r.Chunk__c : typeof r.chunk__c === "string" ? r.chunk__c : "",
                    Citation__c: cit == null || typeof cit === "string" ? cit : null,
                  };
                })
              : [];
          }
        }

        const articleTitle = data?.attributes?.title ?? null;
        return { hudmoData: data, chunkRows: rows, articleTitle };
      } catch (e) {
        console.warn("[citation modal] fetch error:", e);
        return null;
      }
    },
    []
  );

  const handleMessageClick = (message: Message) => {
    if (message.sender === "bot") {
      let dccid: string | null = message.dccid || null;
      let hudmo: string | null = message.hudmo || null;
      let chunkObjectApiName: string | null = message.chunkObjectApiName ?? null;
      let chunkRecordIds: string | null = message.chunkRecordIds ?? null;

      const urls = message.content.match(/(https?:\/\/[^\s)]+)/g) || [];
      if (urls.length > 0 && urls[0]) {
        try {
          const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
          const urlObj = new URL(cleanUrl);
          if (!dccid) dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
          if (!hudmo) hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
          if (!chunkObjectApiName) chunkObjectApiName = urlObj.searchParams.get("c__chunkObjectApiName");
          if (!chunkRecordIds) chunkRecordIds = urlObj.searchParams.get("c__chunkRecordIds");
        } catch (error) {
          console.error("Error extracting citation data:", error);
        }
      }
      const fromRef = chunkParamsByMessageIdRef.current[message.id];
      if (!chunkObjectApiName && fromRef) chunkObjectApiName = fromRef.chunkObjectApiName;
      if (!chunkRecordIds && fromRef) chunkRecordIds = fromRef.chunkRecordIds;

      if (dccid && hudmo && objectApiName && hudmo !== objectApiName) {
        hudmo = objectApiName;
      }

      if (!dccid || !hudmo) return;

      const chunkParams =
        chunkObjectApiName && chunkRecordIds
          ? { chunkObjectApiName, chunkRecordIds }
          : undefined;

      if (citationBehavior === "modal") {
        fetchForCitationModal(dccid, hudmo, chunkParams).then((result) => {
          if (result) {
            setCitationModalData({ ...result, contentId: dccid });
            setActiveHoverCitationMessageId(null);
            const firstChunk = result.chunkRows[0];
            const chunkText: string =
              typeof firstChunk?.Chunk__c === "string"
                ? firstChunk.Chunk__c
                : typeof (firstChunk as Record<string, unknown>)?.chunk__c === "string"
                  ? String((firstChunk as Record<string, unknown>).chunk__c)
                  : "";
            if (message.id && chunkText.trim()) {
              setChunkPreviewByMessageId((prev) => ({ ...prev, [message.id]: chunkText }));
            }
            if (message.id) {
              const cardData = buildHoverCardData(result.hudmoData, chunkText);
              setHoverCardDataByMessageId((prev) => ({ ...prev, [message.id]: cardData }));
            }
          }
        });
        return;
      }

      const query = buildArticleQuery({
        hudmo,
        objectApiName,
        chunkObjectApiName: chunkObjectApiName ?? undefined,
        chunkRecordIds: chunkRecordIds ?? undefined,
      });
      if (chunkObjectApiName && chunkRecordIds) {
        console.log("[chunk] Message click: chunk params from URL ->", chunkObjectApiName, chunkRecordIds?.slice(0, 50));
      }
      navigate(`${basePath}/article/${encodeURIComponent(dccid)}${query}`);
      fetchHarmonizationData(dccid, hudmo, message.id, false, chunkParams);
    }
  };

  const handleHoverCitation = useCallback(
    (message: Message) => {
      if (citationBehavior !== "modal" || !message.id) return;
      if (hoverCardDataByMessageId[message.id]) return;

      let dccid: string | null = message.dccid || null;
      let hudmo: string | null = message.hudmo || null;
      let chunkObjectApiName: string | null = message.chunkObjectApiName ?? null;
      let chunkRecordIds: string | null = message.chunkRecordIds ?? null;
      const urls = message.content.match(/(https?:\/\/[^\s)]+)/g) || [];
      if (urls.length > 0 && urls[0]) {
        try {
          const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
          const urlObj = new URL(cleanUrl);
          if (!dccid) dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId");
          if (!hudmo) hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName");
          if (!chunkObjectApiName) chunkObjectApiName = urlObj.searchParams.get("c__chunkObjectApiName");
          if (!chunkRecordIds) chunkRecordIds = urlObj.searchParams.get("c__chunkRecordIds");
        } catch {
          // ignore
        }
      }
      const fromRef = chunkParamsByMessageIdRef.current[message.id];
      if (!chunkObjectApiName && fromRef) chunkObjectApiName = fromRef.chunkObjectApiName;
      if (!chunkRecordIds && fromRef) chunkRecordIds = fromRef.chunkRecordIds;
      if (!dccid || !hudmo) return;

      const cacheKey = `${dccid}-${hudmo}`;
      const prefetched = prefetchedHudmoDataRef.current.get(cacheKey);
      if (prefetched) {
        const cardData = buildHoverCardData(prefetched);
        setHoverCardDataByMessageId((prev) => ({ ...prev, [message.id]: cardData }));
        const existingChunk = chunkPreviewByMessageId[message.id];
        if (!existingChunk && cardData.chunkPreview) {
          setChunkPreviewByMessageId((prev) => ({ ...prev, [message.id]: cardData.chunkPreview ?? "" }));
        }
        return;
      }

      const chunkParams =
        chunkObjectApiName && chunkRecordIds
          ? { chunkObjectApiName, chunkRecordIds }
          : undefined;

      fetchForCitationModal(dccid, hudmo, chunkParams).then((result) => {
        if (result && message.id) {
          const firstChunk = result.chunkRows[0];
          const chunkText: string =
            typeof firstChunk?.Chunk__c === "string"
              ? firstChunk.Chunk__c
              : typeof (firstChunk as Record<string, unknown>)?.chunk__c === "string"
                ? String((firstChunk as Record<string, unknown>).chunk__c)
                : "";
          if (chunkText.trim()) {
            setChunkPreviewByMessageId((prev) => ({ ...prev, [message.id]: chunkText }));
          }
          const cardData = buildHoverCardData(result.hudmoData, chunkText);
          setHoverCardDataByMessageId((prev) => ({ ...prev, [message.id]: cardData }));
        }
      });
    },
    [citationBehavior, hoverCardDataByMessageId, chunkPreviewByMessageId, fetchForCitationModal]
  );

  const handleCloseArticle = () => {
    navigate(basePath, { replace: true });
    setHudmoData(null);
    setChunkRows([]);
    setCurrentContentId(null);
  };

  const handleTocContentClick = useCallback(
    (contentId: string) => {
      const hudmoQuery = objectApiName ? `?hudmo=${encodeURIComponent(objectApiName)}` : "";
      navigate(`${basePath}/article/${encodeURIComponent(contentId)}${hudmoQuery}`);
    },
    [navigate, objectApiName, basePath]
  );

  const handleCitationTocContentClick = useCallback(
    (contentId: string) => {
      fetchForCitationModal(contentId, objectApiName, undefined).then((result) => {
        if (result) {
          setCitationModalData({ ...result, contentId });
        }
      });
    },
    [fetchForCitationModal, objectApiName]
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
            if (data.customer?.tocUrl != null) {
              setTocUrl(data.customer.tocUrl);
            } else {
              setTocUrl(null);
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

  // Sync URL -> article state: load article when URL is /article/:contentId, clear when on /
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    console.log("[chunk] Article sync effect: contentId=" + contentIdFromUrl + " search=" + search + " chunkObjectApiName=" + chunkObjectApiNameFromUrl + " chunkRecordIds=" + (chunkRecordIdsFromUrl ? chunkRecordIdsFromUrl.slice(0, 40) + "..." : "null"));
    if (contentIdFromUrl) {
      setCurrentContentId(contentIdFromUrl);
      const chunkParams =
        chunkObjectApiNameFromUrl && chunkRecordIdsFromUrl
          ? { chunkObjectApiName: chunkObjectApiNameFromUrl, chunkRecordIds: chunkRecordIdsFromUrl }
          : undefined;
      if (chunkParams) {
        console.log("[chunk] URL has chunk params -> will fetch get-chunks:", chunkObjectApiNameFromUrl, chunkRecordIdsFromUrl?.slice(0, 50));
      }
      fetchHarmonizationData(contentIdFromUrl, hudmoFromUrl, undefined, false, chunkParams);
    } else {
      setHudmoData(null);
      setChunkRows([]);
      setCurrentContentId(null);
    }
  }, [contentIdFromUrl, hudmoFromUrl, chunkObjectApiNameFromUrl, chunkRecordIdsFromUrl, fetchHarmonizationData]);

  const handleChatToggle = async () => {
    const newIsOpen = !isChatOpen;

    if (newIsOpen && !sessionInitialized && selectedCustomerId) {
      await initializeSession();
    }
    
    setIsChatOpen(newIsOpen);
  };

  // Tell parent frame to hide or resize iframe to match agent (embed mode only)
  useEffect(() => {
    if (!embedLayout || typeof window === "undefined" || window === window.parent) return;
    const open = isChatOpen;
    const width = open ? 420 : 0;
    const height = open ? 700 : 0;
    try {
      window.parent.postMessage(
        { type: "agent-embed-resize", open, width, height },
        "*"
      );
    } catch {
      // cross-origin or no parent
    }
  }, [embedLayout, isChatOpen]);

  const handleChatToggleRef = useRef(handleChatToggle);
  handleChatToggleRef.current = handleChatToggle;
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;

  // Listen for parent asking to open the agent (one-click open from demo page button)
  useEffect(() => {
    if (!embedLayout || typeof window === "undefined") return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "agent-embed-open" && !isChatOpenRef.current) {
        handleChatToggleRef.current();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedLayout]);

  // Transparent background in embed so no white box around the agent
  useEffect(() => {
    if (!embedLayout) return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    const prevRoot = root?.style.background ?? "";
    html.style.background = "transparent";
    body.style.background = "transparent";
    if (root) root.style.background = "transparent";
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
      if (root) root.style.background = prevRoot;
    };
  }, [embedLayout]);

  if (embedLayout && selectedCustomerId) {
    return (
      <AppErrorBoundary>
        <CustomerRouteProvider customerId={selectedCustomerId}>
        <ThemeProvider customerId={selectedCustomerId}>
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 bg-transparent">
            {isChatOpen ? (
              <div className="w-[calc(100vw-2rem)] sm:w-[400px] lg:w-[420px] h-[85vh] max-h-[700px] rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-right-5 duration-200">
                <div className="shrink-0 flex justify-end p-1.5 border-b border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={handleChatToggle}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                    aria-label="Close chat"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
                  citationBehavior="modal"
                  chunkPreviewByMessageId={chunkPreviewByMessageId}
                  hoverCardDataByMessageId={hoverCardDataByMessageId}
                  activeHoverCitationMessageId={activeHoverCitationMessageId}
                  onCitationHoverChange={onCitationHoverChange}
                  onCitationHoverScheduleHide={onCitationHoverScheduleHide}
                  onCitationHoverCancelHide={onCitationHoverCancelHide}
                  onHoverCitation={handleHoverCitation}
                />
              </div>
            ) : (
              <EmbedChatToggle onClick={handleChatToggle} />
            )}
        </div>
        <CitationModal
          open={!!citationModalData}
          onClose={() => setCitationModalData(null)}
          hudmoData={citationModalData?.hudmoData ?? null}
          chunkRows={citationModalData?.chunkRows ?? []}
          articleTitle={citationModalData?.articleTitle ?? null}
          currentContentId={citationModalData?.contentId ?? null}
          onTocContentClick={handleCitationTocContentClick}
        />
        </ThemeProvider>
        </CustomerRouteProvider>
      </AppErrorBoundary>
    );
  }

  if (customerIdParam && customerNotFound) {
    return (
      <AppErrorBoundary>
        <div className="min-h-screen flex flex-col bg-white items-center justify-center">
          <p className="text-gray-600">Customer not found.</p>
          <a href="/" className="mt-2 text-[var(--theme-primary)] hover:underline">Go home</a>
        </div>
      </AppErrorBoundary>
    );
  }

  if (customerIdParam && customers.length === 0) {
    return (
      <AppErrorBoundary>
        <div className="min-h-screen flex flex-col bg-white items-center justify-center">
          <p className="text-gray-600">Loading…</p>
        </div>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
    <CustomerRouteProvider customerId={selectedCustomerId!}>
    <ThemeProvider customerId={selectedCustomerId}>
    <div className="min-h-screen flex flex-col bg-white">
      <Header customers={customers} />
      {!selectedCustomerId ? (
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-600">Loading customer configuration...</p>
        </main>
      ) : (
      <>
      <main className="flex-1 relative overflow-hidden flex">
        {isArticleOpen && !isSearchPage && tocUrl && (
          <div className="w-64 border-r border-gray-200 bg-white flex-shrink-0">
            <TOC 
              tocUrl={tocUrl}
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
                <div className="flex-1 min-w-0 overflow-hidden order-2 md:order-1">
                  <ArticleErrorBoundary onClose={handleCloseArticle}>
                    <ArticleView data={hudmoData} chunkRows={chunkRows} onClose={handleCloseArticle} customerId={selectedCustomerId} />
                  </ArticleErrorBoundary>
                </div>
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
                    citationBehavior={citationBehavior}
                    chunkPreviewByMessageId={chunkPreviewByMessageId}
                    hoverCardDataByMessageId={hoverCardDataByMessageId}
                    activeHoverCitationMessageId={activeHoverCitationMessageId}
                    onCitationHoverChange={onCitationHoverChange}
                  onCitationHoverScheduleHide={onCitationHoverScheduleHide}
                  onCitationHoverCancelHide={onCitationHoverCancelHide}
                    onHoverCitation={handleHoverCitation}
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
            citationBehavior={citationBehavior}
            chunkPreviewByMessageId={chunkPreviewByMessageId}
            hoverCardDataByMessageId={hoverCardDataByMessageId}
            activeHoverCitationMessageId={activeHoverCitationMessageId}
            onCitationHoverChange={onCitationHoverChange}
            onCitationHoverScheduleHide={onCitationHoverScheduleHide}
            onCitationHoverCancelHide={onCitationHoverCancelHide}
            onHoverCitation={handleHoverCitation}
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
            citationBehavior={citationBehavior}
            chunkPreviewByMessageId={chunkPreviewByMessageId}
            hoverCardDataByMessageId={hoverCardDataByMessageId}
            activeHoverCitationMessageId={activeHoverCitationMessageId}
            onCitationHoverChange={onCitationHoverChange}
                  onCitationHoverScheduleHide={onCitationHoverScheduleHide}
                  onCitationHoverCancelHide={onCitationHoverCancelHide}
            onHoverCitation={handleHoverCitation}
          />
        </div>
      )}

      <Footer />

      <CitationModal
        open={!!citationModalData}
        onClose={() => setCitationModalData(null)}
        hudmoData={citationModalData?.hudmoData ?? null}
        chunkRows={citationModalData?.chunkRows ?? []}
        articleTitle={citationModalData?.articleTitle ?? null}
        currentContentId={citationModalData?.contentId ?? null}
        onTocContentClick={handleCitationTocContentClick}
      />
      </>
      )}
    </div>
    </ThemeProvider>
    </CustomerRouteProvider>
    </AppErrorBoundary>
  );
}

export default App;
