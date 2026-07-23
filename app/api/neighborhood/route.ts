import { NextResponse } from "next/server";
import { efetchText } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import { parseIpg, pickPrimaryRow } from "@/lib/ipg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLANK = 6000; // bp of context on each side of the gene

interface Gene {
  start: number; // window-relative, normalised so start <= stop
  stop: number;
  strand: "+" | "-";
  product?: string;
  gene?: string;
  locusTag?: string;
  proteinId?: string;
  isQuery: boolean;
}

// Parse an NCBI feature table (rettype=ft). Feature lines are
// "<start>\t<stop>\t<type>"; qualifier lines are "\t\t\t<key>\t<value>".
function parseFeatureTable(text: string, queryAcc: string): Gene[] {
  const queryBase = queryAcc.split(".")[0].toLowerCase();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const genes: Gene[] = [];
  let cur: Gene | null = null;

  const flush = () => {
    if (cur && (cur.product || cur.proteinId || cur.gene || cur.locusTag)) {
      genes.push(cur);
    }
    cur = null;
  };

  for (const line of lines) {
    if (line.startsWith(">Feature")) continue;
    const feat = /^(<?>?\d+)\t(<?>?\d+)\t(\w+)/.exec(line);
    if (feat) {
      const a = Number(feat[1].replace(/[<>]/g, ""));
      const b = Number(feat[2].replace(/[<>]/g, ""));
      const type = feat[3];
      if (type === "gene") {
        // Start a new gene record; the following CDS enriches it.
        flush();
        cur = {
          start: Math.min(a, b),
          stop: Math.max(a, b),
          strand: a <= b ? "+" : "-",
          isQuery: false,
        };
      } else if (type === "CDS") {
        // Keep the current gene record (same coords) and let CDS qualifiers fill in.
        if (!cur) {
          cur = {
            start: Math.min(a, b),
            stop: Math.max(a, b),
            strand: a <= b ? "+" : "-",
            isQuery: false,
          };
        }
      } else if (type !== "gene" && type !== "CDS") {
        // rRNA/tRNA/etc — flush any pending gene, skip the rest.
        flush();
      }
      continue;
    }
    const qual = /^\t\t\t(\S+)\t(.+)$/.exec(line);
    if (qual && cur) {
      const key = qual[1];
      const val = qual[2].trim();
      if (key === "product") cur.product = val;
      else if (key === "gene") cur.gene = val;
      else if (key === "locus_tag" && !cur.locusTag) cur.locusTag = val;
      else if (key === "protein_id") {
        cur.proteinId = val.replace(/^ref\|/, "").replace(/\|$/, "");
        if (cur.proteinId.split(".")[0].toLowerCase() === queryBase) {
          cur.isQuery = true;
        }
      }
    }
  }
  flush();
  return genes;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accession = (searchParams.get("accession") ?? "").trim();
  if (!accession) {
    return NextResponse.json({ error: "missing ?accession=" }, { status: 400 });
  }

  try {
    const ipgText = await efetchText("protein", accession, { rettype: "ipg" });
    const row = pickPrimaryRow(parseIpg(ipgText));
    if (!row) {
      return NextResponse.json(
        { error: "No genomic placement found for this protein." },
        { status: 404 },
      );
    }

    const lo = Math.min(row.start, row.stop);
    const hi = Math.max(row.start, row.stop);
    const winStart = Math.max(1, lo - FLANK);
    const winStop = hi + FLANK;

    const ft = await efetchText("nuccore", row.nucleotide, {
      rettype: "ft",
      seq_start: String(winStart),
      seq_stop: String(winStop),
    });
    const genes = parseFeatureTable(ft, accession);

    return NextResponse.json({
      context: {
        nucleotide: row.nucleotide,
        organism: row.organism,
        strain: row.strain,
        assembly: row.assembly,
        strand: row.strand,
        geneStart: row.start,
        geneStop: row.stop,
      },
      window: { start: winStart, stop: winStop, length: winStop - winStart + 1 },
      genes,
    });
  } catch (err) {
    return handleError(err);
  }
}
