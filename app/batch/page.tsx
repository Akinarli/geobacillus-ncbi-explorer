"use client";

import { useState } from "react";
import Link from "next/link";
import CompareToggle from "@/components/CompareToggle";
import type { ProteinRecord } from "@/lib/types";

const CONCURRENCY = 3;

interface Row {
  id: string;
  record?: ProteinRecord;
  error?: string;
}

// Paste a list of accessions and get them all as a table — the supplementary-
// data workflow. Each row links to its record and can be added to the compare
// basket.
export default function BatchPage() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [done, setDone] = useState(0);

  async function run() {
    const ids = Array.from(
      new Set(
        text
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ).slice(0, 100);
    if (ids.length === 0) return;

    setStatus("loading");
    setDone(0);
    setRows(ids.map((id) => ({ id })));

    const queue = [...ids];
    const worker = async () => {
      let id: string | undefined;
      while ((id = queue.shift())) {
        try {
          const r = await fetch(`/api/protein-fetch?id=${encodeURIComponent(id)}`);
          const rec = (await r.json()) as ProteinRecord & { error?: string };
          setRows((prev) =>
            prev.map((row) =>
              row.id === id
                ? r.ok && !rec.error
                  ? { id, record: rec }
                  : { id, error: rec.error ?? `HTTP ${r.status}` }
                : row,
            ),
          );
        } catch {
          setRows((prev) =>
            prev.map((row) =>
              row.id === id ? { id, error: "failed to load" } : row,
            ),
          );
        }
        setDone((d) => d + 1);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
    );
    setStatus("done");
  }

  const loaded = rows.filter((r) => r.record);

  return (
    <div>
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/" className="text-muted no-underline hover:text-ink">
          search
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">batch</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[26px] font-semibold text-ink">
          Batch lookup
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Paste protein accessions or UIDs — one per line, or separated by commas
          or spaces (up to 100).
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={"WP_051985049\nWP_231559878\nWP_033017268"}
        className="data mt-4 w-full rounded-md border border-rule bg-surface px-4 py-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-petrol"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={status === "loading" || !text.trim()}
          className="rounded-md bg-petrol px-5 py-2.5 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {status === "loading" ? `Loading ${done}/${rows.length}…` : "Look up"}
        </button>
        {loaded.length > 0 && (
          <Link
            href="/compare"
            className="text-[13px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
          >
            compare basket →
          </Link>
        )}
      </div>

      {status === "loading" && <div className="thermal-track mt-4" />}

      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule text-left">
                {["accession", "protein", "length", "mol. wt", ""].map((h) => (
                  <th key={h} className="eyebrow py-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-rule align-top">
                  <td className="data py-2.5 pr-4 text-[12px]">
                    {row.record ? (
                      <Link
                        href={`/protein/${encodeURIComponent(row.record.version || row.record.accession)}`}
                        className="text-petrol hover:underline"
                      >
                        {row.record.version || row.record.accession}
                      </Link>
                    ) : (
                      <span className="text-muted">{row.id}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {row.record ? (
                      <>
                        <span className="text-ink">{row.record.title}</span>
                        <span className="ml-2 text-[11px] italic text-muted">
                          {row.record.organism}
                        </span>
                      </>
                    ) : row.error ? (
                      <span className="text-[12px] text-ember">{row.error}</span>
                    ) : (
                      <span className="text-[12px] text-muted">…</span>
                    )}
                  </td>
                  <td className="data py-2.5 pr-4">
                    {row.record?.length ?? "—"}
                  </td>
                  <td className="data py-2.5 pr-4">
                    {row.record?.molWt != null
                      ? row.record.molWt.toLocaleString("en-US")
                      : "—"}
                  </td>
                  <td className="py-2.5">
                    {row.record && <CompareToggle record={row.record} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
