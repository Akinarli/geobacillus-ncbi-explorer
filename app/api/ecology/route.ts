import { NextResponse } from "next/server";
import { datasetsGenomeByAccession, efetchText } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import {
  parseBioSample,
  makeRefResolver,
  bacdiveTemperature,
  bacdivePh,
  bacdiveSalinity,
  bacdiveIsolation,
  bacdiveLiterature,
  lpsnName,
  doiToUrl,
  pubmedUrl,
  type EcologyRef,
  type Sourced,
} from "@/lib/ecology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEK = 604_800;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "koeus-ncbi-explorer",
      },
      cache: "no-store", // external APIs; keep it simple and reliable
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function matchBacDive(numbers: string[]): Promise<any | null> {
  for (const raw of numbers) {
    const no = raw.replace(/:/g, " ").replace(/\s+/g, " ").trim();
    if (!no) continue;
    const hit = await getJson(
      `https://api.bacdive.dsmz.de/culturecollectionno/${encodeURIComponent(no)}`,
    );
    const id = hit?.results?.[0];
    if (id != null) {
      const rec = await getJson(`https://api.bacdive.dsmz.de/fetch/${id}`);
      const record = rec?.results ? Object.values(rec.results)[0] : null;
      if (record) return { id, record };
    }
  }
  return null;
}

async function europePmc(organism: string): Promise<EcologyRef[]> {
  const q = encodeURIComponent(`"${organism}"`);
  const data = await getJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=5&resultType=core`,
  );
  const results = data?.resultList?.result ?? [];
  return results
    .filter((r: any) => r?.title)
    .map((r: any) => ({
      title: String(r.title).replace(/<[^>]+>/g, ""),
      authors: r.authorString,
      journal: r.journalTitle,
      year: r.pubYear ? Number(r.pubYear) : undefined,
      doiUrl: doiToUrl(r.doi),
      pubmedUrl: pubmedUrl(r.pmid),
      openAccess: r.isOpenAccess === "Y",
      sourceLabel: "Europe PMC",
    }));
}

function dedupeRefs(refs: EcologyRef[]): EcologyRef[] {
  const seen = new Set<string>();
  const out: EcologyRef[] = [];
  for (const r of refs) {
    const key = (r.doiUrl || r.pubmedUrl || r.url || r.title || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accession = (searchParams.get("accession") ?? "").trim();
  if (!accession) {
    return NextResponse.json({ error: "missing ?accession=" }, { status: 400 });
  }

  try {
    // 1. Assembly report -> biosample accession + organism + strain.
    const report = (await datasetsGenomeByAccession(accession)) as {
      reports?: Array<{
        organism?: {
          organism_name?: string;
          infraspecific_names?: { strain?: string; isolate?: string };
        };
        assembly_info?: {
          biosample?: { accession?: string };
          biosample_accession?: string;
        };
      }>;
    };
    const r0 = report.reports?.[0];
    const organism = r0?.organism?.organism_name ?? "";
    const strain =
      r0?.organism?.infraspecific_names?.strain ??
      r0?.organism?.infraspecific_names?.isolate;
    const bsAcc =
      r0?.assembly_info?.biosample?.accession ??
      r0?.assembly_info?.biosample_accession;

    // 2. BioSample metadata (about THIS assembly's sample).
    let biosample = null as ReturnType<typeof parseBioSample> | null;
    if (bsAcc) {
      const xml = await efetchText("biosample", bsAcc, {
        rettype: "full",
        retmode: "xml",
      }).catch(() => "");
      if (xml) biosample = parseBioSample(xml, bsAcc);
    }

    // 3. Match to a BacDive strain record via culture-collection numbers.
    const numbers = [
      ...(biosample?.cultureCollections ?? []),
      ...(biosample?.strain ? [biosample.strain] : []),
      ...(strain ? [strain] : []),
    ];
    const bd = await matchBacDive(numbers);
    const resolve = bd ? makeRefResolver(bd.record) : () => null;

    // 4. Ecology values (each with its evidence). Isolation prefers BioSample.
    const biosampleRef: EcologyRef | undefined = bsAcc
      ? {
          title: `NCBI BioSample ${bsAcc}`,
          url: `https://www.ncbi.nlm.nih.gov/biosample/${bsAcc}`,
          sourceLabel: "NCBI BioSample",
        }
      : undefined;

    const isolation_source: Sourced | null = biosample?.isolationSource
      ? {
          value: biosample.isolationSource,
          refs: biosampleRef ? [biosampleRef] : [],
        }
      : bd
        ? (bacdiveIsolation(bd.record, resolve) ?? null)
        : null;

    const temperature = bd ? (bacdiveTemperature(bd.record, resolve) ?? null) : null;
    const ph = bd ? (bacdivePh(bd.record, resolve) ?? null) : null;
    const salinity_nacl = bd ? (bacdiveSalinity(bd.record, resolve) ?? null) : null;

    // 5. Key references: BacDive literature + LPSN name note + Europe PMC + inline.
    const pmc = organism ? await europePmc(organism) : [];
    const references = dedupeRefs([
      ...(bd ? bacdiveLiterature(bd.record) : []),
      ...temperature?.refs ?? [],
      ...ph?.refs ?? [],
      ...isolation_source?.refs ?? [],
      ...pmc,
    ]).slice(0, 12);

    return NextResponse.json({
      assembly: accession,
      organism,
      strain: strain ?? biosample?.strain,
      matched: !!bd,
      bacdiveId: bd?.id,
      lpsnName: bd ? lpsnName(bd.record) : undefined,
      biosample: biosample && {
        accession: biosample.accession,
        geo: biosample.geo,
        collectionDate: biosample.collectionDate,
        collectedBy: biosample.collectedBy,
        cultureCollection: biosample.cultureCollections.join(", ") || undefined,
        typeMaterial: biosample.typeMaterial,
      },
      ecology: { isolation_source, temperature, ph, salinity_nacl },
      references,
    });
  } catch (err) {
    return handleError(err);
  }
}
