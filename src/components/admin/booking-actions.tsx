"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Confirming or cancelling a booking from its row.
 *
 * The bookings screen was read-only, so a booking could never be confirmed or
 * cancelled from the panel — and cancelling is what fires `booking.cancelled`,
 * which the shipped "Cancellation recovery" automation had been waiting for
 * since it was written.
 */
export function BookingActions({ reference, status }: { reference: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(next: "success" | "cancelled" | "pending") {
    if (next === "cancelled" && !window.confirm(`Cancel ${reference}? This releases the car back to the fleet.`)) {
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${reference}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(typeof data.error === "string" ? data.error : "Could not update the booking.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const link = "text-[12px] font-semibold underline underline-offset-4 disabled:opacity-50";

  return (
    <span className="flex items-center justify-end gap-3">
      {status !== "success" && (
        <button type="button" disabled={busy} onClick={() => void move("success")} className={`${link} text-success hover:text-ink-900`}>
          Confirm
        </button>
      )}
      {status !== "cancelled" && (
        <button type="button" disabled={busy} onClick={() => void move("cancelled")} className={`${link} text-ink-400 hover:text-danger`}>
          Cancel
        </button>
      )}
      {status === "cancelled" && (
        <button type="button" disabled={busy} onClick={() => void move("pending")} className={`${link} text-ink-500 hover:text-ink-900`}>
          Reinstate
        </button>
      )}
    </span>
  );
}
