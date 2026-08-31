"use client";

import { useEffect, useRef, useState } from "react";

interface SearchResult {
  docId: string;
  title: string;
  source: string;
  score: number;
  snippet: string;
}

interface SearchResponse {
  results: SearchResult[];
  corrections: Record<string, string>;
  tookMs: number;
}

export function SearchInterface({ totalDocs, vocabularySize }: { totalDocs: number; vocabularySize: number }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    debounceRef.current = setTimeout(
      async () => {
        const thisRequestId = ++requestIdRef.current;

        if (trimmed === "") {
          setResponse(null);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
          const data: SearchResponse = await res.json();
          // an older, slower request could resolve after a newer one -
          // only the most recent request is allowed to update the screen
          if (thisRequestId === requestIdRef.current) {
            setResponse(data);
            setIsLoading(false);
          }
        } catch {
          if (thisRequestId === requestIdRef.current) setIsLoading(false);
        }
      },
      trimmed === "" ? 0 : 250,
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "curiouser and curiouser", fox OR crow, or Holmes -Watson'
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground shadow-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          autoFocus
        />
        {isLoading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">Searching...</span>}
      </div>

      <button onClick={() => setShowHelp((v) => !v)} className="self-start text-xs text-muted underline decoration-dotted hover:text-foreground">
        {showHelp ? "Hide" : "How does this work?"}
      </button>

      {showHelp && (
        <div className="rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
          <p className="mb-2">
            Every paragraph is stemmed with a full Porter stemmer and indexed into an inverted index -{" "}
            {vocabularySize.toLocaleString()} unique stems across {totalDocs.toLocaleString()} documents. Results are ranked
            with Okapi BM25, which rewards documents where the query terms appear more often, tempered by how long the
            document is - a short paragraph mentioning your term once outranks a long one mentioning it once, but loses to a
            short one mentioning it three times.
          </p>
          <p className="mb-2">
            Query syntax: <code className="rounded bg-background px-1">word word</code> is AND,{" "}
            <code className="rounded bg-background px-1">word OR word</code> is OR,{" "}
            <code className="rounded bg-background px-1">-word</code> excludes a term, and{" "}
            <code className="rounded bg-background px-1">&quot;exact phrase&quot;</code> matches adjacent words in order.
          </p>
          <p className="mb-2">
            A query word with no exact matches is automatically corrected to the closest real word in the index (edit
            distance &le; 2) - try a typo like <code className="rounded bg-background px-1">foxx</code>.
          </p>
          <p>
            Extremely common words (&quot;the&quot;, &quot;and&quot;, &quot;a&quot;...) are dropped before indexing to keep
            the index small and relevant - a phrase like <code className="rounded bg-background px-1">&quot;fox and crow&quot;</code> still
            matches, but a phrase built entirely from common words won&apos;t match anything.
          </p>
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {response.results.length} result{response.results.length === 1 ? "" : "s"}
            </span>
            <span>{response.tookMs.toFixed(1)} ms</span>
          </div>

          {Object.keys(response.corrections).length > 0 && (
            <p className="text-xs text-muted">
              Did you mean:{" "}
              {Object.entries(response.corrections).map(([from, to], i) => (
                <span key={from}>
                  {i > 0 && ", "}
                  <span className="text-foreground">{from}</span> &rarr; <span className="text-foreground">{to}</span>
                </span>
              ))}
              ?
            </p>
          )}

          {response.results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No matches.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {response.results.map((result) => (
                <li key={result.docId} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-serif text-sm font-semibold text-foreground">{result.title}</p>
                    <span className="shrink-0 text-xs text-highlight">score {result.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">{result.snippet}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
