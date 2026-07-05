import { useCallback, useState } from "react";
import { ThemeProvider } from "../contexts/ThemeContext";
import { CustomerRouteProvider } from "../contexts/CustomerRouteContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { ChatWidget } from "./chat/ChatWidget";
import { CitationModal } from "./content/CitationModal";
import { fetchCitationModal } from "../api/fetchCitationModal";
import type { CitationModalResult } from "../api/fetchCitationModal";
import { getCitationTitle } from "../types/message";
import type { Message, CitedReference } from "../types/message";

const CUSTOMER_ID = "docusign";

/** docusign brand palette (approximated from docusign.com). */
const INK = "#130032"; // deep ink navy/purple (top utility bar, footer, dark sections)
const PURPLE = "#4C00FF"; // docusign cobalt purple (links, primary CTA)
const PURPLE_HOVER = "#3A00C2";

const navItems = ["Products", "Solutions", "Resources", "Enterprise", "Plans & Pricing"];

// FAQ / suggested questions shown as buttons in the empty chat body (first is the verified demo query).
const suggestedQuestions = [
  "What is the purpose of the new IAM Clause Library?",
  "What are the new and enhanced features in this release?",
  "What's included in the announcements for this release?",
];

const customerLogos = [
  "PRIMERICA",
  "DUCATI",
  "Thermo Fisher",
  "Calendly",
  "FSC",
  "Kroger",
  "RE/MAX",
  "UNITED",
  "Santander",
  "Unilever",
];

/** Small docusign logo mark: a rounded loop, approximated with overlapping brand squares. */
function DocusignMark() {
  return (
    <span className="relative inline-block h-6 w-6 shrink-0" aria-hidden>
      <span className="absolute left-0 top-0 h-4 w-4 rounded-[4px]" style={{ backgroundColor: PURPLE }} />
      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-[4px]" style={{ backgroundColor: "#FFD000" }} />
      <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: "#FF5252" }} />
    </span>
  );
}

export function DocusignDummyPage() {
  const chatProps = useAgentChat(CUSTOMER_ID);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [citationModalData, setCitationModalData] = useState<(CitationModalResult & { contentId: string }) | null>(null);
  // Fetching the article takes a moment; open the modal immediately and show a loader until it resolves.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  // The article being opened/loaded. Set immediately on ToC click so the ToC keeps the clicked
  // item highlighted while the content loads (the modal reads this, not the resolved data).
  const [pendingContentId, setPendingContentId] = useState<string | null>(null);

  const openArticleById = useCallback(
    async (contentId: string) => {
      if (!chatProps.objectApiName) return;
      setPendingContentId(contentId);
      setCitationModalData(null);
      setModalLoading(true);
      setModalOpen(true);
      const result = await fetchCitationModal(contentId, chatProps.objectApiName, undefined, CUSTOMER_ID);
      setModalLoading(false);
      if (result) setCitationModalData({ ...result, contentId });
      else setModalOpen(false);
    },
    [chatProps.objectApiName]
  );

  const handleOpenArticle = openArticleById;
  const handleCitationTocContentClick = openArticleById;

  const handleMessageClick = useCallback(
    async (message: Message) => {
      if (message.sender !== "bot" || !chatProps.objectApiName) return;
      let dccid = message.dccid ?? null;
      let hudmo = message.hudmo ?? null;
      let chunkObjectApiName = message.chunkObjectApiName ?? null;
      let chunkRecordIds = message.chunkRecordIds ?? null;
      if (!dccid || !hudmo) {
        const urls = typeof message.content === "string" ? message.content.match(/(https?:\/\/[^\s)]+)/g) || [] : [];
        if (urls[0]) {
          try {
            const cleanUrl = urls[0].replace(/[).,;!?]+$/, "");
            const urlObj = new URL(cleanUrl);
            dccid = urlObj.searchParams.get("c__dccid") || urlObj.searchParams.get("c__contentId") || dccid;
            hudmo = urlObj.searchParams.get("c__hudmo") || urlObj.searchParams.get("c__objectApiName") || hudmo;
            chunkObjectApiName = urlObj.searchParams.get("c__chunkObjectApiName") || chunkObjectApiName;
            chunkRecordIds = urlObj.searchParams.get("c__chunkRecordIds") || chunkRecordIds;
          } catch {
            /* ignore */
          }
        }
      }
      if (!dccid || !hudmo) return;
      const chunkParams =
        chunkObjectApiName && chunkRecordIds ? { chunkObjectApiName, chunkRecordIds } : undefined;
      // New citation structure: title from the citation object (or already on the message).
      const citationTitle =
        message.articleTitle ?? getCitationTitle(message.citedReferences?.[0] as CitedReference | undefined);
      setPendingContentId(dccid);
      setCitationModalData(null);
      setModalLoading(true);
      setModalOpen(true);
      const result = await fetchCitationModal(dccid, chatProps.objectApiName, chunkParams, CUSTOMER_ID, citationTitle);
      setModalLoading(false);
      if (result) setCitationModalData({ ...result, contentId: dccid });
      else setModalOpen(false);
    },
    [chatProps.objectApiName]
  );

  return (
    <CustomerRouteProvider customerId={CUSTOMER_ID}>
      <ThemeProvider customerId={CUSTOMER_ID}>
        <div className="min-h-screen bg-white">
          {/* Top utility bar */}
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-2 text-[12px] text-white" style={{ backgroundColor: INK }}>
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">NEW</span>
              <span className="truncate text-white/85">Deloitte Report: See how AI is driving 43% faster revenue</span>
              <span className="text-white/60">›</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-5 ml-auto text-white/85">
              <span className="hidden sm:inline font-semibold text-white">Sales 1-877-720-2040</span>
              <span className="hover:text-white cursor-default">Search</span>
              <span className="hover:text-white cursor-default">Support</span>
              <span className="hidden sm:inline hover:text-white cursor-default">Access Documents</span>
              <span className="hover:text-white cursor-default">Log In</span>
            </div>
          </div>

          {/* Main header (white) */}
          <header className="sticky top-0 z-10 flex h-[68px] min-h-[68px] w-full items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <span className="flex items-center gap-1.5">
                <DocusignMark />
                <span className="text-[22px] font-bold tracking-tight" style={{ color: INK }}>docusign</span>
              </span>
              <nav className="hidden items-center gap-6 text-[15px] font-medium text-gray-800 lg:flex">
                {navItems.map((item) => (
                  <span key={item} className="flex items-center gap-1 hover:text-black cursor-default">
                    {item}
                    {item !== "Enterprise" && item !== "Plans & Pricing" && <span className="text-[10px] text-gray-400">▾</span>}
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <span className="hidden md:inline text-[13px] font-bold tracking-wide cursor-default" style={{ color: PURPLE }}>
                CONTACT SALES
              </span>
              <span className="hidden sm:inline text-[13px] font-bold tracking-wide cursor-default" style={{ color: PURPLE }}>
                BUY NOW
              </span>
              <span
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-[13px] font-bold tracking-wide text-white shrink-0"
                style={{ backgroundColor: PURPLE }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
              >
                TRY FOR FREE
              </span>
            </div>
          </header>

          {/* Hero */}
          <div
            className="relative flex flex-col items-center justify-center px-4 pt-16 pb-24 text-center"
            style={{
              background: `radial-gradient(120% 90% at 50% 0%, #5B1FE6 0%, #3A0D9E 42%, ${INK} 100%)`,
            }}
          >
            <div className="flex w-full max-w-3xl flex-col items-center">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.05] tracking-tight text-white">
                Everything you need to agree
              </h1>
              <p className="mt-6 text-white/90 text-lg sm:text-xl">
                Send, sign and manage all your agreements for free.
              </p>

              {/* Marketing consent + email capture */}
              <div className="mt-10 w-full max-w-xl">
                <label className="flex items-start justify-center gap-2 text-[13px] leading-snug text-white/80">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-transparent" />
                  <span className="max-w-lg text-left">
                    I agree to receive marketing communications from docusign and acknowledge that I can opt out at
                    any time by visiting the <span className="underline">Preference Center</span>.
                  </span>
                </label>
                <p className="mt-3 text-[13px] text-white/70">
                  By clicking the Get Started button, you agree to docusign's{" "}
                  <span className="underline">Terms &amp; Conditions</span> and <span className="underline">Privacy Policy.</span>
                </p>
                <div className="mt-4 flex overflow-hidden rounded-lg bg-white shadow-lg">
                  <input
                    type="email"
                    placeholder="name@company.com"
                    className="h-14 flex-1 px-5 text-[15px] text-gray-800 outline-none"
                  />
                  <button
                    type="button"
                    className="h-14 px-7 text-[15px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: INK }}
                  >
                    Get Started
                  </button>
                </div>
                <p className="mt-4 text-[13px] text-white/80">Country/region: Israel ▾</p>
              </div>
            </div>
          </div>

          {/* Customer logo strip (white) */}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 px-6 py-12 bg-white">
            {customerLogos.map((logo) => (
              <span key={logo} className="text-gray-400 text-lg font-semibold tracking-wide">{logo}</span>
            ))}
          </div>

          {/* AI-powered section heading (gradient text) */}
          <div className="px-4 py-16 text-center bg-white">
            <h2
              className="text-4xl sm:text-5xl font-light tracking-tight"
              style={{
                background: "linear-gradient(90deg, #4C00FF 0%, #A21CAF 55%, #DB2777 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              AI-powered agreement management
            </h2>
            <p className="mt-6 text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
              Analyze agreements with AI, e-sign in minutes, and automate the entire process with the
              docusign IAM platform.
            </p>
          </div>

          {/* Footer */}
          <footer className="px-6 py-10 text-white/70 text-sm" style={{ backgroundColor: INK }}>
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <DocusignMark />
                <span className="text-white text-lg font-bold">docusign</span>
              </span>
              <span>© docusign, Inc. 2026</span>
            </div>
          </footer>

          <ChatWidget
            {...chatProps}
            onMessageClick={handleMessageClick}
            onOpenArticle={handleOpenArticle}
            suggestedQuestions={suggestedQuestions}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen((prev) => !prev)}
            hideStartNewSession
          />
        </div>

        <CitationModal
          open={modalOpen}
          loading={modalLoading}
          accentColor={PURPLE}
          onClose={() => {
            setModalOpen(false);
            setCitationModalData(null);
            setPendingContentId(null);
          }}
          hudmoData={citationModalData?.hudmoData ?? null}
          chunkRows={citationModalData?.chunkRows ?? []}
          articleTitle={citationModalData?.articleTitle ?? null}
          currentContentId={citationModalData?.contentId ?? pendingContentId}
          customerId={CUSTOMER_ID}
          onTocContentClick={handleCitationTocContentClick}
          enableToc={true}
          tocUrl={chatProps.tocUrl ?? undefined}
          tocUrls={chatProps.tocUrls ?? undefined}
        />
      </ThemeProvider>
    </CustomerRouteProvider>
  );
}
