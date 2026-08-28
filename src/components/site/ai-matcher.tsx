"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { cn, formatCurrency } from "@/lib/utils";

type Pick = {
  slug: string;
  name: string;
  rank: number;
  headline: string;
  reason: string;
  tradeoff: string;
  fitScore: number;
  pricePerDay: number;
  imageUrl: string;
  seats: number;
  transmission: string;
  fuel: string;
  rating: number;
};

type Result = {
  picks: Pick[];
  summary: string;
  engine: { engine: string; model: string; hosted: boolean };
  latencyMs: number;
};

const EXAMPLES = [
  "Family of 6 driving to Cornwall for a week, budget around £150 a day",
  "Something cheap and automatic for city errands in London",
  "Wedding car for one day, want it to look spectacular",
  "Business trip, client pickups from Heathrow, needs to look sharp",
];

/**
 * AI vehicle matcher — the customer-facing entry point to the recommender
 * agent. Sends a free-text brief and renders ranked picks with the reasoning.
 */
export function AiMatcher() {
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 8) {
      setError("Tell me a bit more — party size, budget, or what the trip is for.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: trimmed }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "Slow down a moment and try again." : "The matcher is unavailable right now.");
      setResult((await res.json()) as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="matcher" className="relative overflow-hidden bg-ink-900 py-20 lg:py-28">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 15% 0%, rgba(255,159,67,0.20), transparent 60%), radial-gradient(50rem 26rem at 90% 100%, rgba(46,155,245,0.16), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-[0.14em] text-brand-300 uppercase backdrop-blur">
            <span className="size-1.5 animate-[var(--animate-blink)] rounded-full bg-brand-400" />
            AI vehicle matcher
          </span>
          <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-white sm:text-[42px]">
            Describe the trip. We&apos;ll pick the car.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            No filters to fight with. Tell us who&apos;s travelling and what it&apos;s for, and the matcher ranks the
            live fleet against your actual constraints — and tells you what it traded off.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl" data-reveal data-reveal-delay="80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(brief);
            }}
            className="rounded-2xl border border-white/12 bg-white/8 p-2 backdrop-blur-xl"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Six of us, a week in Scotland, under £140 a day…"
                aria-label="Describe your trip"
                className="h-13 flex-1 rounded-xl bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/35"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-brand-400 px-7 text-sm font-semibold text-ink-950 transition-all hover:bg-brand-300 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                    Matching
                  </>
                ) : (
                  "Match my car"
                )}
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setBrief(example);
                  void submit(example);
                }}
                className="rounded-full border border-white/12 px-3.5 py-2 text-[13px] text-white/55 transition-colors hover:border-white/30 hover:text-white"
              >
                {example.length > 46 ? `${example.slice(0, 44)}…` : example}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-danger/15 px-4 py-3 text-center text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        {result && (
          <div className="mt-12">
            <div className="mx-auto mb-7 flex max-w-3xl flex-col items-center gap-2 text-center">
              <p className="text-[15px] text-white/80">{result.summary}</p>
              <p className="text-xs text-white/35">
                {result.engine.hosted ? `${result.engine.model}` : "Deterministic matcher"} · {result.latencyMs}ms
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {result.picks.map((pick) => (
                <article
                  key={pick.slug}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-2xl border bg-white/5 backdrop-blur-sm transition-all hover:-translate-y-1",
                    pick.rank === 1 ? "border-brand-400/50 bg-white/10" : "border-white/10",
                  )}
                >
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={pick.imageUrl}
                      alt={pick.name}
                      fill
                      sizes="(max-width: 768px) 90vw, 30vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent" />
                    <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
                      <div>
                        {pick.rank === 1 && (
                          <span className="mb-1.5 inline-block rounded-md bg-brand-400 px-2 py-0.5 text-[11px] font-bold text-ink-950">
                            Best match
                          </span>
                        )}
                        <h3 className="font-display text-[17px] font-semibold text-white">{pick.name}</h3>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                        {pick.fitScore}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <p className="text-[13px] font-semibold tracking-wide text-brand-300 uppercase">{pick.headline}</p>
                    <p className="text-sm leading-relaxed text-white/70">{pick.reason}</p>
                    {pick.tradeoff && <p className="text-[13px] text-white/40">{pick.tradeoff}</p>}
                    <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
                      <p className="font-display text-lg font-bold text-white">
                        {formatCurrency(pick.pricePerDay)}
                        <span className="text-[13px] font-medium text-white/40"> / day</span>
                      </p>
                      <Link
                        href={`/cars/${pick.slug}`}
                        className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-ink-900 transition-colors hover:bg-brand-400 hover:text-ink-950"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
