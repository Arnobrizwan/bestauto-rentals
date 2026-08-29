"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Recording a renewal from the expiry row.
 *
 * The board listed documents about to lapse and offered no way to say one had
 * been renewed, so a car stayed on the list — and in the daily digest — after
 * the problem was solved.
 */
export function DocumentActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function renew(months: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ months }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(typeof data.error === "string" ? data.error : "Could not record the renewal.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center justify-end gap-3">
      {/* A year covers fitness, tax token and insurance; a route permit is
          often shorter, so both are offered rather than assumed. */}
      <button
        type="button"
        disabled={busy}
        onClick={() => void renew(12)}
        title="Record a renewal running twelve months from today"
        className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
      >
        Renewed 1yr
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void renew(6)}
        title="Record a renewal running six months from today"
        className="text-[12px] font-semibold text-ink-400 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
      >
        6mo
      </button>
    </span>
  );
}
