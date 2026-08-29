"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BRANCHES, UNIT_STATUSES } from "@/lib/taxonomy";

/**
 * Changing a unit's branch or status from its row.
 *
 * The board could show that a car sat at Gulshan and was off the road, and
 * offered no way to say it had moved to the airport or come back — both were
 * hand edits to the database. Two selects rather than an edit page: these are
 * the only two fields on a unit that change during its life, and they change
 * at the counter, in a hurry.
 *
 * Taking a unit off the road removes it from what the public fleet offers, so
 * the endpoint moves stock and revalidates the customer-facing pages; the
 * select reverts if the write is refused.
 */
export function UnitActions({
  id,
  branch,
  status,
}: {
  id: string;
  branch: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localBranch, setLocalBranch] = useState(branch);
  const [localStatus, setLocalStatus] = useState(status);

  async function send(patch: { branch?: string; status?: string }, revert: () => void) {
    setBusy(true);
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        revert();
        window.alert(typeof data.error === "string" ? data.error : "Could not update the unit.");
        return;
      }
      router.refresh();
    } catch {
      revert();
      window.alert("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  // The unit's current branch may predate the shared list, so it is offered
  // alongside rather than silently dropped from its own row.
  const branches = Array.from(new Set([localBranch, ...BRANCHES]));

  return (
    <span className="flex items-center justify-end gap-2">
      <select
        value={localBranch}
        disabled={busy}
        aria-label="Branch"
        onChange={(e) => {
          const next = e.target.value;
          const previous = localBranch;
          setLocalBranch(next);
          void send({ branch: next }, () => setLocalBranch(previous));
        }}
        className="h-9 max-w-40 rounded-lg border border-line bg-white px-2 text-[12px] font-semibold text-ink-900 outline-none focus:border-brand-300 disabled:opacity-50"
      >
        {branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        value={localStatus}
        disabled={busy}
        aria-label="Status"
        onChange={(e) => {
          const next = e.target.value;
          const previous = localStatus;
          setLocalStatus(next);
          void send({ status: next }, () => setLocalStatus(previous));
        }}
        className="h-9 rounded-lg border border-line bg-white px-2 text-[12px] font-semibold text-ink-900 capitalize outline-none focus:border-brand-300 disabled:opacity-50"
      >
        {UNIT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </span>
  );
}
