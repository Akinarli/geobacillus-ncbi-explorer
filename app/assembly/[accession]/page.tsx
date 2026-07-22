"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProteinResultCard from "@/components/ProteinResultCard";
import type {
  ProteinHit,
  ProteinRecord,
  ProteinSuggestion,
} from "@/lib/types";

const PAGE_SIZE = 12; // records fetched per "load more" batch
const CONCURRENCY = 3; // parallel NCBI fetches, to stay under the rate limit
const MAX_HITS = 200; // how many matching ids we ask NCBI for up front

export default function AssemblyPage({
  params,
}: {
  params: Promise<{ accession: string }>;
}) {
  return (
    <Suspense fallback={<div className="thermal-track" />}>
      <AssemblyView params={params} />
    </Suspense>
  );
}

function AssemblyView({ params }: { params: Promise<{ accession: string }> }) {
  const { accession } = use(params);
  const searchParams = useSearchParams();
  const taxid = searchParams.get("taxid") ?? "";
  const organism = searchParams.get("organism") ?? "";
  const name = searchParams.get("name") ?? "";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "searching" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ProteinRecord[]>([]);
  const [allHits, setAllHits] = useState<ProteinHit[]>([]);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<ProteinSuggestion[]>([]);
  const [searchedTerm, setSearchedTerm] = useState("");
  // Set when the exact word matched nothing and results were broadened to a
  // wildcard (e.g. "levan" → "levan*"), so we can say so above the results.
  const [broadenedFrom, setBroadenedFrom] = useState("");

  const recordKey = (r: ProteinRecord) =>
    (r.version || r.accession || "").toLowerCase();

  // Fetch one record and append it, skipping duplicates — genus-wide searches
  // return the same RefSeq protein once per strain, so dedupe by accession.
  async function fetchOne(hit: ProteinHit) {
    try {
      const r = await fetch(`/api/protein-fetch?id=${encodeURIComponent(hit.id)}`);
      const rec = (await r.json()) as ProteinRecord & { error?: string };
      if (r.ok && !rec.error) {
        setRecords((prev) =>
          prev.some((x) => recordKey(x) === recordKey(rec)) ? prev : [...prev, rec],
        );
      } else {
        setFetchErrors((prev) => [
          ...prev,
          rec.error ?? `HTTP ${r.status} for ${hit.id}`,
        ]);
      }
    } catch (err) {
      setFetchErrors((prev) => [
        ...prev,
        err instanceof Error ? err.message : `failed to load ${hit.id}`,
      ]);
    }
  }

  // Fetch a batch of hits a few at a time so we stay under NCBI's rate limit.
  async function fetchBatch(hits: ProteinHit[]) {
    const queue = [...hits];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        let next: ProteinHit | undefined;
        while ((next = queue.shift())) await fetchOne(next);
      }),
    );
  }

  async function runSearch(rawTerm: string) {
    const q = rawTerm.trim();
    if (!q || !taxid) return;
    setQuery(q);
    setSearchedTerm(q);
    setStatus("searching");
    setError(null);
    setRecords([]);
    setAllHits([]);
    setFetchedCount(0);
    setFetchErrors([]);
    setSuggestions([]);
    setBroadenedFrom("");

    try {
      const res = await fetch(
        `/api/protein-search?q=${encodeURIComponent(q)}&taxid=${encodeURIComponent(taxid)}&retmax=${MAX_HITS}`,
      );
      const data = (await res.json()) as {
        hits?: ProteinHit[];
        suggestions?: ProteinSuggestion[];
        broadenedFrom?: string;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Search failed");

      setSuggestions(data.suggestions ?? []);
      if (data.broadenedFrom) setBroadenedFrom(data.broadenedFrom);

      const hits = data.hits ?? [];
      setAllHits(hits);
      if (hits.length === 0) {
        setStatus("done");
        return;
      }

      const first = hits.slice(0, PAGE_SIZE);
      setFetchedCount(first.length);
      await fetchBatch(first);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("done");
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const start = fetchedCount;
    const slice = allHits.slice(start, start + PAGE_SIZE);
    setFetchedCount(start + slice.length);
    await fetchBatch(slice);
    setLoadingMore(false);
  }

  // One shared scale across the result set makes the bars comparable.
  const maxLength = records.reduce((m, r) => Math.max(m, r.length ?? 0), 0) || 1;
  const searching = status === "searching";
  const hasMore = fetchedCount < allHits.length;

  return (
    <div>
      <nav className="eyebrow flex flex-wrap items-center gap-2">
        <Link href="/" className="text-muted no-underline hover:text-ink">
          search
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/species/${taxid}?organism=${encodeURIComponent(organism)}`}
          className="text-muted no-underline hover:text-ink"
        >
          {organism || "assemblies"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{accession}</span>
      </nav>

      <header className="mt-3">
        <h1 className="data text-[20px] font-medium text-ink">{accession}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {name && name !== accession && <>{name} · </>}
          <span className="italic">{organism}</span>
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query);
        }}
        className="mt-7"
      >
        <label htmlFor="protein" className="eyebrow">
          gene or protein name
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="protein"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="flippase"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-md border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-petrol"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="rounded-md bg-petrol px-6 py-3 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            {searching ? "Fetching…" : "Search"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Scoped to taxid <span className="data">{taxid}</span> — RefSeq shares
          protein records across strains of a species.
        </p>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-ember/30 bg-ember-soft px-3 py-2 text-[13px] text-ember">
          {error}
        </p>
      )}

      {/* Progress reflects real round-trips: one per record still in flight. */}
      {searching && (
        <div className="mt-7">
          <div className="thermal-track" />
          <p className="eyebrow mt-2">
            {allHits.length > 0
              ? `${records.length} of ${Math.min(PAGE_SIZE, allHits.length)} records retrieved`
              : "querying ncbi"}
          </p>
        </div>
      )}

      {/* Results were broadened because the exact word matched nothing. Say so,
          and offer to narrow to a specific protein name. */}
      {records.length > 0 && broadenedFrom && (
        <div className="mt-8 rounded-lg border border-petrol/25 bg-petrol-soft/40 p-4">
          <p className="text-[13px] text-ink">
            No protein titled exactly “{broadenedFrom}”. Showing everything
            starting with{" "}
            <span className="data font-medium">{broadenedFrom}</span>.
          </p>
          {suggestions.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="eyebrow">narrow to</span>
              {suggestions.map((s) => (
                <button
                  key={s.term}
                  type="button"
                  onClick={() => void runSearch(s.term)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface py-1 pl-3 pr-1.5 text-[12px] text-ink transition-colors hover:border-petrol"
                >
                  {s.term}
                  <span className="data rounded-full bg-sunk px-1.5 py-0.5 text-[10px] text-muted group-hover:bg-petrol-soft">
                    {s.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {records.length > 0 && (
        <>
          <p className="eyebrow mt-8">
            {records.length} distinct record{records.length === 1 ? "" : "s"}
            {allHits.length > fetchedCount && ` · ${allHits.length} matches total`}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {records.map((rec, i) => (
              <ProteinResultCard
                key={recordKey(rec)}
                record={rec}
                maxLength={maxLength}
                index={i}
              />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-4 w-full rounded-md border border-rule bg-surface py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-petrol disabled:opacity-40"
            >
              {loadingMore
                ? "Loading…"
                : `Load ${Math.min(PAGE_SIZE, allHits.length - fetchedCount)} more`}
            </button>
          )}
          {loadingMore && <div className="thermal-track mt-3" />}
        </>
      )}

      {/* NCBI's title index matches whole words, so "levan" misses
          "levansucrase". Offer verified alternatives instead of a dead end. */}
      {status === "done" && allHits.length === 0 && !error && (
        <section className="mt-8 rounded-lg border border-rule bg-surface p-5">
          <p className="text-[14px] text-ink">
            No protein titled “{searchedTerm}” in this organism.
          </p>
          {suggestions.length > 0 ? (
            <>
              <p className="eyebrow mt-4">did you mean</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <li key={s.term}>
                    <button
                      type="button"
                      onClick={() => void runSearch(s.term)}
                      className="group inline-flex items-center gap-2 rounded-full border border-rule bg-paper py-1.5 pl-3.5 pr-2 text-[13px] text-ink transition-colors hover:border-petrol"
                    >
                      {s.term}
                      <span className="data rounded-full bg-sunk px-1.5 py-0.5 text-[10px] text-muted transition-colors group-hover:bg-petrol-soft">
                        {s.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              Try a broader term, or the full protein name as NCBI writes it.
            </p>
          )}
        </section>
      )}

      {status === "done" && allHits.length > 0 && records.length === 0 && (
        <div className="mt-8 rounded-lg border border-ember/30 bg-ember-soft p-4 text-[13px] text-ember">
          <p>
            Found {allHits.length} match{allHits.length === 1 ? "" : "es"} but none
            could be retrieved. NCBI may be rate-limiting — check that
            NCBI_API_KEY is set.
          </p>
          {fetchErrors.length > 0 && (
            <ul className="data mt-2 list-disc pl-5 text-[11px] opacity-80">
              {fetchErrors.slice(0, 3).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status === "done" && records.length > 0 && fetchErrors.length > 0 && (
        <p className="eyebrow mt-3">
          {fetchErrors.length} record{fetchErrors.length === 1 ? "" : "s"} could
          not be retrieved
        </p>
      )}
    </div>
  );
}
