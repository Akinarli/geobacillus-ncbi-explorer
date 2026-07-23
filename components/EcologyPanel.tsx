"use client";

import { useState } from "react";

interface Ref {
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
  doiUrl?: string;
  pubmedUrl?: string;
  url?: string;
  sourceLabel?: string;
  openAccess?: boolean;
}
interface Sourced {
  value: string;
  refs: Ref[];
}
interface Ecology {
  assembly: string;
  organism: string;
  strain?: string;
  matched: boolean;
  lpsnName?: string;
  biosample?: {
    accession?: string;
    geo?: string;
    collectionDate?: string;
    collectedBy?: string;
    cultureCollection?: string;
    typeMaterial?: string;
  } | null;
  ecology: {
    isolation_source: Sourced | null;
    temperature: Sourced | null;
    ph: Sourced | null;
    salinity_nacl: Sourced | null;
  };
  references: Ref[];
}

// The single most useful link for a reference.
function refHref(r: Ref): string | undefined {
  return r.doiUrl || r.pubmedUrl || r.url;
}

// Tiny "source" links shown next to an ecology value — the evidence.
function Evidence({ refs }: { refs: Ref[] }) {
  const links = refs.map(refHref).filter(Boolean).slice(0, 3) as string[];
  if (links.length === 0) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-super">
      {links.map((href, i) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          title={refs[i]?.title || refs[i]?.sourceLabel || "source"}
          className="text-[10px] text-petrol hover:underline"
        >
          [{i + 1}]
        </a>
      ))}
    </span>
  );
}

function Row({ label, data }: { label: string; data: Sourced | null }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-rule py-2 sm:flex-row sm:gap-4">
      <dt className="eyebrow sm:w-32 sm:shrink-0">{label}</dt>
      <dd className="text-[13px]">
        {data ? (
          <>
            <span className="text-ink">{data.value}</span>
            <Evidence refs={data.refs} />
          </>
        ) : (
          <span className="text-muted/70">unknown</span>
        )}
      </dd>
    </div>
  );
}

export default function EcologyPanel({ accession }: { accession: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [data, setData] = useState<Ecology | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/ecology?accession=${encodeURIComponent(accession)}`,
      );
      const d = (await res.json()) as Ecology & { error?: string };
      if (!res.ok || d.error) throw new Error();
      setData(d);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const papers = data?.references.filter((r) => r.title) ?? [];

  return (
    <section className="mt-5 rounded-lg border border-rule bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="eyebrow">ecology &amp; references</h2>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-rule bg-paper px-3 py-1 text-[12px] text-ink transition-colors hover:border-petrol"
          >
            load isolation, growth &amp; literature →
          </button>
        )}
        {state === "loading" && <span className="eyebrow">gathering…</span>}
      </div>

      {state === "loading" && <div className="thermal-track mt-3" />}
      {state === "error" && (
        <p className="mt-2 text-[13px] text-ember">Could not load ecology data.</p>
      )}

      {state === "done" && data && (
        <div className="mt-3">
          {data.lpsnName && (
            <p
              className="text-[13px] text-muted"
              dangerouslySetInnerHTML={{
                __html: data.lpsnName.replace(/<I>/g, "<i>").replace(/<\/I>/g, "</i>"),
              }}
            />
          )}

          <dl className="mt-3">
            <Row label="isolation" data={data.ecology.isolation_source} />
            <Row label="temperature" data={data.ecology.temperature} />
            <Row label="pH" data={data.ecology.ph} />
            <Row label="salinity" data={data.ecology.salinity_nacl} />
          </dl>

          {data.biosample && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              {data.biosample.geo && <span>geo: {data.biosample.geo}</span>}
              {data.biosample.collectionDate && (
                <span>collected: {data.biosample.collectionDate}</span>
              )}
              {data.biosample.collectedBy && (
                <span>by {data.biosample.collectedBy}</span>
              )}
              {data.biosample.cultureCollection && (
                <span className="data">{data.biosample.cultureCollection}</span>
              )}
            </p>
          )}

          {!data.matched && (
            <p className="mt-3 rounded-md border border-rule bg-sunk px-3 py-2 text-[12px] text-muted">
              No BacDive strain record matched — showing evidenced metadata and
              literature only (growth conditions unknown).
            </p>
          )}

          {papers.length > 0 && (
            <div className="mt-4 border-t border-rule pt-3">
              <p className="eyebrow">key references</p>
              <ul className="mt-2 flex flex-col gap-3">
                {papers.map((r, i) => (
                  <li key={i} className="text-[13px]">
                    <a
                      href={refHref(r)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink hover:text-petrol"
                    >
                      {r.title}
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      {r.authors && (
                        <span className="max-w-[38ch] truncate">{r.authors}</span>
                      )}
                      {r.journal && (
                        <span className="italic">
                          {r.journal}
                          {r.year ? ` (${r.year})` : ""}
                        </span>
                      )}
                      {r.doiUrl && (
                        <a
                          href={r.doiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-petrol underline decoration-rule underline-offset-2 hover:decoration-current"
                        >
                          DOI ↗
                        </a>
                      )}
                      {r.pubmedUrl && (
                        <a
                          href={r.pubmedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-petrol underline decoration-rule underline-offset-2 hover:decoration-current"
                        >
                          PubMed ↗
                        </a>
                      )}
                      {r.openAccess && (
                        <span className="rounded bg-verified-soft px-1.5 text-[10px] text-verified">
                          open access
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
