import type { ProteinRecord } from "@/lib/types";

// Generate a BibTeX entry for a protein record: the RefSeq record itself as
// @misc (always citable), plus the most relevant reference as @article when the
// record carries one.

function citeKey(record: ProteinRecord): string {
  return (record.version || record.accession || "protein").replace(
    /[^A-Za-z0-9]/g,
    "",
  );
}

function yearFrom(journal?: string): string | undefined {
  const matches = journal?.match(/\((\d{4})\)/g);
  if (!matches) return undefined;
  return matches[matches.length - 1].replace(/[()]/g, "");
}

export function toBibtex(record: ProteinRecord): string {
  const acc = record.version || record.accession;
  const key = citeKey(record);
  const entries: string[] = [];

  entries.push(
    `@misc{ncbi_${key},
  title        = {{${record.title} [${record.organism}]}},
  howpublished = {NCBI Reference Sequence: ${acc}},
  note         = {RefSeq protein record},
  url          = {https://www.ncbi.nlm.nih.gov/protein/${acc}}
}`,
  );

  const ref = record.contextReference;
  if (ref?.title) {
    const year = yearFrom(ref.journal);
    const journal = ref.journal?.replace(/,?\s*\d[\d\s(),.-]*$/, "").trim();
    const lines = [`  title        = {{${ref.title}}},`];
    if (journal) lines.push(`  journal      = {${journal}},`);
    if (year) lines.push(`  year         = {${year}},`);
    if (ref.pubmed) lines.push(`  note         = {PMID: ${ref.pubmed}},`);
    // drop trailing comma on the last line
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    entries.push(`@article{ref_${key},\n${lines.join("\n")}\n}`);
  }

  return entries.join("\n\n") + "\n";
}
