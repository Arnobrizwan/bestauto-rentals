"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = (await res.json()) as { next?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create the account.");
      router.replace(data.next ?? "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const field =
    "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
  const label = "mb-1.5 block text-[13px] font-semibold text-ink-700";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={label}>Your name</span>
        <input required minLength={2} value={form.name} onChange={set("name")} placeholder="Tanvir Hossain" className={field} />
      </label>
      <label className="block">
        <span className={label}>Email</span>
        <input required type="email" autoComplete="username" value={form.email} onChange={set("email")} placeholder="you@bestauto.com.bd" className={field} />
      </label>
      <label className="block">
        <span className={label}>Password</span>
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={form.password}
          onChange={set("password")}
          placeholder="At least 12 characters"
          className={field}
        />
      </label>
      <label className="block">
        <span className={label}>Confirm password</span>
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={form.confirm}
          onChange={set("confirm")}
          className={field}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-400 text-[15px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(255,159,67,1)] transition-all hover:bg-brand-500 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Creating account
          </>
        ) : (
          "Create administrator"
        )}
      </button>
    </form>
  );
}
