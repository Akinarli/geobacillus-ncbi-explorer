// Parse the NCBI Identical Protein Groups (IPG) report. A RefSeq WP_ protein is
// non-redundant and isn't tied to one genome location, but its IPG report lists
// every assembly/strain that carries the identical protein, WITH the nucleotide
// accession and coordinates — which is what lets us place it on a genome and
// draw its gene neighborhood.

export interface IpgRow {
  source: string; // "RefSeq" | "INSDC"
  nucleotide: string;
  start: number;
  stop: number;
  strand: "+" | "-";
  protein: string;
  proteinName: string;
  organism: string;
  strain: string;
  assembly: string;
}

// The IPG text report is TSV with a header row:
// Id  Source  Nucleotide Accession  Start  Stop  Strand  Protein  Protein Name
//   Organism  Strain  Assembly
export function parseIpg(text: string): IpgRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const rows: IpgRow[] = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith("Id\t")) continue;
    const c = line.split("\t");
    if (c.length < 11) continue;
    const nucleotide = c[2]?.trim();
    if (!nucleotide) continue; // rows without a location aren't useful here
    const start = Number(c[3]);
    const stop = Number(c[4]);
    if (!Number.isFinite(start) || !Number.isFinite(stop)) continue;
    rows.push({
      source: c[1]?.trim() ?? "",
      nucleotide,
      start,
      stop,
      strand: c[5]?.trim() === "-" ? "-" : "+",
      protein: c[6]?.trim() ?? "",
      proteinName: c[7]?.trim() ?? "",
      organism: c[8]?.trim() ?? "",
      strain: c[9]?.trim() ?? "",
      assembly: c[10]?.trim() ?? "",
    });
  }
  return rows;
}

/** Prefer a RefSeq row (GCF_/NZ_) as the canonical placement. */
export function pickPrimaryRow(rows: IpgRow[]): IpgRow | undefined {
  return (
    rows.find((r) => r.source === "RefSeq" && r.assembly.startsWith("GCF_")) ??
    rows.find((r) => r.source === "RefSeq") ??
    rows[0]
  );
}
