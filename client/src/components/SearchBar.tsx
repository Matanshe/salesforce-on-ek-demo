import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "./ui/input";
import {
  fetchFastSearch,
  getResultTitle,
  getResultContentId,
  getHelpSearchConfig,
  type FastSearchResult,
} from "../api/fastSearch";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FastSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFastSearch({
        q: q.trim(),
        rankingMode: "Interleaved",
        configurationName: getHelpSearchConfig(),
      });
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => {
      runSearch(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onResultClick = (result: FastSearchResult) => {
    const contentId = getResultContentId(result);
    if (contentId) {
      navigate(`/article/${encodeURIComponent(contentId)}`);
      setOpen(false);
      setQuery("");
      setResults([]);
    }
  };

  const goToSearchPage = () => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };

  const showDropdown = open && (results.length > 0 || loading || (query.trim().length >= MIN_QUERY_LENGTH && !loading && query.trim().length > 0));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center w-full">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <SearchIcon className="h-4 w-4" />
          </span>
          <Input
            type="search"
            placeholder="Search help articles…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim().length >= MIN_QUERY_LENGTH) {
                e.preventDefault();
                goToSearchPage();
              }
            }}
            onFocus={() => setOpen(true)}
            className="pl-10 pr-4 h-10 rounded-lg border-gray-200 bg-gray-50/80 focus:bg-white focus:border-[#0176D3] focus:ring-2 focus:ring-[#0176D3]/20 transition-colors placeholder:text-gray-400"
            aria-label="Search"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
          />
        </div>
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg z-50 max-h-[min(60vh,360px)] overflow-y-auto"
          role="listbox"
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0176D3] border-t-transparent" />
              Searching…
            </div>
          )}
          {!loading && error && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH && (
            <div className="px-4 py-5 text-sm text-gray-500 text-center">
              No results for “{query.trim()}”
            </div>
          )}
          {!loading && results.length > 0 && (
            <>
              <ul className="py-1">
                {results.map((result) => {
                  const title = getResultTitle(result);
                  const contentId = getResultContentId(result);
                  const isArticle = !!contentId;
                  return (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => onResultClick(result)}
                        className={`w-full text-left px-4 py-2.5 text-sm rounded-lg mx-1 my-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-[#0176D3]/30 ${isArticle ? "hover:bg-[#0176D3]/10 cursor-pointer" : "cursor-default text-gray-600"}`}
                        role="option"
                      >
                        <span className={`font-medium block ${isArticle ? "text-gray-900" : "text-gray-700"}`}>{title}</span>
                        {isArticle && <span className="text-xs text-[#0176D3] mt-0.5 block">Open in Help</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50/80 rounded-b-xl">
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className="text-sm font-medium text-[#0176D3] hover:text-[#014486] w-full text-left px-2 py-1.5 rounded-md hover:bg-[#0176D3]/10 transition-colors"
                >
                  See all results →
                </button>
              </div>
            </>
          )}
          {!loading && query.trim().length >= MIN_QUERY_LENGTH && (results.length === 0 || error) && (
            <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50/80 rounded-b-xl">
              <button
                type="button"
                onClick={goToSearchPage}
                className="text-sm font-medium text-[#0176D3] hover:text-[#014486] w-full text-left px-2 py-1.5 rounded-md hover:bg-[#0176D3]/10 transition-colors"
              >
                Open search results page →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
