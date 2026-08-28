"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ next, demo }: { next: string; demo: { email: string; password: string } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(demo?.email ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const data = (await res.json()) as { next?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not sign you in.");
      // Full navigation so the server re-reads the new cookie.
      router.replace(data.next ?? "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const field =
    "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@bestauto.co.uk"
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-700">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
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
            Signing in
          </>
        ) : (
          "Sign in"
        )}
      </button>

      {demo && (
        <button
          type="button"
          onClick={() => {
            setEmail(demo.email);
            setPassword(demo.password);
          }}
          className="w-full rounded-xl border border-dashed border-ink-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <span className="block text-[12px] font-semibold tracking-wide text-ink-400 uppercase">
            Reviewer access
          </span>
          <span className="mt-1 block font-mono text-[13px] text-ink-700">{demo.email}</span>
          <span className="block font-mono text-[13px] text-ink-700">{demo.password}</span>
          <span className="mt-1.5 block text-[12px] text-ink-400">Click to fill, then sign in.</span>
        </button>
      )}
    </form>
  );
}
