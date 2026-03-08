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

const PROOFPOINT_GREEN = "#66CC33";
const PROOFPOINT_DARK = "#0A1C2B";
const PROOFPOINT_BLUE = "#0066FF";

/** Exact same content as EmbedStaticBackground Proofpoint view (screenshot); tiles link to product routes */
const proofpointStaticTiles = [
  {
    to: "/proofpoint/casb",
    title: "Secure and govern your AI before risk becomes reality",
    description: "A modern approach to managing human...",
    titleGreen: false,
  },
  {
    to: "/proofpoint/websecurity",
    title: "Leader for email security",
    description: "Proofpoint provides comprehensive...",
    titleGreen: false,
  },
  {
    to: "/proofpoint/npre",
    title: "Proofpoint Protect Series",
    description: "Proofpoint Protect is a multi-layer...",
    titleGreen: true,
  },
];

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
        {isIndex ? (
          <div className="min-h-screen" style={{ backgroundColor: PROOFPOINT_DARK }}>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg bg-slate-800 text-white text-sm font-medium shadow-lg" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
            <header className="sticky top-0 z-10 flex h-[70px] min-h-[70px] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: PROOFPOINT_DARK }}>
              <div className="flex items-center gap-6">
                <span className="text-xl font-bold text-white">proofpoint.</span>
                <nav className="hidden items-center gap-5 text-sm font-medium text-white/90 md:flex">
                  <span>Platform</span><span>Solutions</span><span>Why Proofpoint</span><span>Resources</span><span>Company</span>
                </nav>
              </div>
              <div className="flex flex-1 max-w-md justify-end items-center gap-3">
                <span className="hidden sm:inline-flex h-9 px-4 rounded border-2 items-center justify-center text-sm font-medium shrink-0 text-white bg-[#0066FF] border-[#0066FF]">Assess Your Risk →</span>
                <span className="inline-flex h-9 px-4 rounded bg-black text-white items-center justify-center text-sm font-medium shrink-0 border border-white/20">Contact Us →</span>
              </div>
            </header>
            <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 text-white text-sm" style={{ backgroundColor: PROOFPOINT_BLUE }}>
              <span>Proofpoint acquires Acuvity to deliver AI security and governance across the agentic workspace. Read more</span>
              <span className="shrink-0 text-white/90">×</span>
            </div>
            <div className="relative min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 sm:py-16" style={{ background: `linear-gradient(180deg, ${PROOFPOINT_DARK} 0%, #0F2E4A 100%)` }}>
              <div className="flex max-w-3xl flex-col items-center text-center">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                  <span style={{ color: PROOFPOINT_GREEN }}>Proofpoint Protect</span>
                  <br />
                  <span className="text-white">Series is on tour</span>
                </h1>
                <p className="mt-4 text-white/95 text-base sm:text-lg max-w-2xl">Don&apos;t miss one of our worldwide events, coming to a city near you.</p>
                <span className="mt-6 inline-flex h-11 min-w-[160px] items-center justify-center rounded-md bg-white px-6 text-sm font-medium border-2" style={{ color: PROOFPOINT_BLUE, borderColor: PROOFPOINT_BLUE }}>See events →</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 px-4 py-8 sm:px-6" style={{ backgroundColor: "#0A1628" }}>
              {proofpointStaticTiles.map((tile, i) => (
                <Link
                  key={i}
                  to={tile.to}
                  className="flex-1 min-w-[240px] max-w-[320px] rounded-lg p-5 text-left bg-black/40 border border-white/10 hover:border-white/25 hover:bg-black/50 transition-all duration-200 no-underline block"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: tile.titleGreen ? PROOFPOINT_GREEN : "white" }}>{tile.title}</h3>
                  <p className="text-white/80 text-sm">{tile.description}</p>
                </Link>
              ))}
            </div>
            <ChatWidget {...chatProps} isOpen={isChatOpen} onToggle={() => setIsChatOpen((prev) => !prev)} hideStartNewSession />
          </div>
        ) : (
        <div className="min-h-screen bg-gray-50 text-gray-900">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg bg-slate-800 text-white text-sm font-medium shadow-lg" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
      <Header customers={[{ id: "proofpoint", name: "Proofpoint" }]} />
      <main className="max-w-3xl mx-auto px-4 py-8">
          <>
            <p className="text-sm text-gray-500 mb-4">Route: {pathname || "/proofpoint"}</p>
            {routeKey && contentLinks ? (
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
          </>
      </main>
        <ChatWidget
          {...chatProps}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen((prev) => !prev)}
          hideStartNewSession
        />
    </div>
        )}
      </ThemeProvider>
    </CustomerRouteProvider>
  );
}
