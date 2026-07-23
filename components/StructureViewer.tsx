"use client";

import { useRef, useState } from "react";

// Official AlphaFold pLDDT confidence bands (stored in the PDB b-factor column).
function plddtColor(b: number): string {
  if (b >= 90) return "#0053d6"; // very high
  if (b >= 70) return "#65cbf3"; // confident
  if (b >= 50) return "#ffdb13"; // low
  return "#ff7d45"; // very low
}

type State = "idle" | "loading" | "done" | "none" | "error";

// Lazy 3D structure viewer: on click it resolves the accession to an AlphaFold
// model (via /api/structure) and renders it with 3Dmol, coloured by pLDDT. The
// heavy library is only imported when the user asks for the structure.
export default function StructureViewer({ accession }: { accession: string }) {
  const [state, setState] = useState<State>("idle");
  const [uniprot, setUniprot] = useState<string | null>(null);
  const [pdbIds, setPdbIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/structure?accession=${encodeURIComponent(accession)}`,
      );
      const data = (await res.json()) as {
        uniprot?: string;
        data?: string;
        pdb?: string[];
        error?: string;
      };
      if (data.uniprot) setUniprot(data.uniprot);
      if (data.pdb?.length) setPdbIds(data.pdb);
      if (res.status === 404) {
        setState("none");
        return;
      }
      if (!res.ok || data.error || !data.data) throw new Error();

      // 3dmol ships a UMD build with no ESM exports map, so the interop shape
      // varies — createViewer may sit on the module or on its default export.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("3dmol");
      const $3Dmol = mod?.createViewer ? mod : (mod?.default ?? mod);
      const el = containerRef.current;
      if (!el || typeof $3Dmol?.createViewer !== "function") throw new Error();
      const viewer = $3Dmol.createViewer(el, { backgroundColor: "white" });
      viewer.addModel(data.data, "pdb");
      viewer.setStyle(
        {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { cartoon: { colorfunc: (atom: any) => plddtColor(atom.b) } },
      );
      viewer.zoomTo();
      viewer.render();
      viewer.resize();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="mt-4 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="eyebrow">3d structure</h3>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-rule bg-surface px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
          >
            load AlphaFold model →
          </button>
        )}
        {state === "loading" && <span className="eyebrow">loading model…</span>}
        {(state === "done" || state === "none") && uniprot && (
          <a
            href={`https://alphafold.ebi.ac.uk/entry/${uniprot}`}
            target="_blank"
            rel="noreferrer"
            className="data text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
          >
            AlphaFold: {uniprot} ↗
          </a>
        )}
      </div>

      {state === "loading" && <div className="thermal-track mt-3" />}

      {state === "none" && (
        <p className="mt-2 text-[13px] text-muted">
          No AlphaFold model is available for this protein
          {uniprot ? "" : " (no UniProt mapping)"}.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-[13px] text-ember">
          Could not load the structure.
        </p>
      )}

      {/* Experimental crystal/cryo-EM structures, when this protein has them —
          higher evidence than a prediction. */}
      {pdbIds.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className="eyebrow">experimental (PDB)</span>
          {pdbIds.slice(0, 8).map((id) => (
            <a
              key={id}
              href={`https://www.rcsb.org/structure/${id}`}
              target="_blank"
              rel="noreferrer"
              className="data text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
            >
              {id}
            </a>
          ))}
          {pdbIds.length > 8 && (
            <span className="text-muted">+{pdbIds.length - 8}</span>
          )}
        </p>
      )}

      {/* Container is always mounted so the ref exists when 3Dmol initialises.
          Hidden until a model is rendered. */}
      <div className={state === "done" ? "mt-3" : "hidden"}>
        <div
          ref={containerRef}
          className="relative h-80 w-full overflow-hidden rounded-lg border border-rule bg-white"
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="eyebrow">pLDDT</span>
          {[
            ["#0053d6", "very high >90"],
            ["#65cbf3", "confident 70–90"],
            ["#ffdb13", "low 50–70"],
            ["#ff7d45", "very low <50"],
          ].map(([c, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: c }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
