"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Result = { tier: string; score: number; nextAction: string };

const TIMEFRAMES = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "next_month", label: "Next month" },
  { value: "this_quarter", label: "Later this quarter" },
  { value: "unknown", label: "Not sure yet" },
];

const INTENTS = [
  { value: "book", label: "I want to book now" },
  { value: "enquiry", label: "I have a question" },
  { value: "corporate", label: "Corporate / multiple cars" },
  { value: "browse", label: "Just looking" },
];

/**
 * The "Register" entry point from the wireframe nav.
 *
 * Rather than a decorative sign-up, it opens a real account request that goes
 * through the same intake as the concierge: scored by the lead qualifier, then
 * published to the automation engine — so a hot lead pages the sales channel
 * and opens a call task before the visitor has closed the tab.
 */
export function RegisterSection() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    intent: "book",
    timeframe: "this_week",
    budgetPerDay: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          company: form.company || undefined,
          message: form.message,
          intent: form.intent,
          timeframe: form.timeframe,
          budgetPerDay: form.budgetPerDay ? Number(form.budgetPerDay) : undefined,
          source: "web",
        }),
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "We couldn't send that just now.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
  const label = "mb-1.5 block text-[13px] font-semibold text-ink-700";

  return (
    <section id="register" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div data-reveal>
            <span className="text-xs font-semibold tracking-[0.16em] text-brand-500 uppercase">Register</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[40px]">
              Open an account
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
              Tell us what you need and we will come back with a held quote. Corporate accounts get fifteen-day
              invoicing with a VAT challan and a named account manager.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { title: "Answered fast", body: "Urgent requests reach the sales team the moment they arrive, not the next working day." },
                { title: "Priced in taka", body: "A driver is included and fuel is billed at cost. No surprise line items at handover." },
                { title: "No obligation", body: "A quote is a quote. Nothing is charged until you confirm the dates." },
              ].map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-semibold text-ink-900">{item.title}</span>
                    <span className="block text-[14px] leading-relaxed text-ink-400">{item.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal data-reveal-delay="80">
            {result ? (
              <div className="rounded-2xl border border-line bg-canvas p-8 text-center shadow-card">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
                  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink-900">
                  Thank you, {form.name.split(" ")[0]}.
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-400">
                  {result.tier === "hot"
                    ? "Your request has been flagged as priority — someone from the team will call you within the hour."
                    : result.tier === "warm"
                      ? "We are putting a shortlist together and will email it to you shortly."
                      : "We have your details and will be in touch. In the meantime the assistant can answer most questions instantly."}
                </p>
                <p className="mt-4 text-[13px] text-ink-400">
                  A confirmation is on its way to <span className="font-semibold text-ink-700">{form.email}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="mt-6 text-sm font-semibold text-brand-500 hover:underline"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-2xl border border-line bg-canvas p-6 shadow-card lg:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={label}>Your name</span>
                    <input required minLength={2} value={form.name} onChange={set("name")} placeholder="Tanvir Hossain" className={field} />
                  </label>
                  <label className="block">
                    <span className={label}>Email</span>
                    <input required type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" className={field} />
                  </label>
                  <label className="block">
                    <span className={label}>
                      Phone <span className="font-normal text-ink-400">(optional)</span>
                    </span>
                    <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+880 1712-345678" className={field} />
                  </label>
                  <label className="block">
                    <span className={label}>
                      Company <span className="font-normal text-ink-400">(optional)</span>
                    </span>
                    <input value={form.company} onChange={set("company")} placeholder="Acme Logistics" className={field} />
                  </label>
                  <label className="block">
                    <span className={label}>What do you need?</span>
                    <select value={form.intent} onChange={set("intent")} className={cn(field, "cursor-pointer")}>
                      {INTENTS.map((i) => (
                        <option key={i.value} value={i.value}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={label}>When?</span>
                    <select value={form.timeframe} onChange={set("timeframe")} className={cn(field, "cursor-pointer")}>
                      {TIMEFRAMES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={label}>
                      Budget per day <span className="font-normal text-ink-400">(optional, in taka)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      // Not step={500}. The browser refuses any value off the
                      // step and explains itself with "the two nearest valid
                      // values are 8500 and 9000" — so a customer typing a
                      // real budget of 8,700 was blocked from a public form by
                      // a rule nobody chose and nothing needs.
                      step={1}
                      value={form.budgetPerDay}
                      onChange={set("budgetPerDay")}
                      placeholder="6000"
                      className={field}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={label}>Tell us a bit more</span>
                    <textarea
                      required
                      minLength={4}
                      rows={4}
                      value={form.message}
                      onChange={set("message")}
                      placeholder="Six of us going to Sylhet for four days from the 12th, collecting from Gulshan."
                      className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </label>
                </div>

                {error && (
                  <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-400 text-[15px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(255,159,67,1)] transition-all hover:bg-brand-500 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Sending
                    </>
                  ) : (
                    "Send my request"
                  )}
                </button>
                <p className="mt-3 text-center text-[12px] text-ink-400">
                  We only use your details to answer this request.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
