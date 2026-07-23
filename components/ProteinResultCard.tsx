import Link from "next/link";
import type { ProteinDomain, ProteinRecord } from "@/lib/types";
import GoTermChip from "@/components/GoTermChip";
import ProteinSequence from "@/components/ProteinSequence";
import CompareToggle from "@/components/CompareToggle";
import StructureBadge from "@/components/StructureBadge";
import CiteButton from "@/components/CiteButton";

// A domain diagram, not just a length bar: a thin backbone spans the protein's
// length (scaled against the longest result so cards are comparable), and each
// conserved Region is drawn as a box at its residue span — the way Pfam and
// InterPro show domain architecture. With no domains, the backbone alone still
// conveys relative size.
function ScaleBar({
  length,
  max,
  domains,
}: {
  length: number;
  max: number;
  domains?: ProteinDomain[];
}) {
  const pct = Math.max(2, (length / max) * 100);
  const ticks = Math.floor(length / 100);
  const hasDomains = !!domains && domains.length > 0;

  return (
    <div className="mt-4">
      <div className="relative h-4 w-full">
        <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%` }}>
          {/* backbone */}
          <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-petrol/35" />
          {/* residue ticks every 100 */}
          {Array.from({ length: ticks }, (_, i) => (
            <span
              key={`t${i}`}
              aria-hidden
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/15"
              style={{ left: `${(((i + 1) * 100) / length) * 100}%` }}
            />
          ))}
          {/* domain boxes */}
          {domains?.map((d, i) => (
            <span
              key={`d${i}`}
              title={`${d.name} · ${d.start}–${d.end}`}
              className="absolute inset-y-0 rounded-sm bg-petrol/85"
              style={{
                left: `${((d.start - 1) / length) * 100}%`,
                width: `${Math.max(1, ((d.end - d.start + 1) / length) * 100)}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="eyebrow">
          {hasDomains ? "domain architecture" : "residues · ticks every 100"}
        </span>
        <span className="data text-[11px] text-ink">{length} aa</span>
      </div>

      {hasDomains && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {domains!.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[12px]">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm bg-petrol/85"
              />
              <span className="text-ink">{d.name}</span>
              <span className="data text-[10px] text-muted">
                {d.start}–{d.end}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExternalLinks({ record }: { record: ProteinRecord }) {
  const acc = record.version || record.accession;
  const links = [
    {
      label: "BLAST",
      href: `https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE=Proteins&PROGRAM=blastp&PAGE_TYPE=BlastSearch&QUERY=${encodeURIComponent(acc)}`,
    },
    {
      label: "UniProt",
      href: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(acc)}`,
    },
    {
      label: "InterPro",
      href: `https://www.ebi.ac.uk/interpro/search/text/${encodeURIComponent(acc)}/`,
    },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="eyebrow">explore</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-rule bg-surface px-2.5 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
        >
          {l.label}
          <span aria-hidden className="text-[10px] text-muted">
            ↗
          </span>
        </a>
      ))}
    </div>
  );
}

export default function ProteinResultCard({
  record,
  maxLength,
  index = 0,
}: {
  record: ProteinRecord;
  /** Longest protein in the current result set, so bars share one scale. */
  maxLength?: number;
  index?: number;
}) {
  const accessionUrl = `https://www.ncbi.nlm.nih.gov/protein/${record.version || record.accession}`;
  const genus = record.lineage.at(-1);

  return (
    <article
      className="rise rounded-lg border border-rule bg-surface p-5 transition-colors hover:border-ink/20"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <h3 className="display text-[22px] font-semibold text-ink">
        {record.title}
      </h3>

      <p className="mt-1 text-[13px] text-muted">
        <span className="italic">{record.organism}</span>
        {genus && genus !== record.organism && (
          <span className="data ml-2 text-[11px]">· {genus}</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <a
          href={accessionUrl}
          target="_blank"
          rel="noreferrer"
          className="data text-[12px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
        >
          {record.version || record.accession}
        </a>
        {record.molWt != null && (
          <span className="data text-[12px] text-muted">
            {record.molWt.toLocaleString("en-US")} Da
          </span>
        )}
        <StructureBadge accession={record.version || record.accession} />
        <Link
          href={`/protein/${encodeURIComponent(record.version || record.accession)}`}
          className="data text-[11px] text-muted underline decoration-rule underline-offset-[3px] hover:text-petrol hover:decoration-current"
        >
          permalink
        </Link>
        <CiteButton record={record} />
        <span className="ml-auto">
          <CompareToggle record={record} />
        </span>
      </div>

      {record.length != null && (
        <ScaleBar
          length={record.length}
          max={maxLength ?? record.length}
          domains={record.domains}
        />
      )}

      {record.goTerms.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {record.goTerms.map((term, i) => (
            <GoTermChip key={`${term.id}-${i}`} term={term} />
          ))}
        </div>
      )}

      <ExternalLinks record={record} />

      {record.sequence && (
        <ProteinSequence
          header={`${record.version || record.accession} ${record.title} [${record.organism}]`}
          sequence={record.sequence}
        />
      )}

      {record.contextReference?.title && (
        <figure className="mt-4 border-t border-rule pt-3">
          <figcaption className="eyebrow mb-1">most relevant reference</figcaption>
          <blockquote className="text-[13px] leading-snug text-ink/85">
            {record.contextReference.title}
          </blockquote>
          {record.contextReference.pubmed && (
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${record.contextReference.pubmed}/`}
              target="_blank"
              rel="noreferrer"
              className="data mt-1.5 inline-block text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
            >
              PMID {record.contextReference.pubmed}
            </a>
          )}
        </figure>
      )}
    </article>
  );
}
