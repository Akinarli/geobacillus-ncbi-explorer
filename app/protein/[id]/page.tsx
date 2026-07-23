"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ProteinResultCard from "@/components/ProteinResultCard";
import OrthologPanel from "@/components/OrthologPanel";
import StructureViewer from "@/components/StructureViewer";
import SyntenyTrack from "@/components/SyntenyTrack";
import IpgPanel from "@/components/IpgPanel";
import type { ProteinRecord } from "@/lib/types";

// A standalone, shareable page for a single protein record. Any accession or UID
// resolves here (e.g. /protein/WP_051985049), so a card can be linked or
// bookmarked on its own.
export default function ProteinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [record, setRecord] = useState<ProteinRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError(null);
    fetch(`/api/protein-fetch?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = (await r.json()) as ProteinRecord & { error?: string };
        if (!r.ok || d.error) throw new Error(d.error ?? "Could not load protein");
        if (!cancelled) setRecord(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/" className="text-muted no-underline hover:text-ink">
          search
        </Link>
        <span aria-hidden>/</span>
        <span className="data text-ink">{id}</span>
      </nav>

      <div className="mt-5">
        {error && (
          <p className="rounded-md border border-ember/30 bg-ember-soft px-3 py-2 text-[13px] text-ember">
            {error}
          </p>
        )}
        {!record && !error && <div className="thermal-track" />}
        {record && (
          <>
            <ProteinResultCard record={record} />
            <div className="mt-4 rounded-lg border border-rule bg-surface px-5 pb-4">
              <SyntenyTrack accession={record.version || record.accession} />
              <StructureViewer
                accession={record.version || record.accession}
              />
              <OrthologPanel
                product={record.title}
                genus={record.lineage.at(-1) ?? ""}
              />
              <IpgPanel accession={record.version || record.accession} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
