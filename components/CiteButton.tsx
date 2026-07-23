"use client";

import { useState } from "react";
import type { ProteinRecord } from "@/lib/types";
import { toBibtex } from "@/lib/cite";

// Copies a BibTeX citation for the record (and its key reference) to the
// clipboard — the "how do I cite this" shortcut.
export default function CiteButton({
  record,
  label = "cite (BibTeX)",
}: {
  record: ProteinRecord;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(toBibtex(record));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="data text-[11px] text-petrol underline decoration-rule underline-offset-[3px] hover:decoration-current"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
