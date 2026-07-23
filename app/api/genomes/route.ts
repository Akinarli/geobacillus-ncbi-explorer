import { NextResponse } from "next/server";
import { datasetsGenomeByTaxon } from "@/lib/ncbi";
import { handleError } from "@/lib/apiError";
import {
  dedupePairedAccessions,
  isFromTypeMaterial,
  isReferenceGenome,
  rankScore,
  type DatasetsReport,
} from "@/lib/datasets";
import type { Assembly } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toAssembly(r: DatasetsReport, taxidFallback: number): Assembly {
  const info = r.assembly_info ?? {};
  return {
    accession: r.accession ?? "",
    name: info.assembly_name ?? r.accession ?? "",
    organism: r.organism?.organism_name ?? "",
    strain:
      r.organism?.infraspecific_names?.strain ??
      r.organism?.infraspecific_names?.isolate,
    refseqCategory: info.refseq_category,
    isTypeMaterial: isFromTypeMaterial(r),
    isReference: isReferenceGenome(r),
    bioproject: info.bioproject_accession,
    biosample: info.biosample?.accession ?? info.biosample_accession,
    taxid: r.organism?.tax_id ?? taxidFallback,
  };
}

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
    const capped = (data.total_count ?? raw.length) > raw.length;
    const taxidNum = Number(taxid);

    const assemblies = reports
      .slice()
      .sort((a, b) => {
        const diff = rankScore(a) - rankScore(b);
        if (diff !== 0) return diff;
        // Within a rank, prefer the RefSeq (GCF_) copy over GenBank (GCA_),
        // matching how NCBI surfaces the RefSeq reference assembly first.
        const aRefSeq = (a.accession ?? "").startsWith("GCF_") ? 0 : 1;
        const bRefSeq = (b.accession ?? "").startsWith("GCF_") ? 0 : 1;
        if (aRefSeq !== bRefSeq) return aRefSeq - bRefSeq;
        return (a.accession ?? "").localeCompare(b.accession ?? "");
      })
      .map((r) => toAssembly(r, taxidNum));

    return NextResponse.json({
      assemblies,
      total: data.total_count ?? reports.length,
      capped,
    });
  } catch (err) {
    return handleError(err);
  }
}
