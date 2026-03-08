import { useState, useCallback, useEffect, useRef } from "react";
import { generateSignature } from "../utils/requestSigner";
import type { Message } from "../types/message";
import type { ChatWidgetProps, UrlBasedContentArticle } from "../types/message";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
  } catch {
    // ignore
  }
  return fallback;
}

/**
 * Hook that provides chat state and handlers for the Agentforce widget.
 * Used by Proofpoint dummy pages (and can be reused elsewhere) with a fixed customerId.
 * When pathname is provided and customer has url-based-content, fetches relevant HUDMOs and returns them as urlBasedContentArticles (show after first message).
 */
export function useAgentChat(customerId: string, pathname?: string | null): ChatWidgetProps {
  const sessionStorageKey = `agentforce-session-key-${customerId}`;
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

  // Fetch customer config so we have objectApiName for citation modal (and url-based content)
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers/${customerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.customer) {
          if (data.customer.objectApiName) setObjectApiName(data.customer.objectApiName);
          if (data.customer.tocUrl) setTocUrl(data.customer.tocUrl);
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
      const path = `/api/v1/start-session?sessionId=${key}${customerParam}`;
      const { timestamp, signature } = await generateSignature("GET", path);
      const response = await fetch(`${API_URL}${path}`, {
        headers: { "X-Timestamp": timestamp, "X-Signature": signature },
      });
      if (!response.ok) throw new Error(`Start session failed: ${response.statusText}`);
      const data = await response.json();
      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);
      if (data.messages?.[0]) {
        const welcomeText = getAgentMessageText(data.messages[0], "Hi, I'm Agentforce on EK. How can I help you?");
        setMessages([
          {
            id: data.messages[0].id || `msg-welcome-${Date.now()}`,
            content: welcomeText,
            timestamp: new Date(),
            sender: "bot",
            type: data.messages[0].type,
            message: welcomeText,
            citedReferences: data.messages[0].citedReferences,
          },
        ]);
      }
    } catch (e) {
      console.error("useAgentChat init:", e);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, sessionInitialized]);

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
          }),
        });
        if (!response.ok) throw new Error(`Send message failed: ${response.statusText}`);
        const data = await response.json();
        const agentResponse = data.messages?.[0];
        if (agentResponse) {
          const messageText = getAgentMessageText(agentResponse, "Response received");
          const botMessage: Message = {
            id: (agentResponse.id as string) || `msg-bot-${Date.now()}`,
            content: messageText,
            timestamp: new Date(),
            sender: "bot",
            type: agentResponse.type,
            message: messageText,
            citedReferences: agentResponse.citedReferences,
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
    [agentforceSessionId, customerId, messageSequence]
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
      const path = `/api/v1/start-session?sessionId=${key}&customerId=${encodeURIComponent(customerId)}`;
      const { timestamp, signature } = await generateSignature("GET", path);
      const response = await fetch(`${API_URL}${path}`, {
        headers: { "X-Timestamp": timestamp, "X-Signature": signature },
      });
      if (!response.ok) throw new Error(`Start session failed: ${response.statusText}`);
      const data = await response.json();
      setAgentforceSessionId(data.sessionId);
      setSessionInitialized(true);
      if (data.messages?.[0]) {
        const welcomeText = getAgentMessageText(data.messages[0], "Hi, I'm Agentforce on EK. How can I help you?");
        setMessages([
          {
            id: data.messages[0].id || `msg-welcome-${Date.now()}`,
            content: welcomeText,
            timestamp: new Date(),
            sender: "bot",
            message: welcomeText,
            citedReferences: data.messages[0].citedReferences,
          },
        ]);
      }
    } catch (e) {
      console.error("useAgentChat startNew:", e);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

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
  };
}
