/**
 * Shared Proofpoint header + banner to match the main page styling.
 * Use on all Proofpoint internal pages (CASB, Web Security, NPRE).
 */
import { Link } from "react-router-dom";
import { AutoProposeQuestionsToggle } from "./AutoProposeQuestionsToggle";
import "./Proofpoint.css";

interface ProofpointHeaderProps {
  loggedInUserName?: string;
  accountName?: string;
  eligibleProductsText?: string;
  autoProposeQuestionsEnabled?: boolean;
  onAutoProposeQuestionsChange?: (enabled: boolean) => void;
}

export function ProofpointHeader({
  loggedInUserName,
  accountName,
  eligibleProductsText,
  autoProposeQuestionsEnabled,
  onAutoProposeQuestionsChange,
}: ProofpointHeaderProps) {
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
        <div className="flex flex-1 min-w-0 justify-end items-center gap-2 sm:gap-3">
          {onAutoProposeQuestionsChange != null && autoProposeQuestionsEnabled != null ? (
            <AutoProposeQuestionsToggle
              enabled={autoProposeQuestionsEnabled}
              onChange={onAutoProposeQuestionsChange}
              variant="on-dark"
            />
          ) : null}
          {loggedInUserName ? (
            <div className="relative shrink-0 group">
              <span
                className="inline-flex h-9 max-w-[220px] pl-2 pr-3 rounded-full border items-center justify-center gap-2 text-sm font-semibold text-white border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)_inset] cursor-default truncate"
                tabIndex={0}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/25 text-[10px] font-bold text-cyan-100">
                  {loggedInUserName.charAt(0)}
                </span>
                {loggedInUserName}
              </span>
              {accountName ? (
                <div className="pointer-events-none absolute right-0 top-full mt-1 z-50 rounded-md border border-cyan-300/30 bg-slate-900 px-2 py-1 text-xs text-cyan-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <div className="whitespace-nowrap">Account: {accountName}</div>
                  {eligibleProductsText ? (
                    <div className="whitespace-nowrap">Eligable Products: {eligibleProductsText}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
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
