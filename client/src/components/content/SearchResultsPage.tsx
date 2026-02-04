import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchFastSearch, getResultTitle, getResultContentId, type FastSearchResult } from "../../api/fastSearch";
import { Button } from "../ui/button";

const SEARCH_CONFIGS: { value: string; label: string }[] = [
  { value: "", label: "Global search" },
  { value: "SFDCHelp7 DMO harmonized", label: "Help (SFDCHelp7 DMO harmonized)" },
];

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") ?? "";
  const configParam = searchParams.get("configurationName") ?? "";

  const [results, setResults] = useState<FastSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchFastSearch({
      q: q.trim(),
      rankingMode: "Interleaved",
      configurationName: configParam.trim() || undefined,
    })
      .then((data) => setResults(data.results ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [q, configParam]);

  const onResultClick = (result: FastSearchResult) => {
    const contentId = getResultContentId(result);
    if (contentId) {
      navigate(`/article/${encodeURIComponent(contentId)}`);
    }
  };

  const updateConfig = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("configurationName", value);
    else next.delete("configurationName");
    setSearchParams(next, { replace: true });
  };

  const hasQuery = q.trim().length >= 2;

  return (
    <div className="w-full bg-gray-50 min-h-[calc(100vh-200px)]">
      <section className="py-6 px-4 sm:px-6 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button variant="ghost" size="sm" className="self-start text-[#0176D3] hover:bg-[#0176D3]/10" onClick={() => navigate("/")}>
              ← Back to Help
            </Button>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {hasQuery ? `Search results for “${q.trim()}”` : "Search"}
            </h1>
          </div>
          {hasQuery && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Scope:</span>
              <select
                value={configParam}
                onChange={(e) => updateConfig(e.target.value)}
                className="h-9 rounded-md border border-input bg-white px-2 text-sm text-foreground"
              >
                {SEARCH_CONFIGS.map(({ value, label }) => (
                  <option key={value || "global"} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {!hasQuery && (
            <p className="text-gray-600">Use the search bar above and enter at least 2 characters, then press Enter to see results here.</p>
          )}
          {hasQuery && loading && (
            <p className="text-gray-600">Searching…</p>
          )}
          {hasQuery && !loading && error && (
            <p className="text-destructive">{error}</p>
          )}
          {hasQuery && !loading && !error && results.length === 0 && (
            <p className="text-gray-600">No results. Try <strong>Global search</strong> or a different query.</p>
          )}
          {hasQuery && !loading && !error && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((result) => {
                const title = getResultTitle(result);
                const contentId = getResultContentId(result);
                const isArticle = !!contentId;
                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => onResultClick(result)}
                      className={`w-full text-left rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors ${isArticle ? "hover:border-[#0176D3] hover:bg-[#0176D3]/5 cursor-pointer" : "cursor-default opacity-90"}`}
                    >
                      <span className="font-medium text-gray-900">{title}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {result.apiName}
                        {isArticle && " · Open in Help"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
