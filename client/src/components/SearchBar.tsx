import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "./ui/input";
import {
  fetchFastSearch,
  getResultTitle,
  getResultContentId,
  type FastSearchResult,
} from "../api/fastSearch";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

const SEARCH_CONFIGS = [
  { value: "", label: "Global search" },
  { value: "SFDCHelp7 DMO harmonized", label: "Help (SFDCHelp7 DMO harmonized)" },
] as const;

export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [config, setConfig] = useState("");
  const [results, setResults] = useState<FastSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string, configurationName: string) => {
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
        configurationName: configurationName.trim() || undefined,
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
      runSearch(query, config);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, config, runSearch]);

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
    const params = new URLSearchParams({ q: query.trim() });
    if (config.trim()) params.set("configurationName", config.trim());
    navigate(`/search?${params.toString()}`);
    setOpen(false);
  };

  const showDropdown = open && (results.length > 0 || loading || (query.trim().length >= MIN_QUERY_LENGTH && !loading && query.trim().length > 0));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex gap-2 items-center w-full">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <SearchIcon className="h-4 w-4" />
          </span>
          <Input
            type="search"
            placeholder="Search documents…"
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
            className="pl-9"
            aria-label="Search"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
          />
        </div>
        <select
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search scope"
        >
          {SEARCH_CONFIGS.map(({ value, label }) => (
            <option key={value || "global"} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 max-h-[min(60vh,320px)] overflow-y-auto"
          role="listbox"
        >
          {loading && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Searching…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          {!loading && !error && results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No results for &quot;{query.trim()}&quot;. Try <strong>Global search</strong> or a different query.
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
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent focus:bg-accent focus:outline-none ${isArticle ? "cursor-pointer" : "cursor-default"}`}
                        role="option"
                      >
                        <span className="font-medium text-foreground">{title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {result.apiName}
                          {isArticle && " · Open in Help"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className="text-sm text-[#0176D3] hover:underline w-full text-left"
                >
                  See all results →
                </button>
              </div>
            </>
          )}
          {!loading && query.trim().length >= MIN_QUERY_LENGTH && (results.length === 0 || error) && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={goToSearchPage}
                className="text-sm text-[#0176D3] hover:underline w-full text-left"
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
