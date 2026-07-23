"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GenomeCard from "@/components/GenomeCard";
import type { Assembly, SpeciesSummary, TaxonResult } from "@/lib/types";

export default function SpeciesPage({
  params,
}: {
  params: Promise<{ taxid: string }>;
}) {
  return (
    <Suspense fallback={<div className="thermal-track" />}>
      <SpeciesView params={params} />
    </Suspense>
  );
}

function SpeciesView({ params }: { params: Promise<{ taxid: string }> }) {
  const { taxid } = use(params);
  const searchParams = useSearchParams();
  const organismHint = searchParams.get("organism") ?? "";

  const [taxon, setTaxon] = useState<TaxonResult | null>(null);
  const [species, setSpecies] = useState<SpeciesSummary[] | null>(null);
  const [assemblies, setAssemblies] = useState<Assembly[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [capped, setCapped] = useState<{ total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTaxon(null);
    setSpecies(null);
    setAssemblies(null);
    setError(null);
    setFilter("");
    setCapped(null);

    (async () => {
      try {
        const tRes = await fetch(`/api/taxon?q=${encodeURIComponent(taxid)}`);
        const tData = (await tRes.json()) as TaxonResult & { error?: string };
        if (!tRes.ok || tData.error) throw new Error(tData.error ?? "Lookup failed");
        if (cancelled) return;
        setTaxon(tData);

        const isGenus = tData.rank?.toUpperCase() === "GENUS";
        const res = await fetch(
          isGenus
            ? `/api/species?taxid=${encodeURIComponent(taxid)}`
            : `/api/genomes?taxid=${encodeURIComponent(taxid)}`,
        );
        const data = (await res.json()) as {
          species?: SpeciesSummary[];
          assemblies?: Assembly[];
          total?: number;
          capped?: boolean;
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? "Failed to load");
        if (cancelled) return;
        if (data.capped) setCapped({ total: data.total ?? 0 });
        if (isGenus) setSpecies(data.species ?? []);
        else setAssemblies(data.assemblies ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [taxid]);

  const filteredSpecies = useMemo(() => {
    if (!species) return null;
    const q = filter.trim().toLowerCase();
    return q ? species.filter((s) => s.organism.toLowerCase().includes(q)) : species;
  }, [species, filter]);

  const isGenus = taxon?.rank?.toUpperCase() === "GENUS";
  const heading = taxon?.organism || organismHint;
  const maxCount = species?.[0]?.assemblyCount ?? 1;

  return (
    <div>
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/" className="text-muted no-underline hover:text-ink">
          search
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{heading || "…"}</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[30px] font-semibold italic text-ink">
          {heading}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {isGenus ? (
            <>
              <span className="data">{taxon?.assemblyCount ?? "—"}</span> genome
              assemblies across{" "}
              <span className="data">{species?.length ?? "—"}</span> species ·
              taxid <span className="data">{taxid}</span>
            </>
          ) : (
            <>
              Genome assemblies · type material first · taxid{" "}
              <span className="data">{taxid}</span>
            </>
          )}
        </p>
      </header>

      {error && (
        <p className="mt-6 rounded-md border border-ember/30 bg-ember-soft px-3 py-2 text-[13px] text-ember">
          {error}
        </p>
      )}

      {capped && (
        <div className="mt-6 rounded-md border border-petrol/25 bg-petrol-soft/40 px-3 py-2 text-[13px] text-ink">
          This taxon has{" "}
          <span className="data">{capped.total.toLocaleString("en-US")}</span>{" "}
          assemblies — showing a sample of the first 1,000. Narrow to a species,
          or{" "}
          <Link
            href="/batch"
            className="text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
          >
            paste protein accessions
          </Link>{" "}
          for precise results.
        </div>
      )}

      {!taxon && !error && <div className="thermal-track mt-8" />}

      {/* ---- Genus: choose a species ---- */}
      {isGenus && species && (
        <section className="mt-7">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${species.length} species`}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-rule bg-surface px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-petrol"
          />

          {filteredSpecies?.length === 0 && (
            <p className="mt-6 text-[13px] text-muted">
              No species matching “{filter}”.
            </p>
          )}

          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {filteredSpecies?.map((s) => (
              <li key={s.taxid}>
                <Link
                  href={`/species/${s.taxid}?organism=${encodeURIComponent(s.organism)}`}
                  className="group flex items-center gap-4 py-3 no-underline"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-[14px] italic text-ink transition-colors group-hover:text-petrol">
                      {s.organism}
                    </span>
                    {s.hasTypeMaterial && (
                      <span
                        title="has a type-material assembly"
                        className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-verified align-middle"
                      />
                    )}
                  </span>
                  {/* Bar length is proportional to the most-sequenced species,
                      so the distribution is legible without reading numbers. */}
                  <span
                    aria-hidden
                    className="hidden h-1 w-24 shrink-0 rounded-full bg-sunk sm:block"
                  >
                    <span
                      className="block h-full rounded-full bg-petrol/60"
                      style={{ width: `${Math.max(4, (s.assemblyCount / maxCount) * 100)}%` }}
                    />
                  </span>
                  <span className="data w-10 shrink-0 text-right text-[12px] text-muted">
                    {s.assemblyCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Species: choose an assembly ---- */}
      {!isGenus && assemblies?.length === 0 && (
        <p className="mt-8 text-[13px] text-muted">
          NCBI lists no genome assemblies for this taxon.
        </p>
      )}
      {!isGenus && assemblies && assemblies.length > 0 && (
        <ul className="mt-7 flex flex-col gap-2.5">
          {assemblies.map((a, i) => (
            <li key={a.accession}>
              <GenomeCard assembly={a} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
