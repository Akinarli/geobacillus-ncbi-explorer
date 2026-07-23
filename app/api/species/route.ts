import { NextResponse } from "next/server";
import { datasetsGenomeByTaxon } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import {
  dedupePairedAccessions,
  isFromTypeMaterial,
  type DatasetsReport,
} from "@/lib/datasets";
import type { SpeciesSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the species under a genus, with how many genome assemblies each has.
// One Datasets call returns every assembly for the genus; we collapse the
// GCA/GCF pairs and group by organism. For Geobacillus this yields 84 species
// across 248 assemblies.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taxid = (searchParams.get("taxid") ?? "").trim();
  if (!taxid) {
    return NextResponse.json({ error: "missing ?taxid=" }, { status: 400 });
  }

  try {
    const data = (await datasetsGenomeByTaxon(taxid, {
      page_size: "1000",
    })) as { reports?: DatasetsReport[]; total_count?: number };

    const raw = data.reports ?? [];
    const reports = dedupePairedAccessions(raw);
    // NCBI caps us at page_size; a huge genus returns far more than we fetched.
    const capped = (data.total_count ?? raw.length) > raw.length;

    const grouped = new Map<number, SpeciesSummary>();
    for (const r of reports) {
      const id = r.organism?.tax_id;
      if (id == null) continue;
      const existing = grouped.get(id);
      if (existing) {
        existing.assemblyCount++;
        if (isFromTypeMaterial(r)) existing.hasTypeMaterial = true;
      } else {
        grouped.set(id, {
          taxid: id,
          organism: r.organism?.organism_name ?? String(id),
          assemblyCount: 1,
          hasTypeMaterial: isFromTypeMaterial(r),
        });
      }
    }

    // Most-sequenced species first — that's usually what people are looking for.
    const species = [...grouped.values()].sort(
      (a, b) =>
        b.assemblyCount - a.assemblyCount ||
        a.organism.localeCompare(b.organism),
    );

    return NextResponse.json({
      species,
      totalAssemblies: reports.length,
      total: data.total_count ?? reports.length,
      capped,
    });
  } catch (err) {
    return handleError(err);
  }
}
