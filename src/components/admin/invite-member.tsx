"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Field, Input, Select } from "@/components/ui";

/**
 * Creates a further staff account.
 *
 * The password is typed by the inviting admin and shown once, rather than
 * emailed: there is no delivery provider wired up, and inventing one would be
 * worse than being explicit that the credential has to be handed over out of
 * band. A viewer can read every board but cannot mutate anything.
 */
export function InviteMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "viewer") as "admin" | "viewer",
    };

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create the account.");
        return;
      }
      setDone(`${payload.name} can now sign in as ${payload.role}.`);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button type="button" onClick={() => setOpen(true)}>
          Invite a colleague
        </Button>
        {done && <p className="text-[13px] text-success">{done}</p>}
      </div>
    );
  }

  return (
    <Card className="mb-5 p-5">
      <h2 className="font-admin text-[15px] font-bold text-ink-900">Invite a colleague</h2>
      <p className="mt-0.5 mb-4 text-[13px] text-ink-400">
        Set a starting password and hand it over directly — nothing is emailed, because no delivery provider is
        configured. They can be an admin, who can change things, or a viewer, who can only read.
      </p>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" required minLength={2} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Starting password" hint="At least 12 characters.">
          <Input name="password" type="text" required minLength={12} maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue="viewer">
            <option value="viewer">Viewer — read only</option>
            <option value="admin">Admin — can change things</option>
          </Select>
        </Field>

        {error && (
          <p role="alert" className="sm:col-span-2 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[13px] font-semibold text-ink-500 hover:text-ink-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
