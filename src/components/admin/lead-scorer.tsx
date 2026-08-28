"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Result = {
  score: number;
  tier: string;
  summary: string;
  nextAction: string;
  signals: { label: string; impact: number; detail: string }[];
  engine: { engine: string; model: string; hosted: boolean };
  latencyMs: number;
};

const SAMPLES = [
  "I need the BMW M4 from 14th March for 5 days, budget is around £250 a day. Can you confirm today?",
  "Just looking, no rush. Might need something someday.",
  "We need 6 vehicles on a rolling monthly contract for our field team. Please send commercial terms.",
];

/**
 * Sandbox for the lead qualifier. Scores without persisting, so an operator can
 * probe the model before wiring a new intake channel to it.
 */
export function LeadScorer() {
  const [message, setMessage] = useState(SAMPLES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function score() {
    if (message.trim().length < 4) {
      setError("Write a message to score.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/qualify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Sandbox Lead",
          email: "sandbox@example.com",
          message,
          intent: "enquiry",
        }),
      });
      if (!res.ok) throw new Error("The scorer is unavailable.");
      setResult((await res.json()) as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5">
      <p className="text-[13px] text-ink-400">
        Paste an enquiry to see exactly how it scores and why. Nothing here is saved to the leads table.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((sample, i) => (
          <button
            key={sample}
            type="button"
            onClick={() => setMessage(sample)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900"
          >
            Sample {i + 1}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={2000}
        aria-label="Lead message to score"
        className="mt-3 w-full rounded-xl border border-line px-3.5 py-3 text-[13px] outline-none focus:border-brand-300"
      />

      <button
        type="button"
        onClick={() => void score()}
        disabled={loading}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-ink-900 px-5 font-admin text-[13px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
      >
        {loading ? "Scoring…" : "Score this lead"}
      </button>

      {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}

      {result && (
        <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "grid size-14 shrink-0 place-items-center rounded-xl font-admin text-xl font-bold text-white",
                result.tier === "hot" ? "bg-danger" : result.tier === "warm" ? "bg-brand-400" : "bg-ink-400",
              )}
            >
              {result.score}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-admin text-[14px] font-bold text-ink-900 capitalize">{result.tier} lead</p>
              <p className="text-[13px] text-ink-500">{result.summary}</p>
            </div>
            <span className="text-[11px] text-ink-400">
              {result.engine.hosted ? result.engine.model : "rules"} · {result.latencyMs}ms
            </span>
          </div>

          <ul className="mt-4 space-y-1.5">
            {result.signals.map((signal, i) => (
              <li key={`${signal.label}-${i}`} className="flex items-start gap-2 text-[12px]">
                <span
                  className={cn(
                    "mt-px w-11 shrink-0 rounded px-1 py-0.5 text-center font-bold",
                    signal.impact >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                  )}
                >
                  {signal.impact >= 0 ? "+" : ""}
                  {signal.impact}
                </span>
                <span>
                  <span className="font-semibold text-ink-700">{signal.label}</span>
                  <span className="text-ink-400"> — {signal.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[13px] font-semibold text-brand-700">
            Next: {result.nextAction}
          </p>
        </div>
      )}
    </div>
  );
}
