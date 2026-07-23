import { NextResponse } from "next/server";
import { datasetsGenomeByAccession } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import { extractStats, type DatasetsReport } from "@/lib/datasets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assembly-level stats (genome size, GC%, N50, gene counts) for one accession,
// shown as a strip on the assembly page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accession = (searchParams.get("accession") ?? "").trim();
  if (!accession) {
    return NextResponse.json({ error: "missing ?accession=" }, { status: 400 });
  }

  try {
    const data = (await datasetsGenomeByAccession(accession)) as {
      reports?: DatasetsReport[];
    };
    const report = data.reports?.[0];
    if (!report) {
      return NextResponse.json(
        { error: `No assembly report for "${accession}".` },
        { status: 404 },
      );
    }
    return NextResponse.json({ stats: extractStats(report) });
  } catch (err) {
    return handleError(err);
  }
}
