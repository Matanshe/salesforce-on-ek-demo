/**
 * Proofpoint NPRE (Nexus People Risk Explorer) overview page.
 * Matches the Proofpoint product-page pattern with agent chat.
 */
import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { CustomerRouteProvider } from "@/contexts/CustomerRouteContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useCustomerProposedQuestionAutoSend } from "@/hooks/useCustomerProposedQuestionAutoSend";
import { ProposedQuestionToast } from "@/components/ProposedQuestionToast";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CitationModal } from "@/components/content/CitationModal";
import { fetchCitationModal } from "@/api/fetchCitationModal";
import type { CitationModalResult } from "@/api/fetchCitationModal";
import type { Message } from "@/types/message";
import { ProofpointHeader } from "./ProofpointHeader";
import "./Proofpoint.css";

const CUSTOMER_ID = "proofpoint";
const ACCOUNT_NAME = "Northbridge Data Security";
const LOGGED_IN_USER_NAME = "Ethan Caldwell";
const ELIGIBLE_PRODUCTS_TEXT = "Risk explorer";

export function ProofpointNprePage() {
  const location = useLocation();
  const { pathname } = location;
  const chatProps = useAgentChat(CUSTOMER_ID, pathname, ACCOUNT_NAME);
  const [autoProposeEnabled, setAutoProposeEnabled] = useState(false);
  const { toastMessage } = useCustomerProposedQuestionAutoSend(
    CUSTOMER_ID,
    chatProps.sessionInitialized,
    chatProps.onSendMessage,
    location.state,
    autoProposeEnabled
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
      const result = await fetchCitationModal(dccid, chatProps.objectApiName, chunkParams, CUSTOMER_ID);
      if (result) setCitationModalData({ ...result, contentId: dccid });
    },
    [chatProps.objectApiName]
  );

  return (
    <CustomerRouteProvider customerId="proofpoint">
      <ThemeProvider customerId="proofpoint">
        <div className="proofpoint-page min-h-screen">
          <ProposedQuestionToast message={toastMessage} />
          <ProofpointHeader
            loggedInUserName={LOGGED_IN_USER_NAME}
            accountName={ACCOUNT_NAME}
            eligibleProductsText={ELIGIBLE_PRODUCTS_TEXT}
            autoProposeQuestionsEnabled={autoProposeEnabled}
            onAutoProposeQuestionsChange={setAutoProposeEnabled}
          />

          {/* Hero */}
          <section
            className="proofpoint-hero relative flex flex-col items-center justify-center px-4 py-16 sm:py-24"
          >
            <div className="relative z-10 max-w-4xl text-center">
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Nexus People Risk Explorer
              </h1>
              <p className="mt-4 text-lg font-medium text-white/90">NPRE</p>
              <p className="mt-6 max-w-2xl mx-auto text-lg text-white/95">
                Understand and act on people-centric risk with visibility into attacked, vulnerable,
                and privileged users. NPRE helps you segment high-risk individuals, monitor cloud
                risk, and use target groups and dashboards to protect your organization.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/proofpoint"
                  className="proofpoint-btn-primary"
                >
                  Open NPRE Help & Documentation
                </Link>
                <a
                  href="#overview"
                  className="proofpoint-btn-outline"
                >
                  Learn more
                </a>
              </div>
            </div>
          </section>

          {/* Overview */}
          <section id="overview" className="proofpoint-section px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Overview</h2>
              <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div className="proofpoint-card">
                  <h3 className="text-lg font-semibold text-white">
                    People Risk
                  </h3>
                  <p className="mt-3 text-sm proofpoint-card-muted">
                    Risk scores, segmentation, and visibility into attacked, vulnerable, and privileged
                    people. Cloud protection deployed and not deployed views.
                  </p>
                </div>
                <div className="proofpoint-card">
                  <h3 className="text-lg font-semibold text-white">
                    Cloud Risk
                  </h3>
                  <p className="mt-3 text-sm proofpoint-card-muted">
                    Cloud risk overview, risk scores (attacked, vulnerable, privileged, overall), and
                    application status.
                  </p>
                </div>
                <div className="proofpoint-card">
                  <h3 className="text-lg font-semibold text-white">
                    Getting Started
                  </h3>
                  <p className="mt-3 text-sm proofpoint-card-muted">
                    Accessing the NPRE, navigating between views, main window (People Risk, Cloud
                    Risk, Reports).
                  </p>
                </div>
                <div className="proofpoint-card">
                  <h3 className="text-lg font-semibold text-white">
                    Target Groups
                  </h3>
                  <p className="mt-3 text-sm proofpoint-card-muted">
                    People Risk and Cloud Risk target groups, Venn diagram, dashboard, and
                    segment-specific information.
                  </p>
                </div>
              </div>
              <div className="mt-10">
                <Link
                  to="/proofpoint"
                  className="text-sm font-medium proofpoint-link"
                >
                  Browse full documentation and table of contents →
                </Link>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="proofpoint-footer px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
              <Link to="/proofpoint">
                ← Back to Proofpoint Help
              </Link>
              <p className="proofpoint-copyright">© Proofpoint. All rights reserved.</p>
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
        </div>
      </ThemeProvider>
    </CustomerRouteProvider>
  );
}
