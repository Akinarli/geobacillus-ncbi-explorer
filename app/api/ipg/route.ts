import { NextResponse } from "next/server";
import { efetchText } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import { parseIpg } from "@/lib/ipg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Identical Protein Groups for an accession: which assemblies/strains carry this
// exact protein, and where on their genomes. Powers both the strains panel and
// the gene-neighborhood lookup.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accession = (searchParams.get("accession") ?? "").trim();
  if (!accession) {
    return NextResponse.json({ error: "missing ?accession=" }, { status: 400 });
  }

  try {
    const text = await efetchText("protein", accession, { rettype: "ipg" });
    const rows = parseIpg(text);
    return NextResponse.json({ rows });
  } catch (err) {
    return handleError(err);
  }
}
