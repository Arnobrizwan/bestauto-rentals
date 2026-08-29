import { z } from "zod";
import { describeEngine, resolveProviderForRequest, type EngineInfo } from "@/ai/provider";
import { LEAD_QUALIFIER_SYSTEM_V2 } from "@/ai/prompts";

import { formatCurrency } from "@/lib/utils";

import { stripFences } from "./recommender";
import { clampScore } from "@/ai/validation";

export type LeadInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  intent?: string;
  budgetPerDay?: number | null;
  timeframe?: string;
  partySize?: number | null;
  source?: string;
};

export type LeadSignal = { label: string; impact: number; detail: string };

export type LeadScore = {
  score: number;
  tier: "hot" | "warm" | "cold";
  summary: string;
  signals: LeadSignal[];
  nextAction: string;
  engine: EngineInfo;
  latencyMs: number;
  degraded?: string;
};

const tierOf = (score: number): LeadScore["tier"] => (score >= 70 ? "hot" : score >= 40 ? "warm" : "cold");

/* ---------------------------------------------------------------------------
   Rules engine — an explainable additive model.
   Each signal carries its own contribution so the admin UI can show the maths.
--------------------------------------------------------------------------- */

const DATE_PATTERNS = [
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
  // Deliberately excludes "next month": that is a timeframe, already scored
  // separately, and treating it as a firm date over-rated soft enquiries.
  /\b(?:next|this)\s+(?:week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\btomorrow\b/i,
];

const URGENCY: Record<string, number> = {
  today: 22,
  this_week: 20,
  this_month: 12,
  next_month: 6,
  this_quarter: 4,
  unknown: 0,
};

const INTENT: Record<string, number> = {
  book: 20,
  corporate: 18,
  enquiry: 6,
  browse: -12,
};

export function rulesQualify(lead: LeadInput): Omit<LeadScore, "engine" | "latencyMs"> {
  const message = lead.message ?? "";
  const text = message.toLowerCase();
  const signals: LeadSignal[] = [];
  let score = 30;

  const add = (label: string, impact: number, detail: string) => {
    score += impact;
    signals.push({ label, impact, detail });
  };

  // 1. Explicit dates are the single strongest predictor of a booking.
  const hasDate = DATE_PATTERNS.some((p) => p.test(message));
  if (hasDate) add("Specific dates", 24, "Names an actual date or a concrete window rather than 'sometime'.");

  // 2. Stated urgency.
  const urgency = URGENCY[lead.timeframe ?? "unknown"] ?? 0;
  if (urgency > 0) {
    add("Near-term timeframe", urgency, `Wants a vehicle ${(lead.timeframe ?? "").replace(/_/g, " ")}.`);
  } else if (!hasDate) {
    add("No timeframe", -14, "No date or window given, so there is nothing to hold.");
  }

  // 3. Intent classification.
  const intent = lead.intent ?? "enquiry";
  const intentScore = INTENT[intent] ?? 0;
  add(
    intent === "browse" ? "Browsing only" : `Intent: ${intent}`,
    intentScore,
    intent === "corporate"
      ? "Business enquiry — higher value and longer contract potential."
      : intent === "book"
        ? "Language indicates readiness to book, not research."
        : intent === "browse"
          ? "Exploratory language with no commitment markers."
          : "General enquiry about the service.",
  );

  // 4. Budget.
  if (lead.budgetPerDay && lead.budgetPerDay > 0) {
    const stated = formatCurrency(lead.budgetPerDay, { decimals: false });
    if (lead.budgetPerDay >= 15000) add("Premium budget", 18, `States ${stated}/day — exclusive fleet territory.`);
    else if (lead.budgetPerDay >= 6000) add("Solid budget", 12, `States ${stated}/day, comfortably above fleet average.`);
    else add("Budget stated", 7, `States ${stated}/day — a real number to quote against.`);
  } else {
    add("No budget given", -6, "Nothing to anchor a quote to.");
  }

  // 5. Volume / party size.
  const multi = /\b(\d+)\s*(?:cars|vehicles|units)\b/i.exec(message);
  if (multi && Number(multi[1]) > 1) {
    add("Multi-vehicle", 16, `Asks for ${multi[1]} vehicles — one conversation, several rentals.`);
  } else if ((lead.partySize ?? 0) >= 6) {
    add("Large party", 8, `${lead.partySize} passengers pushes them into the large fleet.`);
  }

  // 6. Contactability.
  if (lead.phone && lead.phone.replace(/\D/g, "").length >= 9) {
    add("Phone provided", 10, "Reachable directly, not just by email.");
  }
  if (lead.company) add("Company named", 8, `${lead.company} — invoiceable business account.`);

  // 7. Named a specific vehicle.
  const namedVehicle =
    /\b(corolla|axio|premio|allion|swift|vezel|x-?trail|hiace|noah|microbus|pajero|prado|land\s?cruiser|e-?class|c-?class|mercedes)\b/i.test(
      message,
    );
  if (namedVehicle) add("Named a vehicle", 12, "Already knows which car they want — shorter sales cycle.");

  // 8. Message effort as a weak proxy for seriousness.
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 30) add("Detailed brief", 6, `${words} words of context to work from.`);
  else if (words < 8) add("Very short message", -8, "Almost no detail to qualify against.");

  // 9. Negative markers.
  if (/\b(just looking|browsing|curious|no rush|maybe|someday|one day)\b/i.test(text)) {
    add("Low-commitment language", -12, "Phrasing signals research, not purchase.");
  }
  if (/\b(student discount|free|cheapest possible|any car will do)\b/i.test(text)) {
    add("Price-only motivation", -8, "Driven by price alone; low margin and high churn risk.");
  }

  // 10. Channel quality.
  if (lead.source === "ai-concierge") {
    add("Engaged with concierge", 6, "Already had a qualifying conversation before converting.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const tier = tierOf(finalScore);

  const top = [...signals].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];
  const summary =
    tier === "hot"
      ? `${lead.name} is ready to transact — ${top?.detail.toLowerCase() ?? "strong intent signals throughout"}`
      : tier === "warm"
        ? `${lead.name} has real interest but a gap to close: ${
            signals.find((s) => s.impact < 0)?.detail.toLowerCase() ?? "needs firmer dates"
          }`
        : `${lead.name} is early-stage — ${
            signals.find((s) => s.impact < 0)?.detail.toLowerCase() ?? "no dates, budget or vehicle named"
          }`;

  const nextAction =
    tier === "hot"
      ? lead.phone
        ? `Call ${lead.phone} within the hour and hold a vehicle.`
        : `WhatsApp a held quote today and ask for a number.`
      : tier === "warm"
        ? `Send two matched options with prices and ask which dates they have in mind.`
        : `Add to the nurture sequence; no direct outreach yet.`;

  return { score: finalScore, tier, summary, signals, nextAction };
}

/* --------------------------------------------------------------- the agent */

/**
 * What the qualifier is allowed to return.
 *
 * `tier` is accepted but ignored — it is recomputed from the score — so a
 * model that contradicts itself cannot produce a hot lead scoring 12.
 */
const qualifierResponseSchema = z.object({
  score: z.union([z.number(), z.string()]),
  tier: z.string().optional(),
  summary: z.string().max(600).optional().default(""),
  signals: z
    .array(z.object({ label: z.string().max(80), impact: z.number(), detail: z.string().max(200) }))
    .optional(),
  nextAction: z.string().max(240).optional().default(""),
});

export async function qualifyLead(lead: LeadInput): Promise<LeadScore> {
  const started = Date.now();
  const baseline = rulesQualify(lead);
  const provider = await resolveProviderForRequest();

  if (!provider) {
    return { ...baseline, engine: describeEngine(null), latencyMs: Date.now() - started };
  }

  try {
    const res = await provider.complete({
      system: LEAD_QUALIFIER_SYSTEM_V2,
      json: true,
      maxTokens: 700,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `Lead:\n${JSON.stringify(
            {
              name: lead.name,
              email: lead.email,
              phone: lead.phone ? "provided" : "none",
              company: lead.company || "none",
              message: lead.message,
              intent: lead.intent,
              budgetPerDay: lead.budgetPerDay,
              timeframe: lead.timeframe,
              partySize: lead.partySize,
              source: lead.source,
            },
            null,
            1,
          )}\n\nA rules-based scorer independently rated this ${baseline.score}/100. Use it as a prior; disagree only if the message justifies it.`,
        },
      ],
    });

    const parsed = qualifierResponseSchema.safeParse(JSON.parse(stripFences(res.text)));
    if (!parsed.success) {
      throw new Error(`Model response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }

    // The tier is never taken from the model. It is derived from the clamped
    // score by the same function the rules engine uses, so the two can never
    // disagree with each other or with the bands documented in the prompt.
    const score = clampScore(parsed.data.score) ?? baseline.score;
    return {
      score,
      tier: tierOf(score),
      summary: parsed.data.summary || baseline.summary,
      signals: (parsed.data.signals?.length ? parsed.data.signals : baseline.signals).slice(0, 8),
      nextAction: parsed.data.nextAction || baseline.nextAction,
      engine: describeEngine(provider),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ...baseline,
      engine: describeEngine(null),
      latencyMs: Date.now() - started,
      degraded: err instanceof Error ? err.message : "Model call failed; served rules engine.",
    };
  }
}
