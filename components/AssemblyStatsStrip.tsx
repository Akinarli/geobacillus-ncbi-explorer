import type { AssemblyStats } from "@/lib/types";

function mb(bp?: number): string | null {
  if (bp == null) return null;
  return `${(bp / 1_000_000).toFixed(2)} Mb`;
}

function num(n?: number): string | null {
  return n == null ? null : n.toLocaleString("en-US");
}

// A compact strip of the genome's headline numbers. Each cell is only rendered
// when NCBI provides that stat, so draft assemblies without annotation degrade
// gracefully.
export default function AssemblyStatsStrip({ stats }: { stats: AssemblyStats }) {
  const cells: Array<{ label: string; value: string | null }> = [
    { label: "genome", value: mb(stats.genomeSize) },
    { label: "GC", value: stats.gcPercent != null ? `${stats.gcPercent}%` : null },
    { label: "contig N50", value: mb(stats.contigN50) },
    { label: "genes", value: num(stats.geneTotal) },
    { label: "proteins", value: num(stats.proteinCoding) },
    { label: "pseudogenes", value: num(stats.pseudogene) },
  ].filter((c) => c.value !== null);

  if (cells.length === 0) return null;

  return (
    <div className="mt-5 rounded-lg border border-rule bg-surface p-4">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="eyebrow">{c.label}</dt>
            <dd className="data mt-0.5 text-[15px] text-ink">{c.value}</dd>
          </div>
        ))}
      </dl>
      {stats.annotationName && (
        <p className="mt-3 text-[11px] text-muted">{stats.annotationName}</p>
      )}
    </div>
  );
}
