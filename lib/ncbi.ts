// Shared NCBI fetch helpers: api_key injection, rate limiting, and a couple of
// thin wrappers around the endpoints we use. All of this runs server-side only
// (imported from API routes) so the API key is never exposed to the browser.

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const DATASETS_BASE = "https://api.ncbi.nlm.nih.gov/datasets/v2";

const API_KEY = process.env.NCBI_API_KEY ?? "";
const TOOL = process.env.NCBI_TOOL ?? "geobacillus-ncbi-explorer";
const EMAIL = process.env.NCBI_EMAIL ?? "";

// NCBI allows 10 req/sec with a key, 3 req/sec without. Keep a small safety
// margin under each limit.
const MIN_GAP_MS = API_KEY ? 110 : 350;

// Reserve a start slot for each request, spaced MIN_GAP_MS apart. Requests may
// overlap in flight — only their *start times* are rate-limited, which is what
// NCBI actually caps (requests/second). Chaining each request on the previous
// one's completion instead would serialize round-trips and make N lookups take
// N × latency.
let nextSlot = 0;

async function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_GAP_MS;
  const wait = start - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return fn();
}

/** Append api_key / tool / email params common to all NCBI requests. */
export function withCommonParams(params: URLSearchParams): URLSearchParams {
  if (API_KEY) params.set("api_key", API_KEY);
  if (TOOL) params.set("tool", TOOL);
  if (EMAIL) params.set("email", EMAIL);
  return params;
}

export class NcbiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "NcbiError";
    this.status = status;
  }
}

const MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// The in-process throttle only spaces requests within one instance. On
// serverless platforms (Vercel) each request can run in its own instance with
// no shared state, so bursts still occasionally trip NCBI's 429. Retry those
// with exponential backoff + jitter, honouring Retry-After when present, so a
// transient rate-limit never surfaces to the user.
async function ncbiFetch(url: string, init?: RequestInit): Promise<Response> {
  return throttle(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
        cache: "no-store",
      });

      if (res.ok) return res;

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = 300 * 2 ** attempt + Math.random() * 200;
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff);
        continue;
      }

      const body = await res.text().catch(() => "");
      throw new NcbiError(
        `NCBI request failed (${res.status}): ${body.slice(0, 200)}`,
        res.status === 429 ? 429 : 502,
      );
    }
  });
}

/** GET the NCBI Datasets genome endpoint for a taxon (name or taxid). */
export async function datasetsGenomeByTaxon(
  taxon: string,
  extra?: Record<string, string>,
): Promise<unknown> {
  const params = withCommonParams(new URLSearchParams(extra));
  const qs = params.toString();
  const url = `${DATASETS_BASE}/genome/taxon/${encodeURIComponent(taxon)}/dataset_report${
    qs ? `?${qs}` : ""
  }`;
  const res = await ncbiFetch(url);
  return res.json();
}

/** GET the NCBI Datasets genome report for a single assembly accession. */
export async function datasetsGenomeByAccession(
  accession: string,
): Promise<unknown> {
  const params = withCommonParams(new URLSearchParams());
  const qs = params.toString();
  const url = `${DATASETS_BASE}/genome/accession/${encodeURIComponent(accession)}/dataset_report${
    qs ? `?${qs}` : ""
  }`;
  const res = await ncbiFetch(url);
  return res.json();
}

/** Resolve a taxon name (or taxid) via the NCBI Datasets taxonomy endpoint.
 *  Unlike the genome report, this returns the taxon's OWN tax_id and rank, so
 *  "Geobacillus" resolves to the genus rather than to some species' assembly. */
export async function datasetsTaxonomy(taxon: string): Promise<unknown> {
  const params = withCommonParams(new URLSearchParams());
  const qs = params.toString();
  const url = `${DATASETS_BASE}/taxonomy/taxon/${encodeURIComponent(taxon)}${
    qs ? `?${qs}` : ""
  }`;
  const res = await ncbiFetch(url);
  return res.json();
}

/** esearch against a database; returns parsed JSON. */
export async function esearch(
  db: string,
  term: string,
  extra?: Record<string, string>,
): Promise<unknown> {
  const params = withCommonParams(
    new URLSearchParams({ db, term, retmode: "json", ...extra }),
  );
  const url = `${EUTILS_BASE}/esearch.fcgi?${params.toString()}`;
  const res = await ncbiFetch(url);
  return res.json();
}

/** esummary for a batch of UIDs — cheap way to get record titles without
 *  fetching whole GenPept records. Used to build "did you mean" suggestions. */
export async function esummary(
  db: string,
  ids: string[],
): Promise<unknown> {
  const params = withCommonParams(
    new URLSearchParams({ db, id: ids.join(","), retmode: "json" }),
  );
  const url = `${EUTILS_BASE}/esummary.fcgi?${params.toString()}`;
  const res = await ncbiFetch(url);
  return res.json();
}

/** efetch a single record as raw text (used for GenPept, rettype=gp). */
export async function efetchText(
  db: string,
  id: string,
  extra?: Record<string, string>,
): Promise<string> {
  const params = withCommonParams(
    new URLSearchParams({ db, id, retmode: "text", ...extra }),
  );
  const url = `${EUTILS_BASE}/efetch.fcgi?${params.toString()}`;
  const res = await ncbiFetch(url, { headers: { Accept: "text/plain" } });
  return res.text();
}
