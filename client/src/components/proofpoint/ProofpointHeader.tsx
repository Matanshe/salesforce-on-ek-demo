/**
 * Shared Proofpoint header + banner to match the main page styling.
 * Use on all Proofpoint internal pages (CASB, Web Security, NPRE).
 */
import { Link } from "react-router-dom";
import "./Proofpoint.css";

export function ProofpointHeader() {
  return (
    <>
      <header className="proofpoint-header">
        <Link to="/proofpoint" className="flex items-center gap-6">
          <span className="proofpoint-logo">proofpoint.</span>
          <nav className="proofpoint-nav">
            <span>Platform</span>
            <span>Solutions</span>
            <span>Why Proofpoint</span>
            <span>Resources</span>
            <span>Company</span>
          </nav>
        </Link>
        <div className="flex flex-1 max-w-md justify-end items-center gap-3">
          <span className="proofpoint-cta-assess">Assess Your Risk →</span>
          <span className="proofpoint-cta-contact">Contact Us →</span>
        </div>
      </header>
      <div className="proofpoint-banner">
        <span>
          Proofpoint acquires Acuvity to deliver AI security and governance across the agentic workspace. Read more
        </span>
        <span className="shrink-0 opacity-90">×</span>
      </div>
    </>
  );
}
