import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import routesData from "../data/proofpointRoutes.json";
import { ThemeProvider } from "../contexts/ThemeContext";
import { CustomerRouteProvider } from "../contexts/CustomerRouteContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { ChatWidget } from "./chat/ChatWidget";
import { Header } from "./layout/Header";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const routes = routesData as Record<string, string[]>;

/**
 * Find the route key that matches the given pathname.
 * - Exact match first.
 * - Then match keys ending with * as prefix (e.g. /proofpoint/settings/monitoring-groups/departments* matches /proofpoint/settings/monitoring-groups/departments/foo).
 */
function findRouteKey(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (routes[normalized]) return normalized;
  for (const key of Object.keys(routes)) {
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      if (normalized === prefix || normalized.startsWith(prefix + "/")) return key;
    }
  }
  return null;
}

export function ProofpointDummyPage() {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/$/, "") || "/proofpoint";
  const isIndex = pathname === "/proofpoint";
  const routeKey = isIndex ? null : findRouteKey(pathname);
  const contentLinks = routeKey ? routes[routeKey] : null;
  const chatProps = useAgentChat("proofpoint");
  const [proposedQuestion, setProposedQuestion] = useState<string | null>(null);
  const proposedQuestionSentRef = useRef(false);
  const [isChatOpen, setIsChatOpen] = useState(true); // Open by default like other customers
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Get proposed question: from location state (landing) or from customer API
  useEffect(() => {
    const fromState = (location.state as { proposedQuestion?: string } | null)?.proposedQuestion;
    if (fromState) {
      setProposedQuestion(fromState);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers/proofpoint`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.customer?.proposedQuestion) {
          setProposedQuestion(data.customer.proposedQuestion);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.state]);

  // Auto-send proposed question once when session is ready (match main App behavior)
  useEffect(() => {
    if (!chatProps.sessionInitialized || !proposedQuestion || proposedQuestionSentRef.current) return;
    proposedQuestionSentRef.current = true;
    const question = proposedQuestion;
    setToastMessage("Proposing a question based on customer content…");
    const sendDelayMs = 2000;
    const t = setTimeout(() => {
      setToastMessage(null);
      setProposedQuestion(null);
      Promise.resolve(chatProps.onSendMessage(question)).then(
        () => {},
        () => {
          proposedQuestionSentRef.current = false;
        }
      );
    }, sendDelayMs);
    return () => clearTimeout(t);
  }, [chatProps.sessionInitialized, proposedQuestion, chatProps.onSendMessage]);

  return (
    <CustomerRouteProvider customerId="proofpoint">
      <ThemeProvider customerId="proofpoint">
        <div className="min-h-screen bg-gray-50 text-gray-900">
      {toastMessage && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg bg-slate-800 text-white text-sm font-medium shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}
      <Header customers={[{ id: "proofpoint", name: "Proofpoint" }]} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 mb-4">Route: {pathname || "/proofpoint"}</p>
        {isIndex ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Routes</h2>
            <ul className="list-disc list-inside space-y-2">
              {Object.keys(routes).map((key) => (
                <li key={key}>
                  <Link to={key.endsWith("*") ? key.slice(0, -1) : key} className="text-blue-600 hover:underline">
                    {key}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : routeKey && contentLinks ? (
          <>
            <h2 className="text-xl font-semibold mb-2">Route: {routeKey}</h2>
            <p className="text-sm text-gray-600 mb-2">Related content ({contentLinks.length}):</p>
            <ul className="list-disc list-inside space-y-1 text-sm font-mono text-gray-700 mb-6">
              {contentLinks.map((href, i) => (
                <li key={i}>{href}</li>
              ))}
            </ul>
            <p>
              <Link to="/proofpoint" className="text-blue-600 hover:underline">
                ← All routes
              </Link>
            </p>
          </>
        ) : routeKey ? (
          <>
            <h2 className="text-xl font-semibold mb-2">Route: {routeKey}</h2>
            <p>
              <Link to="/proofpoint" className="text-blue-600 hover:underline">
                ← All routes
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-600">No route defined for this path.</p>
            <p className="mt-4">
              <Link to="/proofpoint" className="text-blue-600 hover:underline">
                ← All routes
              </Link>
            </p>
          </>
        )}
      </main>
        <ChatWidget
          {...chatProps}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen((prev) => !prev)}
          hideStartNewSession
        />
    </div>
      </ThemeProvider>
    </CustomerRouteProvider>
  );
}
