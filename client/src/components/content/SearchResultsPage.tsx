import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchFastSearch, getResultTitle, getResultContentId, getHelpSearchConfig, type FastSearchResult } from "../../api/fastSearch";
import { fetchHarmonizationData } from "../../api/fetchHarmonizationData";
import { getDescriptionFromHtmlContent } from "../../utils/metaFromHtml";
import { Button } from "../ui/button";
import { useTheme } from "../../contexts/ThemeContext";
import { useCustomerRoute } from "../../contexts/CustomerRouteContext";

const CONCURRENT_HUDMO = 3;

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { basePath } = useCustomerRoute();
  const q = searchParams.get("q") ?? "";

  const [results, setResults] = useState<FastSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** result.id -> description (summary from get-hudmo) */
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setDescriptions({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setDescriptions({});
    fetchFastSearch({
      q: q.trim(),
      rankingMode: "Interleaved",
      configurationName: getHelpSearchConfig(),
    })
      .then((data) => setResults(data.results ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [q]);

  const fetchDescriptions = useCallback((resultList: FastSearchResult[]) => {
    const withContentId = resultList
      .map((r) => ({ result: r, contentId: getResultContentId(r) }))
      .filter((x): x is { result: FastSearchResult; contentId: string } => !!x.contentId);
    if (withContentId.length === 0) return;

    const run = async (index: number) => {
      if (index >= withContentId.length) return;
      const { result, contentId } = withContentId[index];
      try {
        const data = await fetchHarmonizationData(result.apiName, contentId);
        const content = data?.attributes?.content;
        const desc =
          (typeof content === "string" && getDescriptionFromHtmlContent(content)) || "";
        if (desc) {
          setDescriptions((prev) => ({ ...prev, [result.id]: desc }));
        }
      } catch {
        // ignore per-result failures
      }
      await run(index + CONCURRENT_HUDMO);
    };
    for (let i = 0; i < CONCURRENT_HUDMO; i++) run(i);
  }, []);

  useEffect(() => {
    if (results.length > 0) fetchDescriptions(results);
  }, [results, fetchDescriptions]);

  const onResultClick = (result: FastSearchResult) => {
    const contentId = getResultContentId(result);
    if (contentId) {
      navigate(`${basePath}/article/${encodeURIComponent(contentId)}`);
    }
  };

  const hasQuery = q.trim().length >= 2;

  return (
    <div className="w-full min-h-[calc(100vh-200px)] bg-gradient-to-b from-gray-50/80 to-white">
      <section className="py-6 px-4 sm:px-6 bg-white/95 backdrop-blur border-b border-gray-200/80 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1.5 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 hover:text-[var(--theme-primary-hover)]"
            onClick={() => navigate(basePath)}
          >
            {theme.labels.backToHelp}
          </Button>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
            {hasQuery ? `Results for “${q.trim()}”` : "Search"}
          </h1>
          {hasQuery && !loading && !error && results.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
          )}
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {!hasQuery && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white/50 px-6 py-10 text-center">
              <p className="text-gray-600">Enter at least 2 characters in the search bar above and press Enter to see results here.</p>
            </div>
          )}
          {hasQuery && loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
              <p className="text-sm text-gray-500">Searching…</p>
            </div>
          )}
          {hasQuery && !loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-6 py-6">
              <p className="text-sm font-medium text-red-800">Something went wrong</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          )}
          {hasQuery && !loading && !error && results.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
              <p className="text-gray-600">No results for “{q.trim()}”. Try different words.</p>
            </div>
          )}
          {hasQuery && !loading && !error && results.length > 0 && (
            <ul className="space-y-3">
              {results.map((result) => {
                const title = getResultTitle(result);
                const contentId = getResultContentId(result);
                const isArticle = !!contentId;
                const description = descriptions[result.id];
                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => onResultClick(result)}
                      className={`group w-full text-left rounded-xl border bg-white px-5 py-4 shadow-sm transition-all duration-200 ${isArticle ? "hover:border-[var(--theme-primary)] hover:shadow-md hover:bg-[color-mix(in_srgb,var(--theme-primary)_4%,transparent)] cursor-pointer active:scale-[0.998]" : "cursor-default border-gray-200/80"}`}
                    >
                      <span className="font-medium text-gray-900 block group-hover:text-[var(--theme-primary)] transition-colors">{title}</span>
                      {description ? (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2 leading-snug">{description}</p>
                      ) : contentId ? (
                        <p className="mt-2 text-sm text-gray-400 italic">Loading description…</p>
                      ) : null}
                      <span className="mt-2 inline-block text-xs text-gray-400">
                        {isArticle ? `${theme.labels.openInHelp} →` : result.apiName}
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
