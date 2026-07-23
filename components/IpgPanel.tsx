"use client";

import { useState } from "react";

interface IpgRow {
  source: string;
  nucleotide: string;
  start: number;
  stop: number;
  strand: "+" | "-";
  organism: string;
  strain: string;
  assembly: string;
}

// "Identical proteins": every assembly/strain that carries this exact protein,
// with its genome coordinates. A comparative view of how widespread a protein
// is, straight from NCBI's IPG report.
export default function IpgPanel({ accession }: { accession: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [rows, setRows] = useState<IpgRow[]>([]);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/ipg?accession=${encodeURIComponent(accession)}`,
      );
      const d = (await res.json()) as { rows?: IpgRow[]; error?: string };
      if (!res.ok || d.error) throw new Error();
      // Collapse the RefSeq/GenBank duplicate of each assembly, prefer RefSeq.
      const seen = new Set<string>();
      const uniq: IpgRow[] = [];
      for (const r of (d.rows ?? []).sort((a) =>
        a.source === "RefSeq" ? -1 : 1,
      )) {
        const key = r.assembly.replace(/^GC[AF]_/, "");
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(r);
      }
      setRows(uniq);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="mt-4 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="eyebrow">identical proteins</h3>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-rule bg-surface px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
          >
            which strains carry this exact protein? →
          </button>
        )}
        {state === "loading" && <span className="eyebrow">reading ncbi…</span>}
      </div>

      {state === "loading" && <div className="thermal-track mt-3" />}
      {state === "error" && (
        <p className="mt-2 text-[13px] text-ember">Could not load.</p>
      )}

      {state === "done" && (
        <div className="mt-3">
          <p className="text-[12px] text-muted">
            in <span className="data">{rows.length}</span>{" "}
            {rows.length === 1 ? "assembly" : "assemblies"}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  {["organism", "assembly", "location"].map((h) => (
                    <th key={h} className="eyebrow py-1.5 pr-4 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-rule">
                    <td className="py-1.5 pr-4 italic text-ink">
                      {r.organism}
                      {r.strain ? ` ${r.strain}` : ""}
                    </td>
                    <td className="py-1.5 pr-4">
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${encodeURIComponent(r.assembly)}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="data text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
                      >
                        {r.assembly}
                      </a>
                    </td>
                    <td className="data py-1.5 pr-4 text-muted">
                      {r.nucleotide}:{r.start}–{r.stop} {r.strand}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
