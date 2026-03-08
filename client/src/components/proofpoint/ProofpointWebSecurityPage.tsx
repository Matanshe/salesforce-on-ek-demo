/**
 * Proofpoint Web Security data sheet page.
 * Mimics https://www.proofpoint.com/us/resources/data-sheets/proofpoint-web-security
 */
import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { CustomerRouteProvider } from "@/contexts/CustomerRouteContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CitationModal } from "@/components/content/CitationModal";
import { fetchCitationModal } from "@/api/fetchCitationModal";
import type { CitationModalResult } from "@/api/fetchCitationModal";
import { ProofpointHeader } from "./ProofpointHeader";
import "./Proofpoint.css";

const CUSTOMER_ID = "proofpoint";

export function ProofpointWebSecurityPage() {
  const { pathname } = useLocation();
  const chatProps = useAgentChat(CUSTOMER_ID, pathname);
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

  return (
    <CustomerRouteProvider customerId="proofpoint">
      <ThemeProvider customerId="proofpoint">
    <div className="proofpoint-page min-h-screen">
      <ProofpointHeader />

      {/* Hero */}
      <section
        className="proofpoint-hero relative flex flex-col items-center justify-center px-4 py-16 sm:py-24"
      >
        <div className="relative z-10 max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Proofpoint Web Security
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-white/95">
            Protect users from all types of internet-based threats with dynamic access controls,
            advanced threat protection, and data loss prevention. People-centric protection
            regardless of where users are or what network they use.
          </p>
          <a
            href="#"
            className="proofpoint-btn-primary"
          >
            Download the data sheet
          </a>
        </div>
      </section>

      {/* Content */}
      <main className="proofpoint-section px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-white/80">
            <Link to="/proofpoint" className="proofpoint-link hover:underline">
              Resources
            </Link>
            <span className="mx-2 text-white/60">/</span>
            <span className="text-white">Proofpoint Web Security</span>
          </p>
          <span
            className="mt-4 inline-block rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide proofpoint-badge"
          >
            Data Sheet
          </span>
          <p className="mt-6 text-base leading-relaxed text-white/80">
            Proofpoint Web Security protects users from all types of internet-based threats by
            applying dynamic access controls, advanced threat protection and data loss prevention
            policies. Web Security uses a people-centric approach to protection regardless of
            where the users are or what network they belong to.
          </p>
          <dl className="mt-10 grid gap-4 border-t border-white/10 pt-10 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-white/60">Focus</dt>
              <dd className="mt-1 text-sm font-medium text-white">Data Security</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-white/60">Published</dt>
              <dd className="mt-1 text-sm font-medium text-white">January 14, 2021</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-white/60">Type</dt>
              <dd className="mt-1 text-sm font-medium text-white">Data Sheet</dd>
            </div>
          </dl>
        </div>
      </main>

      {/* Footer CTA */}
      <section
        className="px-4 py-16 sm:px-6 lg:px-8"
        style={{ backgroundColor: "var(--proofpoint-dark)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Turn <em>people</em> into your <em>best defense</em> with Proofpoint
          </h2>
          <div className="mt-8">
            <a
              href="#"
              className="proofpoint-btn-primary"
            >
              Get in Touch
            </a>
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
      />
    </div>
      </ThemeProvider>
    </CustomerRouteProvider>
  );
}
