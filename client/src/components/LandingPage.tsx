import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Customer {
  id: string;
  name: string;
  primaryColor?: string;
  primaryHoverColor?: string;
  logoUrl?: string | null;
}

function TileIcon({ color }: { color: string }) {
  return (
    <svg className="w-10 h-10 opacity-90" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ArrowIcon({ color }: { color: string }) {
  return (
    <svg className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

export function LandingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/customers`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load customers: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.customers)) {
          setCustomers(data.customers);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTileClick = (customerId: string) => {
    navigate(`/${encodeURIComponent(customerId)}`, { replace: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading portals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-6 py-4 max-w-md text-center">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4">
        <p className="text-slate-500 font-medium">No customers configured.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <header className="py-12 sm:py-16 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-800">Help Portals</h1>
        <p className="mt-2 text-slate-500 text-sm sm:text-base max-w-sm mx-auto">Select a customer to open their documentation and support site.</p>
      </header>
      <main className="flex-1 px-4 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {customers.map((customer) => {
            const primary = customer.primaryColor ?? "#0176D3";
            const primaryHover = customer.primaryHoverColor ?? "#014486";
            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleTileClick(customer.id)}
                className="group group/card relative flex flex-col items-start text-left rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8fafc]"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderLeftColor = primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderLeftColor = primary;
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="flex items-center justify-center w-12 h-12 rounded-xl transition-colors group-hover/card:opacity-90 flex-shrink-0"
                    style={{ backgroundColor: `${primary}18`, color: primary }}
                  >
                    <TileIcon color={primary} />
                  </span>
                  {customer.logoUrl ? (
                    <span className="flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden">
                      <img
                        src={customer.logoUrl}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </span>
                  ) : (
                    <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                      <ArrowIcon color={primary} />
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-800 group-hover/card:text-slate-900">
                  {customer.name}
                </h2>
                <span className="mt-1.5 inline-block text-xs font-medium uppercase tracking-wider" style={{ color: primary }}>
                  {customer.id}
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
