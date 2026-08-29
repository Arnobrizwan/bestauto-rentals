import { z } from "zod";
import { describeEngine, resolveProviderForRequest, type EngineInfo } from "@/ai/provider";
import { RECOMMENDER_SYSTEM_V2 } from "@/ai/prompts";
import { formatCurrency } from "@/lib/utils";
import { listVehicles, type VehicleWithStats } from "@/server/repositories/vehicles";
import { clampScore } from "@/ai/validation";

export type RecommendBrief = {
  /** Free-text description of the trip, e.g. "week in the Highlands with three kids" */
  brief?: string;
  passengers?: number;
  budgetPerDay?: number;
  days?: number;
  occasion?: "family" | "business" | "leisure" | "special" | "city" | "unknown";
  transmission?: "Automatic" | "Manual";
  fuel?: "Petrol" | "Octane" | "Hybrid" | "Diesel";
  luggage?: number;
  location?: string;
};

export type Recommendation = {
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
  bags: number;
  transmission: string;
  fuel: string;
  rating: number;
  segment: string;
};

export type RecommendResult = {
  picks: Recommendation[];
  summary: string;
  engine: EngineInfo;
  latencyMs: number;
  /** Present when the hosted model was tried and fell back. */
  degraded?: string;
};

/* ---------------------------------------------------------------------------
   Deterministic matcher.

   This is not a stub — it is the scoring model the product ships with, and it
   is what the eval harness grades when no vendor key is configured.
--------------------------------------------------------------------------- */

const OCCASION_KEYWORDS: Record<NonNullable<RecommendBrief["occasion"]>, string[]> = {
  family: ["family", "kids", "children", "child", "relatives", "luggage", "picnic", "school", "eid"],
  business: ["business", "work", "client", "meeting", "airport", "conference", "corporate", "office", "delegation"],
  leisure: ["tour", "trip", "cox's bazar", "coxs bazar", "sylhet", "bandarban", "sreemangal", "rangamati", "sajek", "weekend", "explore"],
  special: ["wedding", "bou", "gaye holud", "reception", "birthday", "anniversary", "photoshoot", "vip"],
  city: ["city", "dhaka", "traffic", "parking", "short trips", "errand", "commute", "office run"],
  unknown: [],
};

function inferOccasion(brief: string): NonNullable<RecommendBrief["occasion"]> {
  const text = brief.toLowerCase();
  let best: NonNullable<RecommendBrief["occasion"]> = "unknown";
  let bestHits = 0;
  for (const [occasion, words] of Object.entries(OCCASION_KEYWORDS)) {
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = occasion as NonNullable<RecommendBrief["occasion"]>;
    }
  }
  return best;
}

/** Extracts "৳6000", "6000 taka a day", "under 8000" style budgets from free text. */
function inferBudget(brief: string): number | undefined {
  const money = brief.match(/(?:৳|\btk\.?\s*|\bbdt\s*)(\d{3,6})/i);
  if (money) return Number(money[1]);
  const perDay = brief.match(/(\d{3,6})\s*(?:taka|tk|bdt)?\s*(?:a|per|\/)\s*day/i);
  if (perDay) return Number(perDay[1]);
  const under = brief.match(/(?:under|below|max(?:imum)?|up to|around|about)\s*(?:৳|tk\.?\s*)?\s*(\d{3,6})/i);
  if (under) return Number(under[1]);

  // No figure given, but "cheap" is still a budget statement. Treat it as a
  // soft cap so price actually influences the ranking. 5,000 taka a day is
  // roughly where the economy fleet tops out.
  if (/\b(cheap|cheapest|budget|affordable|economical|inexpensive|low cost)\b/i.test(brief)) return 5000;
  return undefined;
}

const PARTY_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

export function inferPassengers(brief: string): number | undefined {
  // "6 people", "4 adults", "seats 5"
  const explicit = brief.match(/(\d+)\s*(?:people|passengers|adults|of us|seats?|travellers|travelers)/i);
  if (explicit) return Number(explicit[1]);

  // "family of 6", "party of 4", "group of 5", "a car for 6"
  const collective = brief.match(/(?:family|party|group|team|couple)\s+of\s+(\d+)/i) ?? brief.match(/\bfor\s+(\d+)\s*(?!\s*(?:days?|nights?|weeks?|hours?))/i);
  if (collective) {
    const n = Number(collective[1]);
    if (n >= 1 && n <= 15) return n;
  }

  for (const [word, n] of Object.entries(PARTY_WORDS)) {
    if (new RegExp(`\\b${word}\\b\\s*(?:people|passengers|adults|of us)`, "i").test(brief)) return n;
    if (new RegExp(`(?:family|party|group)\\s+of\\s+${word}\\b`, "i").test(brief)) return n;
  }
  return undefined;
}

/** Pulls hard preferences the caller did not pass explicitly out of the brief. */
function inferPreferences(brief: string) {
  const text = brief.toLowerCase();
  const transmission: RecommendBrief["transmission"] = /\bautomatic\b|\bauto\b/.test(text)
    ? "Automatic"
    : /\bmanual\b|stick shift|gear/.test(text)
      ? "Manual"
      : undefined;

  const fuel: RecommendBrief["fuel"] = /\bhybrid\b/.test(text)
    ? "Hybrid"
    : /\bdiesel\b/.test(text)
      ? "Diesel"
      : /\boctane\b/.test(text)
        ? "Octane"
        : undefined;

  return { transmission, fuel };
}

const money = (n: number) => formatCurrency(n, { decimals: false });

type Scored = { vehicle: VehicleWithStats; score: number; positives: string[]; negatives: string[] };

function scoreVehicle(v: VehicleWithStats, brief: Required<Pick<RecommendBrief, "occasion">> & RecommendBrief): Scored {
  const price = Number(v.pricePerDay);
  let score = 40;
  const positives: string[] = [];
  const negatives: string[] = [];

  // Capacity is the hardest constraint — under-seating is disqualifying.
  if (brief.passengers) {
    if (v.seats >= brief.passengers) {
      score += 18;
      if (v.seats - brief.passengers <= 1) positives.push(`seats ${v.seats} without wasting space on empty chairs`);
      else positives.push(`seats ${v.seats}`);
    } else {
      // Scaled by the shortfall, not flat. When nothing in the fleet is big
      // enough, the hard filter falls back to the whole pool and this score is
      // all that orders it — and a flat penalty made an eleven-seater one seat
      // short rank identically to a five-seater seven short, so price and
      // rating broke the tie and "12 of us" was answered with three
      // five-seaters. The closest vehicle should lead when none of them fit.
      score -= 60 + (brief.passengers - v.seats) * 12;
      negatives.push(`only ${v.seats} seats`);
    }
  }

  if (brief.luggage) {
    if (v.bags >= brief.luggage) {
      score += 8;
      positives.push(`swallows ${v.bags} bags`);
    } else {
      score -= 18;
      negatives.push(`${v.bags}-bag boot is tight for ${brief.luggage}`);
    }
  }

  if (brief.budgetPerDay) {
    const ratio = price / brief.budgetPerDay;
    if (ratio <= 0.7) {
      score += 20;
      positives.push(`comes in at ${money(price)}/day, well under your ${money(brief.budgetPerDay)} budget`);
    } else if (ratio <= 1) {
      score += 24;
      positives.push(`lands at ${money(price)}/day, inside your ${money(brief.budgetPerDay)} budget`);
    } else if (ratio <= 1.15) {
      score -= 8;
      negatives.push(`${money(price)}/day is just over budget`);
    } else {
      // Scale with how far over: a flat penalty rated a ৳35,000 Land Cruiser
      // the same as a ৳6,500 Vezel against a ৳5,000 budget, which is plainly wrong.
      score -= 25 + Math.min(75, (ratio - 1.15) * 45);
      negatives.push(`${money(price)}/day is well over your ${money(brief.budgetPerDay)} budget`);
    }
  }

  if (brief.transmission) {
    if (v.transmission === brief.transmission) {
      score += 10;
      positives.push(brief.transmission === "Automatic" ? "is an automatic" : "has the manual box you asked for");
    } else {
      score -= 25;
      negatives.push(`${v.transmission.toLowerCase()} only`);
    }
  }

  if (brief.fuel) {
    if (v.fuel === brief.fuel) {
      score += 12;
      positives.push(`runs on ${v.fuel.toLowerCase()}, as asked`);
    } else score -= 12;
  }

  if (brief.location && v.location === brief.location) {
    score += 8;
    positives.push(`is already sitting at ${v.location}`);
  }

  // Occasion fit also produces the human-readable rationale, so a brief with no
  // budget or party size still gets a reason that references what was asked for
  // rather than falling back to generic praise.
  switch (brief.occasion) {
    case "family":
      if (v.seats >= 5) {
        score += 14;
        positives.push(`carries ${v.seats} without anyone drawing the short straw`);
      }
      if (v.bodyType === "SUV") {
        score += 10;
        positives.push("has an SUV boot that takes the holiday kit");
      }
      if (v.fuel === "Hybrid") {
        score += 6;
        positives.push("is a hybrid, so the long motorway legs cost less");
      }
      if (v.segment === "exclusive") score -= 30;
      if (v.doors >= 4) score += 6;
      break;
    case "business":
      if (v.transmission === "Automatic") {
        score += 10;
        positives.push("is an automatic, which matters in stop-start traffic");
      }
      if (v.bodyType === "Sedan") {
        score += 12;
        positives.push("is a saloon that reads right pulling up to a client");
      }
      if (v.segment === "exclusive") score -= 8;
      break;
    case "city":
      if (v.segment === "small") {
        score += 20;
        positives.push("has a footprint that fits the gaps other cars drive past");
      }
      if (price < 5000) {
        score += 10;
        positives.push(`costs ${money(price)}/day for runs that do not need more`);
      }
      if (v.co2 < 130) {
        score += 6;
        positives.push(`emits ${v.co2}g/km, so the clean-air zones are painless`);
      }
      if (v.bodyType === "SUV") score -= 10;
      break;
    case "special":
      if (v.segment === "exclusive") {
        score += 26;
        positives.push("is the kind of car the photographs end up being about");
      }
      if (v.rating >= 4.8) {
        score += 8;
        positives.push(`holds a ${v.rating} rating from people who booked it for the same reason`);
      }
      break;
    case "leisure":
      if (v.segment === "large") {
        score += 10;
        positives.push("has the clearance and the seats for an upcountry run");
      }
      if (v.bags >= 3) {
        score += 6;
        positives.push(`has ${v.bags} bags of boot`);
      }
      break;
    default:
      break;
  }

  // Social proof, lightly weighted so it only breaks ties.
  score += (v.rating - 4.5) * 12;
  score += Math.min(8, v.bookingCount / 12);

  return { vehicle: v, score, positives, negatives };
}

function headlineFor(s: Scored, occasion: RecommendBrief["occasion"], rank: number) {
  const v = s.vehicle;
  // The lead pick gets the occasion headline; the alternatives get something
  // specific to the car, so the three cards do not read identically.
  // Only use the occasion headline when the car actually earns the claim - a
  // mid-priced SUV should not be labelled "small, cheap, easy in traffic".
  if (rank === 0) {
    if (occasion === "family" && v.seats >= 5) return `Room for ${v.seats} and the bags`;
    if (occasion === "city" && v.segment === "small") return "Small, cheap, easy in traffic";
    if (occasion === "business" && v.transmission === "Automatic") return "Quiet, automatic, arrives well";
    if (occasion === "special" && v.segment === "exclusive") return "The one people photograph";
    if (occasion === "leisure" && v.bags >= 3) return "Built for the long way round";
  }
  if (v.segment === "exclusive") return `${v.bodyType}, ${v.seats} seats, chauffeur-driven`;
  if (Number(v.pricePerDay) < 4500) return "The value pick";
  if (v.fuel === "Hybrid") return `Hybrid ${v.bodyType}, ${v.seats} seats`;
  return `${v.transmission} ${v.bodyType}, ${v.seats} seats`;
}

function sentence(parts: string[]) {
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export type ResolvedBrief = RecommendBrief & { occasion: NonNullable<RecommendBrief["occasion"]> };

/**
 * The brief as understood: what the caller passed, plus what the free text says.
 *
 * The public matcher posts `{ brief: "six of us, a week in Sylhet" }` and
 * nothing else — every structured field is optional and the UI fills none of
 * them. So `brief.passengers` is *always* undefined in production, and any
 * filter written against it is a filter that never runs. Constraint resolution
 * happens once, here, and every caller filters against the result rather than
 * against the raw request.
 */
export function resolveBrief(brief: RecommendBrief): ResolvedBrief {
  const text = brief.brief ?? "";
  const inferred = inferPreferences(text);
  return {
    ...brief,
    occasion: brief.occasion && brief.occasion !== "unknown" ? brief.occasion : inferOccasion(text),
    budgetPerDay: brief.budgetPerDay ?? inferBudget(text),
    passengers: brief.passengers ?? inferPassengers(text),
    transmission: brief.transmission ?? inferred.transmission,
    fuel: brief.fuel ?? inferred.fuel,
  };
}

/**
 * The constraints that are not preferences.
 *
 * A car that cannot carry the party, or that has the wrong gearbox when one was
 * asked for, is not a worse recommendation — it is not a recommendation. One
 * definition, applied identically to the rules engine's candidate pool, to the
 * shortlist the model reasons over, and to what the model hands back: three
 * copies of this predicate had already drifted into two that read the raw brief
 * and one that read the resolved one.
 */
export function meetsHardConstraints(
  v: Pick<VehicleWithStats, "seats" | "transmission" | "fuel">,
  brief: RecommendBrief,
) {
  return (
    (!brief.passengers || v.seats >= brief.passengers) &&
    (!brief.transmission || v.transmission === brief.transmission) &&
    (!brief.fuel || v.fuel === brief.fuel)
  );
}

export async function rulesRecommend(brief: RecommendBrief, pool: VehicleWithStats[]) {
  const resolved = resolveBrief(brief);

  // Filter before ranking, and fall back to the unfiltered pool only if nothing
  // at all qualifies — better to answer with a caveat than to answer with
  // nothing.
  const feasible = pool.filter((v) => meetsHardConstraints(v, resolved));
  const nothingFits = feasible.length === 0;
  const candidates = nothingFits ? pool : feasible;

  const ranked = candidates
    .map((v) => scoreVehicle(v, resolved))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const picks: Recommendation[] = ranked.map((s, i) => {
    const v = s.vehicle;
    const why = sentence(s.positives.slice(0, 2));
    return {
      slug: v.slug,
      name: v.name,
      rank: i + 1,
      headline: headlineFor(s, resolved.occasion, i),
      reason: why
        ? `The ${v.name} ${why}.`
        : `The ${v.name} pairs ${v.seats} seats with a driver at ${money(Number(v.pricePerDay))}/day, and it is one of the highest-rated cars we run.`,
      tradeoff: s.negatives[0] ? `Worth knowing: ${s.negatives[0]}.` : "",
      fitScore: Math.max(1, Math.min(100, Math.round(s.score))),
      pricePerDay: Number(v.pricePerDay),
      imageUrl: v.imageUrl,
      seats: v.seats,
      bags: v.bags,
      transmission: v.transmission,
      fuel: v.fuel,
      rating: v.rating,
      segment: v.segment,
    };
  });

  const constraints: string[] = [];
  if (resolved.passengers) constraints.push(`${resolved.passengers} people`);
  if (resolved.budgetPerDay) constraints.push(`about ${money(resolved.budgetPerDay)} a day`);
  if (resolved.occasion !== "unknown") constraints.push(`a ${resolved.occasion} trip`);

  // Do not claim a match that was not made. When the pool fell back, every pick
  // breaks at least one stated constraint, and saying "Matched on 12 people"
  // over three five-seaters is the answer contradicting itself.
  const overCapacity =
    resolved.passengers !== undefined && !pool.some((v) => v.seats >= resolved.passengers!);

  const summary = nothingFits
    ? overCapacity
      ? `Nothing we run seats ${resolved.passengers} on its own — the ${picks[0]?.name ?? "largest vehicle"} is the closest, and two cars would cover the party.`
      : `Nothing matches every constraint at once — these come closest, with the compromise noted on each.`
    : constraints.length
      ? `Matched on ${sentence(constraints)} — ${picks[0]?.name ?? "no vehicle"} is the closest fit.`
      : `Our three strongest all-round options right now, led by the ${picks[0]?.name ?? "fleet"}.`;

  return { picks, summary, resolved };
}

/* --------------------------------------------------------------- the agent */

/** What the recommender is allowed to return. */
const recommenderResponseSchema = z.object({
  picks: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        rank: z.union([z.number(), z.string()]).optional(),
        headline: z.string().max(120).optional().default(""),
        reason: z.string().max(400).optional().default(""),
        tradeoff: z.string().max(300).optional().default(""),
        fitScore: z.union([z.number(), z.string()]).optional(),
      }),
    )
    .min(1),
  summary: z.string().max(600).optional().default(""),
});

export async function recommendVehicles(brief: RecommendBrief): Promise<RecommendResult> {
  const started = Date.now();
  const { items: pool } = await listVehicles({ limit: 40 });
  // `resolved` is the brief as understood — party size, gearbox and fuel read
  // out of the free text. Everything below filters against it rather than
  // against `brief`, whose structured fields the public matcher never sets.
  const { picks: baselinePicks, summary: baselineSummary, resolved } = await rulesRecommend(brief, pool);
  const provider = await resolveProviderForRequest();

  if (!provider) {
    return {
      picks: baselinePicks,
      summary: baselineSummary,
      engine: describeEngine(null),
      latencyMs: Date.now() - started,
    };
  }

  // With a hosted model available, the rules engine still runs first: it
  // shortlists candidates so the model reasons over real rows, and it is the
  // safety net if the call fails or returns something unusable.
  const feasiblePool = pool.filter((v) => meetsHardConstraints(v, resolved));
  const candidates = (feasiblePool.length ? feasiblePool : pool).slice(0, 12).map((v) => ({
    slug: v.slug,
    name: v.name,
    segment: v.segment,
    bodyType: v.bodyType,
    seats: v.seats,
    bags: v.bags,
    transmission: v.transmission,
    fuel: v.fuel,
    pricePerDay: Number(v.pricePerDay),
    rating: v.rating,
    location: v.location,
    features: v.features.slice(0, 4),
  }));

  try {
    const res = await provider.complete({
      system: RECOMMENDER_SYSTEM_V2,
      json: true,
      maxTokens: 900,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          // The resolved brief, not the raw one: the model is told "6 passengers,
          // Manual" rather than being left to re-derive it from the sentence
          // and quietly disagree with the filter applied to its answer.
          content: `Customer brief: ${JSON.stringify(resolved)}\n\nCandidates:\n${JSON.stringify(candidates, null, 1)}`,
        },
      ],
    });

    const parsed = recommenderResponseSchema.safeParse(JSON.parse(stripFences(res.text)));
    if (!parsed.success) {
      throw new Error(`Model response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }

    // A pick naming a vehicle that was never offered is discarded below, so
    // the model cannot invent a car that is not in the fleet.
    const bySlug = new Map(pool.map((v) => [v.slug, v]));
    const picks: Recommendation[] = parsed.data.picks
      .filter((p) => {
        const v = bySlug.get(p.slug);
        if (!v) return false;
        // Hold the model to the same hard constraints as the rules engine —
        // the same function, so the two cannot disagree.
        return meetsHardConstraints(v, resolved);
      })
      .slice(0, 3)
      .map((p, i) => {
        const v = bySlug.get(p.slug)!;
        return {
          slug: v.slug,
          name: v.name,
          rank: i + 1,
          headline: p.headline?.slice(0, 60) ?? "",
          reason: p.reason ?? "",
          tradeoff: p.tradeoff ?? "",
          // Clamped rather than trusted: a model that returns 9.7, "80" or
          // nothing at all still produces an integer the bar chart can draw.
          fitScore: clampScore(p.fitScore, 0, 100) ?? 60,
          pricePerDay: Number(v.pricePerDay),
          imageUrl: v.imageUrl,
          seats: v.seats,
          bags: v.bags,
          transmission: v.transmission,
          fuel: v.fuel,
          rating: v.rating,
          segment: v.segment,
        };
      });

    if (!picks.length) throw new Error("Model returned no usable slugs");

    return {
      picks,
      summary: parsed.data.summary || baselineSummary,
      engine: describeEngine(provider),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      picks: baselinePicks,
      summary: baselineSummary,
      engine: describeEngine(null),
      latencyMs: Date.now() - started,
      degraded: err instanceof Error ? err.message : "Model call failed; served rules engine.",
    };
  }
}

export function stripFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}
