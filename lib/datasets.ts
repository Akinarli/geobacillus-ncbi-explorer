// Helpers for reading NCBI Datasets v2 genome dataset_report rows.
// Only the fields we actually use are typed; everything is optional because the
// API omits plenty depending on the assembly.

import type { AssemblyStats } from "@/lib/types";

export interface DatasetsReport {
  accession?: string;
  organism?: {
    tax_id?: number;
    organism_name?: string;
    infraspecific_names?: { strain?: string; isolate?: string };
  };
  assembly_info?: {
    assembly_name?: string;
    refseq_category?: string;
    bioproject_accession?: string;
    biosample?: { accession?: string };
    biosample_accession?: string;
  };
  // Present (in various shapes across API versions) when the assembly is
  // derived from type material.
  type_material?: { type_display_text?: string; type_label?: string } | null;
  assembly_stats?: {
    total_sequence_length?: number | string;
    gc_percent?: number;
    contig_n50?: number;
    number_of_scaffolds?: number;
  };
  annotation_info?: {
    name?: string;
    stats?: {
      gene_counts?: {
        total?: number;
        protein_coding?: number;
        pseudogene?: number;
        non_coding?: number;
      };
    };
  };
}

/** Pull the assembly stats we display from a report row. */
export function extractStats(r: DatasetsReport): AssemblyStats {
  const s = r.assembly_stats ?? {};
  const g = r.annotation_info?.stats?.gene_counts ?? {};
  const size = s.total_sequence_length;
  return {
    genomeSize: size != null ? Number(size) : undefined,
    gcPercent: s.gc_percent,
    contigN50: s.contig_n50,
    scaffolds: s.number_of_scaffolds,
    geneTotal: g.total,
    proteinCoding: g.protein_coding,
    pseudogene: g.pseudogene,
    annotationName: r.annotation_info?.name,
  };
}

export function isFromTypeMaterial(r: DatasetsReport): boolean {
  const tm = r.type_material;
  if (tm && (tm.type_display_text || tm.type_label)) return true;
  const cat = r.assembly_info?.refseq_category?.toLowerCase() ?? "";
  return cat.includes("type material");
}

export function isReferenceGenome(r: DatasetsReport): boolean {
  return (
    (r.assembly_info?.refseq_category ?? "").toLowerCase() === "reference genome"
  );
}

// NCBI returns the RefSeq (GCF_) and GenBank (GCA_) copies of the same assembly
// as two separate reports — e.g. GCF_000750005.2 and GCA_000750005.2. They are
// the same genome, so collapse each pair and keep the RefSeq copy (which carries
// the refseq_category / type-material metadata). This is what makes
// G. icigianus show 2 assemblies rather than 4, and the Geobacillus genus total
// come out at 248 rather than 487.
export function dedupePairedAccessions(
  reports: DatasetsReport[],
): DatasetsReport[] {
  const byPair = new Map<string, DatasetsReport>();
  for (const r of reports) {
    const acc = r.accession ?? "";
    const key = acc.includes("_") ? acc.slice(acc.indexOf("_") + 1) : acc;
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, r);
      continue;
    }
    const existingIsRefSeq = (existing.accession ?? "").startsWith("GCF_");
    if (!existingIsRefSeq && acc.startsWith("GCF_")) byPair.set(key, r);
  }
  return [...byPair.values()];
}

// Rank: type material first, then reference genome, then representative, then
// the rest. Lower score sorts first.
export function rankScore(r: DatasetsReport): number {
  if (isFromTypeMaterial(r)) return 0;
  if (isReferenceGenome(r)) return 1;
  const cat = (r.assembly_info?.refseq_category ?? "").toLowerCase();
  if (cat.includes("representative")) return 2;
  return 3;
}
