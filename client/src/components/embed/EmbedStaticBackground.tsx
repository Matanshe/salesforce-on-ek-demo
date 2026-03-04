/**
 * Static, non-interactive background for the embed page (salesforce?embed=1).
 * Matches the Salesforce landing: white header + dark blue hero. pointer-events: none
 * so the chat widget overlay remains clickable.
 */
import salesforceLogo from "../../assets/Salesforce Logo.jpeg";

export function EmbedStaticBackground() {
  return (
    <div
      className="fixed inset-0 z-0 overflow-auto bg-[#0D3084]"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {/* White header bar */}
      <header className="sticky top-0 z-10 flex h-[70px] min-h-[70px] w-full items-center justify-between gap-4 bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <img
            src={salesforceLogo}
            alt=""
            className="h-7 object-contain"
          />
          <nav className="hidden items-center gap-5 text-sm font-medium text-gray-800 md:flex">
            <span>Products</span>
            <span>Industries</span>
            <span>Customers</span>
            <span>Events</span>
            <span>Learning</span>
            <span>Support</span>
            <span>Company</span>
          </nav>
        </div>
        <div className="flex flex-1 max-w-md justify-end items-center gap-3">
          <div className="hidden text-right text-sm text-gray-700 lg:block">
            <div>Contact Us</div>
            <div className="text-xs">+353 14403500</div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V3.935M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Login</span>
          </div>
          <div className="h-9 px-4 rounded bg-[#2E844A] flex items-center justify-center text-white text-sm font-medium shrink-0">
            Start for free
          </div>
        </div>
      </header>

      {/* Dark blue hero with gradient / glow */}
      <div className="relative min-h-[calc(100vh-70px)] flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 70% 40%, rgba(79,195,247,0.25) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 flex max-w-3xl flex-col items-center text-center">
          <p className="text-white text-base sm:text-lg mb-2">
            Salesforce. The #1 AI CRM.
          </p>
          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
            Humans and agents drive
            <br />
            <span className="text-[#4FC3F7]">customer success together.</span>
          </h1>
          <p className="mt-6 text-white/95 text-base sm:text-lg max-w-2xl leading-relaxed">
            Agentforce transforms Sales, Service, Commerce, Marketing, IT, and more by uniting apps, data, and agents on one trusted platform. Now every department is an engine for growing customer success - from Sales following up on every lead instantly to Service delivering 24/7 expertise. Proven ROI, delivered.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <span className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-md bg-[#0176D3] px-6 text-sm font-medium text-white">
              Explore Agentforce
            </span>
            <span className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-md border-2 border-[#0176D3] bg-white px-6 text-sm font-medium text-[#0176D3]">
              Calculate your ROI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
