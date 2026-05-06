import { useState, useCallback, useEffect, useRef } from "react";
import { generateSignature } from "../utils/requestSigner";
import { getAgentMessageText } from "../utils/getAgentMessageText";
import type { Message } from "../types/message";
import type { ChatWidgetProps, UrlBasedContentArticle } from "../types/message";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Hook that provides chat state and handlers for the Agentforce widget.
 * Used by Proofpoint dummy pages (and can be reused elsewhere) with a fixed customerId.
 * When pathname is provided and customer has url-based-content, fetches relevant HUDMOs and returns them as urlBasedContentArticles (show after first message).
 * Optional accountName is passed to start-session and send-message for the agent (e.g. "Northbridge Data Security").
 */
export function useAgentChat(customerId: string, pathname?: string | null, accountName?: string | null): ChatWidgetProps {
  /** Scope session per route + account so e.g. /proofpoint, /proofpoint/websecurity, /proofpoint/npre each get their own external session (and accountName) without cross-talk. */
  const pathSegment =
    (pathname ?? "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\//g, "__") || "root";
  const accountSegment =
    (accountName ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "no-account";
  const sessionStorageKey = `agentforce-session-key-${customerId}__${pathSegment}__${accountSegment}`;
  const sessionKeyRef = useRef(sessionStorage.getItem(sessionStorageKey) || crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [agentforceSessionId, setAgentforceSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // start true so we show loading until session is ready (no "Start New Session" flash)
  const [isOpen, setIsOpen] = useState(false);
  const [messageSequence, setMessageSequence] = useState(1);
  const [urlBasedContentArticles, setUrlBasedContentArticles] = useState<UrlBasedContentArticle[]>([]);
  const [objectApiName, setObjectApiName] = useState<string | null>(null);
  const [tocUrl, setTocUrl] = useState<string | null>(null);
  const [tocUrls, setTocUrls] = useState<string[] | null>(null);

  // Fetch customer config so we have objectApiName and tocUrls for citation modal
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers/${customerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.customer) {
          if (data.customer.objectApiName) setObjectApiName(data.customer.objectApiName);
          if (data.customer.tocUrl) setTocUrl(data.customer.tocUrl);
          if (Array.isArray(data.customer.tocUrls) && data.customer.tocUrls.length > 0) {
            setTocUrls(data.customer.tocUrls);
          } else if (data.customer.tocUrl) {
            setTocUrls([data.customer.tocUrl]);
          } else {
            setTocUrls(null);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const initSession = useCallback(async () => {
    if (sessionInitialized || !customerId) return;
    setIsLoading(true);
    try {
      const key = sessionKeyRef.current;
      const customerParam = `&customerId=${encodeURIComponent(customerId)}`;
      const accountParam = accountName ? `&accountName=${encodeURIComponent(accountName)}` : "";
      const path = `/api/v1/start-session?sessionId=${key}${customerParam}${accountParam}`;
      const { timestamp, signature } = await generateSignature("GET", path);
      const response = await fetch(`${API_URL}${path}`, {
        headers: { "X-Timestamp": timestamp, "X-Signature": signature },
      });
      if (!response.ok) throw new Error(`Start session failed: ${response.statusText}`);
      const data = await response.json();
      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);
      if (data.messages?.[0]) {
        const m0 = data.messages[0] as Record<string, unknown>;
        const welcomeText = getAgentMessageText(m0, "Hi, I'm Agentforce on EK. How can I help you?");
        setMessages([
          {
            id: (typeof m0.id === "string" && m0.id) || `msg-welcome-${Date.now()}`,
            content: welcomeText,
            timestamp: new Date(),
            sender: "bot",
            type: typeof m0.type === "string" ? m0.type : undefined,
            feedbackId: typeof m0.feedbackId === "string" ? m0.feedbackId : undefined,
            isContentSafe: typeof m0.isContentSafe === "boolean" ? m0.isContentSafe : undefined,
            message: welcomeText,
            metrics: m0.metrics != null && typeof m0.metrics === "object" && !Array.isArray(m0.metrics) ? (m0.metrics as Record<string, unknown>) : undefined,
            planId: typeof m0.planId === "string" ? m0.planId : undefined,
            result: Array.isArray(m0.result) ? (m0.result as Message["result"]) : undefined,
            citedReferences: Array.isArray(m0.citedReferences) ? (m0.citedReferences as Message["citedReferences"]) : undefined,
            qa: Array.isArray(m0.qa) ? (m0.qa as Message["qa"]) : undefined,
          },
        ]);
      }
    } catch (e) {
      console.error("useAgentChat init:", e);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, sessionInitialized, accountName]);

  useEffect(() => {
    if (customerId) initSession();
  }, [customerId, initSession]);

  // When session is ready and pathname is set, fetch url-based-content HUDMOs for this route
  useEffect(() => {
    if (!sessionInitialized || !pathname || !customerId) return;
    let cancelled = false;
    (async () => {
      try {
        const customerRes = await fetch(`${API_URL}/api/v1/customers/${customerId}`);
        if (!customerRes.ok || cancelled) return;
        const { customer } = await customerRes.json();
        const urlBasedContent = customer?.urlBasedContent;
        if (!urlBasedContent || typeof urlBasedContent !== "object" || Array.isArray(urlBasedContent)) return;
        const contentIds = urlBasedContent[pathname];
        if (!Array.isArray(contentIds) || contentIds.length === 0) return;
        const hudmoName = customer?.objectApiName;
        if (!hudmoName || typeof hudmoName !== "string") return;
        const articles: UrlBasedContentArticle[] = [];
        for (const contentId of contentIds) {
          if (cancelled) break;
          try {
            const { timestamp, signature } = await generateSignature("POST", "/api/v1/get-hudmo");
            const res = await fetch(`${API_URL}/api/v1/get-hudmo`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Timestamp": timestamp, "X-Signature": signature },
              body: JSON.stringify({ hudmoName, dccid: contentId, customerId }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            const attrs = data?.data?.attributes;
            articles.push({
              contentId,
              title: attrs?.title ?? null,
              summary: attrs?.summary ?? null,
            });
          } catch {
            // skip failed article
          }
        }
        if (!cancelled && articles.length > 0) setUrlBasedContentArticles(articles);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionInitialized, pathname, customerId]);

  const onSendMessage = useCallback(
    async (content: string) => {
      if (!agentforceSessionId) return;
      const userMessage: Message = {
        id: `msg-user-${Date.now()}`,
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
            customerId,
            ...(accountName ? { accountName } : {}),
          }),
        });
        if (!response.ok) throw new Error(`Send message failed: ${response.statusText}`);
        const data = await response.json();
        const agentResponse = data.messages?.[0] as Record<string, unknown> | undefined;
        if (agentResponse) {
          const messageText = getAgentMessageText(agentResponse, "Response received");
          const botMessage: Message = {
            id: (typeof agentResponse.id === "string" && agentResponse.id) || `msg-bot-${Date.now()}`,
            content: messageText,
            timestamp: new Date(),
            sender: "bot",
            type: typeof agentResponse.type === "string" ? agentResponse.type : undefined,
            feedbackId: typeof agentResponse.feedbackId === "string" ? agentResponse.feedbackId : undefined,
            isContentSafe: typeof agentResponse.isContentSafe === "boolean" ? agentResponse.isContentSafe : undefined,
            message: messageText,
            metrics:
              agentResponse.metrics != null &&
              typeof agentResponse.metrics === "object" &&
              !Array.isArray(agentResponse.metrics)
                ? (agentResponse.metrics as Record<string, unknown>)
                : undefined,
            planId: typeof agentResponse.planId === "string" ? agentResponse.planId : undefined,
            result: Array.isArray(agentResponse.result) ? (agentResponse.result as Message["result"]) : undefined,
            citedReferences: Array.isArray(agentResponse.citedReferences)
              ? (agentResponse.citedReferences as Message["citedReferences"])
              : undefined,
            qa: Array.isArray(agentResponse.qa) ? (agentResponse.qa as Message["qa"]) : undefined,
          };
          setMessages((prev) => [...prev, botMessage]);
        }
        setMessageSequence((prev) => prev + 1);
      } catch (e) {
        console.error("useAgentChat send:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [agentforceSessionId, customerId, messageSequence, accountName]
  );

  const onDeleteSession = useCallback(async () => {
    if (!agentforceSessionId) return;
    try {
      const { timestamp, signature } = await generateSignature("DELETE", "/api/v1/delete-session");
      await fetch(`${API_URL}/api/v1/delete-session`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Timestamp": timestamp, "X-Signature": signature },
        body: JSON.stringify({ sessionId: agentforceSessionId }),
      });
    } catch (e) {
      console.error("useAgentChat delete:", e);
    }
    setMessages([]);
    setSessionInitialized(false);
    setAgentforceSessionId(null);
    setMessageSequence(1);
    setUrlBasedContentArticles([]);
    sessionKeyRef.current = crypto.randomUUID();
    sessionStorage.setItem(sessionStorageKey, sessionKeyRef.current);
  }, [agentforceSessionId, sessionStorageKey]);

  const onStartNewSession = useCallback(async () => {
    sessionKeyRef.current = crypto.randomUUID();
    sessionStorage.setItem(sessionStorageKey, sessionKeyRef.current);
    setSessionInitialized(false);
    setAgentforceSessionId(null);
    setMessages([]);
    setMessageSequence(1);
    setUrlBasedContentArticles([]);
    setIsLoading(true);
    try {
      const key = sessionKeyRef.current;
      const accountParam = accountName ? `&accountName=${encodeURIComponent(accountName)}` : "";
      const path = `/api/v1/start-session?sessionId=${key}&customerId=${encodeURIComponent(customerId)}${accountParam}`;
      const { timestamp, signature } = await generateSignature("GET", path);
      const response = await fetch(`${API_URL}${path}`, {
        headers: { "X-Timestamp": timestamp, "X-Signature": signature },
      });
      if (!response.ok) throw new Error(`Start session failed: ${response.statusText}`);
      const data = await response.json();
      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);
      if (data.messages?.[0]) {
        const m0 = data.messages[0] as Record<string, unknown>;
        const welcomeText = getAgentMessageText(m0, "Hi, I'm Agentforce on EK. How can I help you?");
        setMessages([
          {
            id: (typeof m0.id === "string" && m0.id) || `msg-welcome-${Date.now()}`,
            content: welcomeText,
            timestamp: new Date(),
            sender: "bot",
            type: typeof m0.type === "string" ? m0.type : undefined,
            feedbackId: typeof m0.feedbackId === "string" ? m0.feedbackId : undefined,
            isContentSafe: typeof m0.isContentSafe === "boolean" ? m0.isContentSafe : undefined,
            message: welcomeText,
            metrics: m0.metrics != null && typeof m0.metrics === "object" && !Array.isArray(m0.metrics) ? (m0.metrics as Record<string, unknown>) : undefined,
            planId: typeof m0.planId === "string" ? m0.planId : undefined,
            result: Array.isArray(m0.result) ? (m0.result as Message["result"]) : undefined,
            citedReferences: Array.isArray(m0.citedReferences) ? (m0.citedReferences as Message["citedReferences"]) : undefined,
            qa: Array.isArray(m0.qa) ? (m0.qa as Message["qa"]) : undefined,
          },
        ]);
      }
    } catch (e) {
      console.error("useAgentChat startNew:", e);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, accountName]);

  const onToggle = useCallback(() => setIsOpen((o) => !o), []);

  return {
    messages,
    onMessageClick: (_message: Message) => {},
    onSendMessage,
    onDeleteSession,
    onStartNewSession,
    sessionInitialized,
    isLoading,
    isOpen,
    onToggle,
    fetchingHudmoFor: new Set(),
    prefetchedHudmoData: new Map(),
    citationBehavior: "modal",
    chunkPreviewByMessageId: {},
    hoverCardDataByMessageId: {},
    activeHoverCitationMessageId: null,
    onCitationHoverChange: () => {},
    onCitationHoverScheduleHide: () => {},
    onCitationHoverCancelHide: () => {},
    onHoverCitation: () => {},
    urlBasedContentArticles,
    basePath: pathname ? `/${pathname.split("/").filter(Boolean)[0] ?? ""}` : undefined,
    objectApiName,
    tocUrl,
    tocUrls,
  };
}
