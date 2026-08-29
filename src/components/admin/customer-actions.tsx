"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Button, Field, Input } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";

export type CustomerView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  bookingCount: number;
  lifetimeValue: number;
  lastBookingAt: string | null;
  createdAt: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * One customer, with an editor for their contact details.
 *
 * The board ranked people by lifetime value and could change nothing about
 * them, so a transposed digit in a phone number stayed wrong — and that number
 * is how the counter reaches someone whose flight has landed early.
 *
 * Country is not editable: it is an ISO code that joins to the world map on
 * the dashboard, and it records where the booking came from rather than how to
 * reach the person. Editing it as free text would drop them off the map.
 */
export function CustomerRow({ customer }: { customer: CustomerView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const entries = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(entries.name ?? ""),
          email: String(entries.email ?? ""),
          phone: String(entries.phone ?? ""),
          city: String(entries.city ?? ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save the change.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="transition-colors hover:bg-canvas">
        <td className="px-5 py-3.5">
          <span className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 font-admin text-[12px] font-bold text-white">
              {initials(customer.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-admin text-[14px] font-bold text-ink-900">{customer.name}</span>
              <span className="block truncate text-[12px] text-ink-400">{customer.email}</span>
            </span>
          </span>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">
          {customer.city}
          <span className="block text-[12px] text-ink-400">{customer.country}</span>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">{customer.phone || "—"}</td>
        <td className="px-5 py-3.5">
          <Badge tone={customer.bookingCount >= 5 ? "softSuccess" : "neutral"}>{customer.bookingCount}</Badge>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">
          {customer.lastBookingAt ? formatDate(customer.lastBookingAt) : "—"}
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">{formatDate(customer.createdAt)}</td>
        <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
          {formatCurrency(customer.lifetimeValue)}
        </td>
        <td className="px-5 py-3.5 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="bg-canvas">
          <td colSpan={8} className="px-5 py-5">
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-4">
              <Field label="Name">
                <Input name="name" required minLength={2} maxLength={120} defaultValue={customer.name} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required maxLength={200} defaultValue={customer.email} />
              </Field>
              <Field label="Phone" hint="Dialled from the counter — any format.">
                <Input name="phone" maxLength={40} defaultValue={customer.phone} placeholder="+8801XXXXXXXXX" />
              </Field>
              <Field label="City">
                <Input name="city" maxLength={120} defaultValue={customer.city} />
              </Field>
              <div className="sm:col-span-4">
                {error && (
                  <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                    {error}
                  </p>
                )}
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Saving…" : "Save details"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
