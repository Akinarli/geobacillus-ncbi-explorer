// Parsers for the ecology feature. Everything here maps a source record to a
// value PLUS its evidence — no value is ever invented. Missing data stays
// undefined so the UI can honestly say "unknown".

export interface EcologyRef {
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
  doiUrl?: string;
  pubmedUrl?: string;
  url?: string;
  sourceLabel?: string; // "BacDive", "NCBI BioSample", "Europe PMC", "LPSN"
  openAccess?: boolean;
}

export interface Sourced {
  value: string;
  refs: EcologyRef[];
}

export interface BioSampleInfo {
  accession?: string;
  isolationSource?: string;
  geo?: string;
  collectionDate?: string;
  collectedBy?: string;
  cultureCollections: string[];
  strain?: string;
  typeMaterial?: string;
}

// --- DOI / PubMed helpers ---------------------------------------------------
export function doiToUrl(doi?: string): string | undefined {
  if (!doi) return undefined;
  const d = doi.trim();
  if (/^https?:\/\//i.test(d)) return d;
  if (/^10\./.test(d)) return `https://doi.org/${d}`;
  return undefined;
}
export function pubmedUrl(pmid?: string | number): string | undefined {
  const id = String(pmid ?? "").trim();
  return /^\d+$/.test(id) ? `https://pubmed.ncbi.nlm.nih.gov/${id}/` : undefined;
}

// --- NCBI BioSample (XML) ---------------------------------------------------
function attr(xml: string, harmonized: string): string | undefined {
  const re = new RegExp(
    `<Attribute[^>]*(?:attribute_name|harmonized_name)="${harmonized}"[^>]*>([^<]*)</Attribute>`,
    "i",
  );
  const m = re.exec(xml);
  return m ? m[1].trim() : undefined;
}

export function parseBioSample(xml: string, accession?: string): BioSampleInfo {
  const cc = attr(xml, "culture_collection") ?? "";
  const cultureCollections = cc
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  // type-material has no harmonized_name; grab it directly.
  const tm = /<Attribute[^>]*attribute_name="type-material"[^>]*>([^<]*)</i.exec(xml);
  return {
    accession,
    isolationSource: attr(xml, "isolation_source"),
    geo: attr(xml, "geo_loc_name"),
    collectionDate: attr(xml, "collection_date"),
    collectedBy: attr(xml, "collected_by"),
    cultureCollections,
    strain: attr(xml, "strain"),
    typeMaterial: tm ? tm[1].trim() : undefined,
  };
}

// --- BacDive ----------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function asArray(v: any): any[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function nums(temp: any): number[] {
  // "55" -> [55]; "40.0-60.0" -> [40,60]
  return String(temp ?? "")
    .split("-")
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

/** Resolve a BacDive @ref id against the record's Reference section. */
export function makeRefResolver(record: any): (ref: number) => EcologyRef | null {
  const byId = new Map<number, any>();
  for (const r of asArray(record?.Reference)) {
    if (r?.["@id"] != null) byId.set(Number(r["@id"]), r);
  }
  return (ref: number) => {
    const r = byId.get(Number(ref));
    if (!r) return null;
    const raw = r["doi/url"] as string | undefined;
    const doiUrl = doiToUrl(raw);
    return {
      title: r.title,
      authors: r.authors,
      doiUrl,
      url: doiUrl ? undefined : raw,
      sourceLabel: "BacDive",
    };
  };
}

function collectRefs(
  entries: any[],
  resolve: (ref: number) => EcologyRef | null,
): EcologyRef[] {
  const out: EcologyRef[] = [];
  const seen = new Set<number>();
  for (const e of entries) {
    const ref = Number(e?.["@ref"]);
    if (!Number.isFinite(ref) || seen.has(ref)) continue;
    seen.add(ref);
    const r = resolve(ref);
    if (r) out.push(r);
  }
  return out;
}

export function bacdiveTemperature(
  record: any,
  resolve: (ref: number) => EcologyRef | null,
): Sourced | undefined {
  const entries = asArray(record?.["Culture and growth conditions"]?.["culture temp"]);
  const growth = entries.filter((e) => e?.temperature);
  if (growth.length === 0) return undefined;
  const pick = (type: string) =>
    growth.filter((e) => e.type === type).flatMap((e) => nums(e.temperature));
  const mins = pick("minimum");
  const maxs = pick("maximum");
  const opts = pick("optimum");
  const all = growth.flatMap((e) => nums(e.temperature));
  const lo = mins.length ? Math.min(...mins) : Math.min(...all);
  const hi = maxs.length ? Math.max(...maxs) : Math.max(...all);
  const opt = opts.length ? Math.round(opts.reduce((a, b) => a + b, 0) / opts.length) : undefined;
  const value =
    lo === hi
      ? `${lo} °C`
      : opt != null
        ? `${lo} – [${opt}] – ${hi} °C`
        : `${lo} – ${hi} °C`;
  return { value, refs: collectRefs(growth, resolve) };
}

export function bacdivePh(
  record: any,
  resolve: (ref: number) => EcologyRef | null,
): Sourced | undefined {
  const entries = asArray(record?.["Culture and growth conditions"]?.["culture pH"]);
  const pos = entries.filter((e) => e?.ability === "positive" && e?.pH);
  if (pos.length === 0) return undefined;
  const vals = pos.map((e) => parseFloat(e.pH)).filter(Number.isFinite);
  const desc = pos.map((e) => e["PH range"]).find(Boolean);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const value = (lo === hi ? `pH ${lo}` : `pH ${lo} – ${hi}`) + (desc ? ` (${desc})` : "");
  return { value, refs: collectRefs(pos, resolve) };
}

export function bacdiveSalinity(
  record: any,
  resolve: (ref: number) => EcologyRef | null,
): Sourced | undefined {
  const entries = asArray(record?.["Physiology and metabolism"]?.halophily).filter(
    (e) => /nacl/i.test(e?.salt ?? ""),
  );
  if (entries.length === 0) return undefined;
  const grows = entries
    .filter((e) => e.growth === "positive")
    .map((e) =>
      String(e.concentration ?? "")
        .replace(/\(w\/v\)/gi, "")
        .replace(/\.0\b/g, "")
        .trim(),
    )
    .filter(Boolean);
  if (grows.length === 0) return undefined;
  const uniq = [...new Set(grows)];
  const value = `grows in NaCl ${uniq.join(", ")}`;
  return { value, refs: collectRefs(entries, resolve) };
}

export function bacdiveIsolation(
  record: any,
  resolve: (ref: number) => EcologyRef | null,
): Sourced | undefined {
  const iso = record?.["Isolation, sampling and environmental information"]?.isolation;
  const sample = asArray(iso)[0];
  const s = sample?.["sample type"] ?? sample?.["geographic location"];
  if (!s) return undefined;
  return { value: String(s), refs: collectRefs([sample], resolve) };
}

export function bacdiveLiterature(record: any): EcologyRef[] {
  return asArray(record?.["External links"]?.literature)
    .filter((l) => l?.title)
    .map((l) => ({
      title: l.title,
      authors: l.authors,
      journal: l.journal,
      year: l.year,
      doiUrl: doiToUrl(l.DOI),
      pubmedUrl: pubmedUrl(l["Pubmed-ID"]),
      sourceLabel: "BacDive literature",
    }));
}

export function lpsnName(record: any): string | undefined {
  return record?.["Name and taxonomic classification"]?.LPSN?.["full scientific name"];
}
