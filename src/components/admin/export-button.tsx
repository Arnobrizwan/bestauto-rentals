"use client";

import { useSearchParams } from "next/navigation";

/**
 * Downloads the current table as CSV.
 *
 * It forwards the page's own query string, so the export carries the filters,
 * the search and the sort the operator is actually looking at — and the whole
 * result set rather than the page they happen to be on, which is the usual
 * disappointment with an export button.
 */
export function ExportButton({ dataset }: { dataset: "bookings" | "leads" | "customers" | "vehicles" }) {
  const params = useSearchParams();

  const query = new URLSearchParams(params.toString());
  query.set("dataset", dataset);
  query.delete("page");

  return (
    <a
      href={`/api/export?${query.toString()}`}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3.5 font-admin text-[13px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-900"
    >
      <svg viewBox="0 0 24 24" className="size-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Export CSV
    </a>
  );
}
