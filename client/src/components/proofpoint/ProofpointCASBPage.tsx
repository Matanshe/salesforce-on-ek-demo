/**
 * Proofpoint CASB (Cloud App Security Broker) product page.
 * Mimics https://www.proofpoint.com/us/products/cloud-security/cloud-app-security-broker
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

export function ProofpointCASBPage() {
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
            Cloud App Security Broker
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-white/95">
            Proofpoint Cloud App Security Broker (CASB) secures your cloud users, apps and data from
            threats, data loss, and compliance risks. It gives you the ability to protect sensitive
            data and respond to cloud security incidents with instant context. And it seamlessly
            integrates user visibility and threat intelligence from the cloud with email, endpoint and
            web.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#demo" className="proofpoint-btn-primary">
              Download the ebook
            </a>
            <a href="#demo" className="proofpoint-btn-outline">
              Request a demo
            </a>
          </div>
        </div>
      </section>

      {/* Tabs: Overview, Key Features, Resources, Request a Demo */}
      <nav className="proofpoint-tabs flex gap-8 text-sm font-medium px-4 sm:px-6 lg:px-8">
        <a href="#overview" className="border-b-2 border-transparent py-4">Overview</a>
        <a href="#key-features" className="border-b-2 border-transparent py-4">Key Features</a>
        <a href="#resources" className="border-b-2 border-transparent py-4">Resources</a>
        <a href="#demo" className="proofpoint-tab-active border-b-2 py-4">Request a Demo</a>
      </nav>

      {/* Overview - three cards */}
      <section id="overview" className="proofpoint-section px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Overview</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div className="proofpoint-card">
              <h3 className="text-lg font-semibold text-white">
                Data security
              </h3>
              <p className="mt-2 text-sm font-medium text-white/90">
                Cloud data loss and insider threats
              </p>
              <p className="mt-3 text-sm proofpoint-card-muted">
                Data loss can be triggered by careless, malicious or compromised users. CASB is
                integrated into our Enterprise Data Loss Prevention (DLP) solution to accelerate
                incident response with user and threat context behind risky data movement. You can
                simplify your cloud DLP policy management with our built-in DLP classifiers and
                advanced machine learning (ML) detectors.
              </p>
              <p className="mt-3 text-sm font-medium proofpoint-link">
                Enterprise Data Loss Prevention solution →
              </p>
            </div>
            <div className="proofpoint-card">
              <h3 className="text-lg font-semibold text-white">
                Cloud security
              </h3>
              <p className="mt-2 text-sm font-medium text-white/90">Cloud account takeovers</p>
              <p className="mt-3 text-sm proofpoint-card-muted">
                CASB protects you from account takeovers in Microsoft 365, Google Workspace and Okta
                services. It correlates threat intelligence across phishing attempts, known threat
                infrastructure, prior credential dumps, and brute-force campaigns. Accelerate incident
                response with context into threats, users and behaviors across email and cloud
                services.
              </p>
              <p className="mt-3 text-sm font-medium proofpoint-link">
                Download the solution brief →
              </p>
            </div>
            <div className="proofpoint-card">
              <h3 className="text-lg font-semibold text-white">
                Shadow IT
              </h3>
              <p className="mt-2 text-sm font-medium text-white/90">Third-party OAuth app abuse</p>
              <p className="mt-3 text-sm proofpoint-card-muted">
                Reducing your attack surface from first-party and third-party apps is critical to
                data security in a remote-first world. Simplify your shadow IT management with
                visibility from Proofpoint Targeted Attack Protection (TAP), Isolation, and Web
                Security. And automate the remediation of malicious OAuth apps and abused, yet
                legitimate, OAuth apps with CASB.
              </p>
              <p className="mt-3 text-sm font-medium proofpoint-link">
                Download the whitepaper →
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="key-features" className="proofpoint-section border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Key Features</h2>
          <div className="mt-10 space-y-12">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Visibility and executive reporting
              </h3>
              <p className="mt-2 text-sm text-white/80">
                Unlike traditional CASBs that slow down users, Proofpoint enables secure productivity
                with unmatched threat intelligence and DLP.
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-white/70">
                <li>Correlate data loss, cloud threats and shadow IT usage to the user within timeline-based views</li>
                <li>Gain visibility into recently phished users and most attacked users using Proofpoint Targeted Attack Protection</li>
                <li>Follow cloud app attacks from initial access to post-access malicious activities</li>
                <li>Get one view into cloud, email, endpoint and web DLP with Enterprise DLP integration</li>
                <li>Provide reports to executives for data security, MITRE ATT&amp;CK framework and cloud threats</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Machine learning and DLP</h3>
              <p className="mt-2 text-sm text-white/80">
                Go beyond false-positives and data-centric policies to protection from modern data
                loss. With our context-based DLP, you get insight and context that traditional DLP
                can&apos;t provide.
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-white/70">
                <li>Detect negligent, compromised, or malicious users and their anomalous file activity</li>
                <li>Identify sensitive data in the cloud with ML-based data classification and rules honed over two decades of DLP experience</li>
                <li>Use the same data classification and discovery patterns across cloud, email, endpoint and web channels</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Machine learning and threat intelligence-based detection
              </h3>
              <p className="mt-2 text-sm text-white/80">
                Move past simple location and IP-based exclusion policies to protect from modern
                cloud threats.
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-white/70">
                <li>Gain threat intelligence from email and cloud phishing attempts, known threat infrastructure, credential dumps, and brute-force campaigns</li>
                <li>Detect account takeovers more accurately using machine learning to correlate threat intelligence and anomalous user behavior</li>
                <li>Identify malicious third-party OAuth apps and attackers abusing legitimate apps</li>
                <li>Get a timeline-based view that ties the initial access vector to post-access malicious activities</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Deep security ecosystem integrations</h3>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-white/70">
                <li>Supports hundreds of the most popular enterprise SaaS apps and IaaS services</li>
                <li>Deeply integrated with Proofpoint Information Protection, Targeted Attack Protection (TAP), Cloud Security, Threat Response, Emerging Threat Intelligence</li>
                <li>Integrated with SIEMs, SOARs, and ticketing and messaging systems through modern, RESTful APIs in the Proofpoint platform</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Fast time to value</h3>
              <p className="mt-2 text-sm text-white/80">
                With CASB, you get flexible deployment models to meet all your use cases.
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-white/70">
                <li>For immediate visibility with the fewest hassles: Proofpoint CASB with cloud API connectors</li>
                <li>For real-time protection with no endpoint agents: Proofpoint CASB with adaptive access controls</li>
                <li>For more restrictive, real-time cloud controls: Proofpoint CASB with cloud proxy</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="proofpoint-section border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Resources</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="#"
              className="block rounded-lg p-4 transition proofpoint-card hover:border-white/25"
            >
              <span className="text-sm font-medium proofpoint-link">
                Proofpoint Resources
              </span>
              <p className="mt-1 font-semibold text-white">Proofpoint Cloud App Security Broker</p>
            </a>
            <a
              href="#"
              className="block rounded-lg p-4 transition proofpoint-card hover:border-white/25"
            >
              <span className="text-sm font-medium proofpoint-link">
                Proofpoint Resources
              </span>
              <p className="mt-1 font-semibold text-white">Getting Started with CASB</p>
            </a>
            <a
              href="#"
              className="block rounded-lg p-4 transition proofpoint-card hover:border-white/25"
            >
              <span className="text-sm font-medium proofpoint-link">
                Proofpoint Resources
              </span>
              <p className="mt-1 font-semibold text-white">Proofpoint Cloud App Security Broker IaaS Protection</p>
            </a>
          </div>
        </div>
      </section>

      {/* Request a Demo */}
      <section
        id="demo"
        className="px-4 py-16 sm:px-6 lg:px-8"
        style={{ backgroundColor: "var(--proofpoint-dark)" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Request a demo</h2>
          <p className="mt-4 text-white/90">
            Learn how our integrated platform helps you stop cyberattacks, prevent data loss, and
            reduce human risk across your environment.
          </p>
          <div className="mt-8">
            <a
              href="#"
              className="proofpoint-btn-primary"
            >
              Request a demo
            </a>
          </div>
          <p className="mt-6 text-sm text-white/70">
            Thanks for reaching out; a Proofpoint cybersecurity specialist will contact soon.
          </p>
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
