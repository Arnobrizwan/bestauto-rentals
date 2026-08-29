"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, Input, Select } from "@/components/ui";

/**
 * Creating and stopping discount codes.
 *
 * Coupons were seed-only: eight were live, the board showed 421 redemptions,
 * and none of them could be added, changed or stopped without a redeploy — a
 * code leaked to a forum had no off switch at all. The home page now lists
 * live offers to customers, which makes that worse, so both endpoints
 * revalidate it.
 */
export function CouponManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Read once, in a state initialiser: calling Date.now() during render is
  // impure and re-dates the form every time React happens to re-render it.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [defaultEnd] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create the code.");
        return;
      }
      setNote(`${data.coupon.code} is live. The home page has been refreshed.`);
      (event.target as HTMLFormElement).reset();
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field = "sm:col-span-1";

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin text-[15px] font-bold text-ink-900">New discount code</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Goes live on the public site immediately. A code that has never been redeemed can be deleted; one with
            history is stopped instead, so the bookings priced with it stay explainable.
          </p>
        </div>
        <Button type="button" variant={open ? "outline" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add a code"}
        </Button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <Field label="Code" className={field} hint="Letters and numbers. Typed by hand at checkout.">
            <Input name="code" required minLength={3} maxLength={24} pattern="[A-Za-z0-9]+" placeholder="EIDSAFAR" />
          </Field>

          <Field label="Offer" className="sm:col-span-2">
            <Input name="description" required minLength={3} maxLength={160} placeholder="Eid travel — flat taka off" />
          </Field>

          <Field label="Type" className={field}>
            <Select name="kind" defaultValue="percent">
              <option value="percent">Percent off</option>
              <option value="flat">Flat taka off</option>
            </Select>
          </Field>

          <Field label="Value" className={field} hint="Percent must be 100 or less.">
            <Input name="value" type="number" min={1} step={1} required defaultValue={10} />
          </Field>

          <Field label="Minimum days" className={field}>
            <Input name="minDays" type="number" min={1} max={90} required defaultValue={1} />
          </Field>

          <Field label="Starts" className={field}>
            <Input name="startsAt" type="date" required defaultValue={today} />
          </Field>

          <Field label="Ends" className={field}>
            <Input name="endsAt" type="date" required defaultValue={defaultEnd} />
          </Field>

          <Field label="Usage limit" className={field} hint="0 means no limit.">
            <Input name="usageLimit" type="number" min={0} required defaultValue={100} />
          </Field>

          <div className="sm:col-span-3">
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || pending}>
              {busy ? "Creating…" : "Create code"}
            </Button>
          </div>
        </form>
      )}

      {note && (
        <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-[13px] font-medium text-success">{note}</p>
      )}
    </Card>
  );
}

/** Stop or delete one code, from its row. */
export function CouponRowActions({ id, code, active }: { id: string; code: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${id}`, {
        method,
        ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(typeof data.error === "string" ? data.error : `Could not update ${code}.`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void send("PATCH", { active: !active })}
        className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
      >
        {active ? "Stop" : "Resume"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void send("DELETE")}
        className="text-[12px] font-semibold text-ink-400 underline underline-offset-4 hover:text-danger disabled:opacity-50"
      >
        Remove
      </button>
    </span>
  );
}
