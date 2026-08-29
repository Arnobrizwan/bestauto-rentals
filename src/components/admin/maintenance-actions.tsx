"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Opening and closing a maintenance job from its row.
 *
 * The whole screen was read-only, so a car on a garage ramp stayed bookable on
 * the public site — the board said "off road" and the fleet page still offered
 * it. Each button moves the job and the car's stock together.
 */
export function MaintenanceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const offRoad = status !== "done";
  const next = offRoad ? "done" : "open";

  async function move() {
    setBusy(true);
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(typeof data.error === "string" ? data.error : "Could not update the job.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void move()}
      disabled={busy}
      title={offRoad ? "Close the job and return the car to the fleet" : "Reopen and take the car off road"}
      className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
    >
      {busy ? "Saving…" : offRoad ? "Mark done" : "Reopen"}
    </button>
  );
}
