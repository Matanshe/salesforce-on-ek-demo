import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import { CustomerRouteProvider } from "../contexts/CustomerRouteContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { useCustomerProposedQuestionAutoSend } from "../hooks/useCustomerProposedQuestionAutoSend";
import { ProposedQuestionToast } from "./ProposedQuestionToast";
import { ChatWidget } from "./chat/ChatWidget";
import { CitationModal } from "./content/CitationModal";
import { fetchCitationModal } from "../api/fetchCitationModal";
import type { CitationModalResult } from "../api/fetchCitationModal";
import { getCitationTitle } from "../types/message";
import type { Message, CitedReference } from "../types/message";

const CUSTOMER_ID = "docusign";

/** Docusign "Ink" brand palette (approximated from docusign.com; tunable in customers.json). */
const INK = "#130032"; // deep ink navy/purple background
const INK_2 = "#26065D"; // primary purple
const YELLOW = "#FFD000"; // brand yellow accent
const YELLOW_HOVER = "#E6BC00";

const navItems = ["Products", "Solutions", "Resources", "Enterprise", "Plans & Pricing"];

const productCards = [
  { title: "eSignature", desc: "The world's #1 way to send and sign agreements." },
  { title: "Docusign IAM", desc: "The intelligent agreement management platform." },
  { title: "Clause Library", desc: "Reusable, approved clauses for faster agreements." },
  { title: "Workflow Builder", desc: "Automate agreement processes end to end." },
  { title: "Developer APIs", desc: "Embed agreements into any app or workflow." },
  { title: "CLM", desc: "Manage the full contract lifecycle at scale." },
];

const customerLogos = ["United", "Santander", "Unilever", "Canva", "T-Mobile", "Salesforce"];

export function DocusignDummyPage() {
  const location = useLocation();
  const chatProps = useAgentChat(CUSTOMER_ID);
  const { toastMessage } = useCustomerProposedQuestionAutoSend(
    CUSTOMER_ID,
    chatProps.sessionInitialized,
    chatProps.onSendMessage,
    location.state,
    true // auto-send the customer's proposed question on load
  );
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [citationModalData, setCitationModalData] = useState<(CitationModalResult & { contentId: string }) | null>(null);

  const handleOpenArticle = useCallback(
    async (contentId: string) => {
      if (!chatProps.objectApiName) return;
      const result = await fetchCitationModal(contentId, chatProps.objectApiName, undefined, CUSTOMER_ID);
      if (result) setCitationModalData({ ...result, contentId });
    },
    [chatProps.objectApiName]
  );

  const handleCitationTocContentClick = useCallback(
    async (contentId: string) => {
      if (!chatProps.objectApiName) return;
      const result = await fetchCitationModal(contentId, chatProps.objectApiName, undefined, CUSTOMER_ID);
      if (result) setCitationModalData({ ...result, contentId });
    },
    [chatProps.objectApiName]
  );

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
      const result = await fetchCitationModal(dccid, chatProps.objectApiName, chunkParams, CUSTOMER_ID, citationTitle);
      if (result) setCitationModalData({ ...result, contentId: dccid });
    },
    [chatProps.objectApiName]
  );

  return (
    <CustomerRouteProvider customerId={CUSTOMER_ID}>
      <ThemeProvider customerId={CUSTOMER_ID}>
        <ProposedQuestionToast message={toastMessage} />
        <div className="min-h-screen" style={{ backgroundColor: INK }}>
          {/* Utility bar */}
          <div className="hidden sm:flex items-center justify-end gap-5 px-6 py-1.5 text-[11px] text-white/70" style={{ backgroundColor: "#0C0020" }}>
            <span>1-877-720-2040</span>
            <span>Search</span>
            <span>Support</span>
            <span>Access Documents</span>
          </div>

          {/* Header */}
          <header className="sticky top-0 z-10 flex h-[68px] min-h-[68px] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: INK }}>
            <div className="flex items-center gap-8">
              <span className="text-2xl font-bold text-white tracking-tight">Docusign</span>
              <nav className="hidden items-center gap-6 text-sm font-medium text-white/90 lg:flex">
                {navItems.map((item) => (
                  <span key={item} className="hover:text-white cursor-default">{item}</span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm font-medium text-white/90">Log in</span>
              <span
                className="inline-flex h-9 px-4 rounded-full items-center justify-center text-sm font-semibold shrink-0"
                style={{ backgroundColor: YELLOW, color: INK }}
              >
                Get started
              </span>
            </div>
          </header>

          {/* Hero */}
          <div
            className="relative flex flex-col items-center justify-center px-4 py-16 sm:py-24 text-center"
            style={{ background: `linear-gradient(180deg, ${INK} 0%, ${INK_2} 100%)` }}
          >
            <div className="flex max-w-3xl flex-col items-center">
              <span className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${YELLOW}22`, color: YELLOW }}>
                Intelligent Agreement Management
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-white">
                AI-powered agreement
                <br />
                management
              </h1>
              <p className="mt-5 text-white/85 text-base sm:text-lg max-w-2xl">
                Analyze agreements with AI, e-sign in minutes, and automate the entire process with the
                Docusign IAM platform.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <span
                  className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-full px-6 text-sm font-semibold"
                  style={{ backgroundColor: YELLOW, color: INK }}
                >
                  Explore Docusign IAM →
                </span>
                <span className="inline-flex h-11 min-w-[160px] items-center justify-center rounded-full px-6 text-sm font-medium text-white border border-white/30">
                  Start for free
                </span>
              </div>
            </div>
          </div>

          {/* Customer logo marquee */}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8" style={{ backgroundColor: "#0C0020" }}>
            {customerLogos.map((logo) => (
              <span key={logo} className="text-white/50 text-lg font-semibold tracking-wide">{logo}</span>
            ))}
          </div>

          {/* Product feature cards */}
          <div className="px-4 py-14 sm:px-6" style={{ backgroundColor: INK }}>
            <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-2">
              Do (much) more with IAM
            </h2>
            <p className="text-center text-white/70 text-sm sm:text-base mb-10 max-w-2xl mx-auto">
              One platform to create, commit to, and manage every agreement.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {productCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl p-6 text-left border border-white/10 hover:border-white/25 transition-all duration-200"
                  style={{ backgroundColor: "#1B0842" }}
                >
                  <div className="mb-3 h-8 w-8 rounded-lg" style={{ backgroundColor: YELLOW }} />
                  <h3 className="text-white font-semibold text-lg mb-1.5">{card.title}</h3>
                  <p className="text-white/70 text-sm mb-3">{card.desc}</p>
                  <span className="text-sm font-medium" style={{ color: YELLOW }}>Explore →</span>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA banner */}
          <div
            className="px-4 py-16 text-center"
            style={{ background: `linear-gradient(180deg, ${INK_2} 0%, ${INK} 100%)` }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white max-w-2xl mx-auto">
              Docusign IAM is the agreement platform your business needs
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <span
                className="inline-flex h-11 min-w-[160px] items-center justify-center rounded-full px-6 text-sm font-semibold"
                style={{ backgroundColor: YELLOW, color: INK }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = YELLOW_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = YELLOW)}
              >
                Start for free
              </span>
              <span className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-full px-6 text-sm font-medium text-white border border-white/30">
                Explore Docusign IAM
              </span>
            </div>
          </div>

          {/* Footer */}
          <footer className="px-6 py-10 text-white/60 text-sm" style={{ backgroundColor: "#0C0020" }}>
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-white text-lg font-bold">Docusign</span>
              <span>© Docusign, Inc. 2026</span>
            </div>
          </footer>

          <ChatWidget
            {...chatProps}
            onMessageClick={handleMessageClick}
            onOpenArticle={handleOpenArticle}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen((prev) => !prev)}
            hideStartNewSession
          />
        </div>

        <CitationModal
          open={!!citationModalData}
          onClose={() => setCitationModalData(null)}
          hudmoData={citationModalData?.hudmoData ?? null}
          chunkRows={citationModalData?.chunkRows ?? []}
          articleTitle={citationModalData?.articleTitle ?? null}
          currentContentId={citationModalData?.contentId ?? null}
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
