"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export type TestimonialView = {
  id: string;
  author: string;
  city: string;
  rating: number;
  body: string;
  vehicleSlug: string | null;
  active: boolean;
};

const RATINGS = ["5", "4.9", "4.8", "4.7", "4.6", "4.5", "4", "3.5", "3", "2", "1"];

/**
 * Publishing a testimonial.
 *
 * The home page's six reviews were a `REVIEWS` const inside the component that
 * rendered them, so the social proof on the busiest page in the business was a
 * developer's file. Everything here writes to the `testimonials` table and
 * revalidates `/`, so a review published now is on the site now.
 */
export function TestimonialManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not publish the review.");
        return;
      }
      setNote(`${data.testimonial.author}'s review is on the home page.`);
      form.reset();
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin text-[15px] font-bold text-ink-900">New testimonial</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Appears in the carousel on the home page immediately. Hiding a review keeps the row — what the business
            published in public stays on record even after it comes down.
          </p>
        </div>
        <Button type="button" variant={open ? "outline" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add a review"}
        </Button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <Field label="Customer">
            <Input name="author" required minLength={2} maxLength={80} placeholder="Nusrat Jahan" />
          </Field>

          <Field label="City" hint="Shown under the name.">
            <Input name="city" maxLength={80} placeholder="Dhanmondi, Dhaka" />
          </Field>

          <Field label="Rating">
            <Select name="rating" defaultValue="5">
              {RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r} ★
                </option>
              ))}
            </Select>
          </Field>

          <Field label="What they said" className="sm:col-span-3" hint="Between 20 and 600 characters.">
            <Textarea name="body" required minLength={20} maxLength={600} rows={3} />
          </Field>

          <Field label="Car (optional)" className="sm:col-span-3" hint="The slug of the car they hired, if the review is about one.">
            <Input name="vehicleSlug" maxLength={120} placeholder="toyota-prado-2022" />
          </Field>

          <div className="sm:col-span-3">
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || pending}>
              {busy ? "Publishing…" : "Publish review"}
            </Button>
          </div>
        </form>
      )}

      {note && <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-[13px] font-medium text-success">{note}</p>}
    </Card>
  );
}

/**
 * One row, with its own editor.
 *
 * Editing happens in place rather than on a separate page: a testimonial is
 * five short fields, and the reason to open one is almost always a typo in a
 * name or a sentence the customer asked to have trimmed.
 */
export function TestimonialRow({ testimonial }: { testimonial: TestimonialView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/testimonials/${testimonial.id}`, {
        method,
        ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not save the change.");
        return false;
      }
      setEditing(false);
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = Object.fromEntries(new FormData(event.currentTarget).entries());
    await send("PATCH", {
      author: String(entries.author ?? ""),
      city: String(entries.city ?? ""),
      rating: Number(entries.rating ?? 5),
      body: String(entries.body ?? ""),
      vehicleSlug: String(entries.vehicleSlug ?? "").trim() || null,
    });
  }

  return (
    <>
      <tr className="transition-colors hover:bg-canvas">
        <td className="px-5 py-3.5">
          <span className="block font-admin text-[14px] font-bold text-ink-900">{testimonial.author}</span>
          <span className="block text-[12px] text-ink-400">{testimonial.city || "—"}</span>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">
          <span className="line-clamp-2 max-w-xl">{testimonial.body}</span>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">
          {testimonial.vehicleSlug ? (
            <span className="font-mono text-[12px]">{testimonial.vehicleSlug}</span>
          ) : (
            <span className="text-ink-400">service</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
          {testimonial.rating} ★
        </td>
        <td className="px-5 py-3.5 text-right">
          <span
            className={
              testimonial.active
                ? "rounded-full bg-success-soft px-2 py-0.5 text-[12px] font-semibold text-success"
                : "rounded-full bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-500"
            }
          >
            {testimonial.active ? "on the site" : "hidden"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-right">
          <span className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing((v) => !v)}
              className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("PATCH", { active: !testimonial.active })}
              className="text-[12px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900 disabled:opacity-50"
            >
              {testimonial.active ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete ${testimonial.author}'s review? This cannot be undone — use Hide to take it off the site and keep it.`)) {
                  void send("DELETE");
                }
              }}
              className="text-[12px] font-semibold text-ink-400 underline underline-offset-4 hover:text-danger disabled:opacity-50"
            >
              Remove
            </button>
          </span>
        </td>
      </tr>

      {editing && (
        <tr className="bg-canvas">
          <td colSpan={6} className="px-5 py-5">
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
              <Field label="Customer">
                <Input name="author" required minLength={2} maxLength={80} defaultValue={testimonial.author} />
              </Field>
              <Field label="City">
                <Input name="city" maxLength={80} defaultValue={testimonial.city} />
              </Field>
              <Field label="Rating">
                <Select name="rating" defaultValue={String(testimonial.rating)}>
                  {/* The stored value may not be one of the presets — an
                      imported review can carry any figure — so it is offered
                      alongside them rather than silently rounded on save. */}
                  {Array.from(new Set([String(testimonial.rating), ...RATINGS])).map((r) => (
                    <option key={r} value={r}>
                      {r} ★
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="What they said" className="sm:col-span-3">
                <Textarea name="body" required minLength={20} maxLength={600} rows={3} defaultValue={testimonial.body} />
              </Field>
              <Field label="Car (optional)" className="sm:col-span-3">
                <Input name="vehicleSlug" maxLength={120} defaultValue={testimonial.vehicleSlug ?? ""} />
              </Field>
              <div className="sm:col-span-3">
                {error && (
                  <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {!editing && error && (
        <tr>
          <td colSpan={6} className="px-5 pb-3">
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
              {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
