"use client";

import { useState } from "react";
import Link from "next/link";

interface Gene {
  start: number;
  stop: number;
  strand: "+" | "-";
  product?: string;
  gene?: string;
  locusTag?: string;
  proteinId?: string;
  isQuery: boolean;
}
interface Neighborhood {
  context: {
    nucleotide: string;
    organism: string;
    strain: string;
    assembly: string;
  };
  window: { length: number };
  genes: Gene[];
}

const H = 46;
const MID = H / 2;
const GH = 15; // gene glyph half-height-ish

// A gene drawn as a strand-oriented arrow, scaled into a 0..1000 viewBox.
function GeneArrow({ g, scale }: { g: Gene; scale: number }) {
  const x1 = g.start * scale;
  const x2 = g.stop * scale;
  const w = Math.max(3, x2 - x1);
  const tip = Math.min(8, w * 0.5);
  const top = MID - GH / 2;
  const bot = MID + GH / 2;
  const points =
    g.strand === "+"
      ? `${x1},${top} ${x1 + w - tip},${top} ${x1 + w},${MID} ${x1 + w - tip},${bot} ${x1},${bot}`
      : `${x1 + w},${top} ${x1 + tip},${top} ${x1},${MID} ${x1 + tip},${bot} ${x1 + w},${bot}`;
  return (
    <polygon
      points={points}
      style={{ fill: g.isQuery ? "var(--ember)" : "var(--petrol)", fillOpacity: g.isQuery ? 1 : 0.7 }}
      stroke="var(--surface)"
      strokeWidth={0.8}
    >
      <title>
        {(g.gene ? `${g.gene} · ` : "") + (g.product ?? "gene")}
        {g.proteinId ? ` (${g.proteinId})` : ""}
      </title>
    </polygon>
  );
}

// The gene neighborhood ("genomic context") of a protein: where it sits on its
// genome and what surrounds it — an operon view. Placement comes from the IPG
// report; neighbours from the nucleotide feature table.
export default function SyntenyTrack({ accession }: { accession: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "none" | "error">(
    "idle",
  );
  const [data, setData] = useState<Neighborhood | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/neighborhood?accession=${encodeURIComponent(accession)}`,
      );
      const d = (await res.json()) as Neighborhood & { error?: string };
      if (res.status === 404) {
        setState("none");
        return;
      }
      if (!res.ok || d.error || !d.genes) throw new Error();
      setData(d);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const scale = data ? 1000 / data.window.length : 1;

  return (
    <section className="mt-4 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="eyebrow">genomic context</h3>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-rule bg-surface px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
          >
            show gene neighborhood →
          </button>
        )}
        {state === "loading" && <span className="eyebrow">reading genome…</span>}
      </div>

      {state === "loading" && <div className="thermal-track mt-3" />}
      {state === "none" && (
        <p className="mt-2 text-[13px] text-muted">
          No genomic placement is available for this protein.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-[13px] text-ember">
          Could not load the gene neighborhood.
        </p>
      )}

      {state === "done" && data && (
        <div className="mt-3">
          <p className="text-[12px] text-muted">
            <span className="data">{data.context.assembly}</span> ·{" "}
            <span className="italic">{data.context.organism}</span>
            {data.context.strain && ` ${data.context.strain}`} ·{" "}
            <span className="data">{data.context.nucleotide}</span>
          </p>

          <svg
            viewBox={`0 0 1000 ${H}`}
            className="mt-3 w-full"
            preserveAspectRatio="none"
            style={{ height: H }}
          >
            <line
              x1="0"
              y1={MID}
              x2="1000"
              y2={MID}
              stroke="var(--rule)"
              strokeWidth={1}
            />
            {data.genes.map((g, i) => (
              <GeneArrow key={i} g={g} scale={scale} />
            ))}
          </svg>

          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {data.genes.map((g, i) => {
              const label = g.product ?? g.gene ?? g.locusTag ?? "gene";
              const inner = (
                <span className="flex items-center justify-between gap-3 py-1.5">
                  <span
                    className={`flex items-center gap-2 text-[13px] ${
                      g.isQuery ? "font-medium text-ink" : "text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        background: g.isQuery ? "var(--ember)" : "var(--petrol)",
                        opacity: g.isQuery ? 1 : 0.7,
                      }}
                    />
                    {g.gene && <span className="italic">{g.gene}</span>}
                    <span className={g.isQuery ? "" : "text-muted"}>{label}</span>
                    {g.isQuery && <span className="eyebrow">this protein</span>}
                  </span>
                  <span className="data shrink-0 text-[11px] text-muted">
                    {g.strand}
                    {g.proteinId ? ` · ${g.proteinId}` : ""}
                  </span>
                </span>
              );
              return (
                <li key={i}>
                  {g.proteinId && !g.isQuery ? (
                    <Link
                      href={`/protein/${encodeURIComponent(g.proteinId)}`}
                      className="block no-underline hover:bg-petrol-soft/30"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
