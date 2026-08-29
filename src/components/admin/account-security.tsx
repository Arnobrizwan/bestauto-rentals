"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Field, Input } from "@/components/ui";

/** Password change and "sign out everywhere" for the signed-in account. */
export function AccountSecurity() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword: String(form.get("newPassword") ?? ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not change the password.");
        return;
      }
      (event.target as HTMLFormElement).reset();
      setDone("Password changed. Every other device has been signed out.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeEverywhere() {
    setBusy(true);
    try {
      await fetch("/api/auth/password", { method: "DELETE" });
      router.push("/login?stale=1");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5 p-5">
      <h2 className="font-admin text-[15px] font-bold text-ink-900">Your account</h2>
      <p className="mt-0.5 mb-4 text-[13px] text-ink-400">
        Changing your password signs out every other device. Sessions are signed cookies rather than rows, so this is
        what revokes them — there is nothing to delete on a device you no longer have.
      </p>

      <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password">
          <Input name="currentPassword" type="password" required autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="At least 12 characters.">
          <Input name="newPassword" type="password" required minLength={12} autoComplete="new-password" />
        </Field>

        {error && (
          <p role="alert" className="text-[13px] text-danger sm:col-span-2">
            {error}
          </p>
        )}
        {done && <p className="text-[13px] text-success sm:col-span-2">{done}</p>}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
          <button
            type="button"
            onClick={revokeEverywhere}
            disabled={busy}
            className="text-[13px] font-semibold text-ink-500 hover:text-danger"
          >
            Sign out everywhere
          </button>
        </div>
      </form>
    </Card>
  );
}
