"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TaxonResult } from "@/lib/types";

// Two genera, and the assembly counts NCBI reports for them. Showing the counts
// up front tells you the size of what you're searching before you type.
const GENERA = [
  { name: "Geobacillus", note: "hot springs, compost, oil reservoirs" },
  { name: "Parageobacillus", note: "split from Geobacillus in 2015" },
];

const SPECIES_EXAMPLES = ["Geobacillus icigianus", "Parageobacillus thermoglucosidasius"];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A RefSeq/GenBank protein accession (WP_051985049, NP_..., ABC12345.1) or a
  // bare UID goes straight to its protein page; anything else is a taxon name.
  const ACCESSION_RE = /^([A-Z]{2}_\d+(\.\d+)?|[A-Z]{3}\d{5,}(\.\d+)?|\d{4,})$/i;

  async function resolve(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setQuery(trimmed);

    if (ACCESSION_RE.test(trimmed)) {
      router.push(`/protein/${encodeURIComponent(trimmed)}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/taxon?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as TaxonResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Lookup failed");
      router.push(
        `/species/${data.taxid}?organism=${encodeURIComponent(data.organism)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="rise">
        <h1 className="display max-w-[19ch] text-[34px] font-semibold text-ink sm:text-[42px]">
          Read a bacterial protein record without reading a flat file.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[15px] text-muted">
          Start with a genus or a species. Pick a genome assembly — type-material
          strains come first. Then name a gene or protein, and get the GenPept
          record as a card you can actually scan.
        </p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void resolve(query);
        }}
        className="rise mt-8"
        style={{ animationDelay: "80ms" }}
      >
        <label htmlFor="taxon" className="eyebrow">
          genus, species, or protein accession
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="taxon"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Geobacillus"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-md border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-petrol"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-md bg-petrol px-6 py-3 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            {loading ? "Resolving…" : "Search NCBI"}
          </button>
        </div>
        {loading && <div className="thermal-track mt-3" />}
        {error && (
          <p className="mt-3 rounded-md border border-ember/30 bg-ember-soft px-3 py-2 text-[13px] text-ember">
            {error}
          </p>
        )}
      </form>

      <section className="rise mt-12" style={{ animationDelay: "150ms" }}>
        <p className="eyebrow">browse a genus</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {GENERA.map((g) => (
            <li key={g.name}>
              <button
                type="button"
                onClick={() => void resolve(g.name)}
                className="group flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
              >
                <span>
                  <span className="display text-[19px] italic text-ink transition-colors group-hover:text-petrol">
                    {g.name}
                  </span>
                  <span className="ml-3 text-[12px] text-muted">{g.note}</span>
                </span>
                <span
                  aria-hidden
                  className="data shrink-0 text-[13px] text-muted transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[13px] text-muted">
          Or jump to a species:{" "}
          {SPECIES_EXAMPLES.map((s, i) => (
            <span key={s}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => void resolve(s)}
                className="italic text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
              >
                {s}
              </button>
            </span>
          ))}
        </p>

        <p className="mt-3 text-[13px] text-muted">
          Have a list of accessions?{" "}
          <Link
            href="/batch"
            className="text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
          >
            batch lookup →
          </Link>
        </p>
      </section>
    </div>
  );
}
