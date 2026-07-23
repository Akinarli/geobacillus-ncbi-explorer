// Shared types for assemblies, protein records and GO terms.

export interface Assembly {
  /** Assembly accession, e.g. "GCF_000750005.2". */
  accession: string;
  /** Assembly display name, e.g. "ASM75000v2". */
  name: string;
  /** Organism name as reported by NCBI. */
  organism: string;
  /** Strain / isolate, when available. */
  strain?: string;
  /** RefSeq category, e.g. "reference genome" / "representative genome". */
  refseqCategory?: string;
  /** True when the assembly is derived from type material. */
  isTypeMaterial: boolean;
  /** True when NCBI flags it as a reference genome. */
  isReference: boolean;
  bioproject?: string;
  biosample?: string;
  /** NCBI Taxonomy ID for the organism. */
  taxid: number;
}

export interface TaxonResult {
  taxid: number;
  /** The canonical organism name NCBI resolved the query to. */
  organism: string;
  /** NCBI rank, e.g. "GENUS", "SPECIES", "STRAIN". Drives whether we show a
   *  species picker or jump straight to assemblies. */
  rank: string;
  /** Number of genome assemblies under this taxon, per NCBI's own count. */
  assemblyCount?: number;
}

/** One species under a genus, with how many assemblies it has. */
export interface SpeciesSummary {
  taxid: number;
  organism: string;
  assemblyCount: number;
  /** True when at least one of its assemblies is from type material. */
  hasTypeMaterial: boolean;
}

export interface ProteinHit {
  /** UID / accession returned by esearch, e.g. "WP_051985049". */
  id: string;
}

/** A "did you mean" alternative when the typed term found nothing — e.g. typing
 *  "levan" suggests "levansucrase". `count` is how many records carry it. */
export interface ProteinSuggestion {
  term: string;
  count: number;
}

export type GoCategory = "component" | "function" | "process";

export interface GoTerm {
  /** GO id, e.g. "GO:0016020". */
  id: string;
  /** Human label, e.g. "membrane". */
  label: string;
  category: GoCategory;
  /** Evidence code, e.g. "IEA", when present. */
  evidence?: string;
}

export interface ProteinReference {
  title: string;
  journal?: string;
  pubmed?: string;
}

/** A conserved region / domain from a GenPept `Region` feature, e.g.
 *  "MATE_like" spanning residues 1–331. Drawn as a segment on the scale bar. */
export interface ProteinDomain {
  name: string;
  start: number;
  end: number;
}

export interface ProteinRecord {
  /** From DEFINITION, e.g. "flippase [Geobacillus icigianus]". */
  definition: string;
  /** Short product / gene title, e.g. "flippase". */
  title: string;
  accession: string;
  version: string;
  organism: string;
  /** Taxonomy lineage as a list, from ORGANISM. */
  lineage: string[];
  /** calculated_mol_wt in Daltons, when present. */
  molWt?: number;
  goTerms: GoTerm[];
  references: ProteinReference[];
  /** The single most relevant reference title, chosen for the context caption. */
  contextReference?: ProteinReference;
  /** Amino-acid length, when present. */
  length?: number;
  /** Full amino-acid sequence from the ORIGIN block, when present. */
  sequence?: string;
  /** Conserved regions / domains from `Region` features. */
  domains?: ProteinDomain[];
}

/** Assembly-level genome statistics from NCBI Datasets, for the stats strip. */
export interface AssemblyStats {
  /** Total genome length in base pairs. */
  genomeSize?: number;
  gcPercent?: number;
  contigN50?: number;
  scaffolds?: number;
  geneTotal?: number;
  proteinCoding?: number;
  pseudogene?: number;
  /** Annotation release name, e.g. "NCBI RefSeq GCF_000750005.2-RS_2025_12_10". */
  annotationName?: string;
}

export interface ApiError {
  error: string;
}
