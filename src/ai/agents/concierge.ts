import { describeEngine, resolveProviderForRequest, type AiMessage, type ContentBlock, type EngineInfo } from "@/ai/provider";
import { CONCIERGE_SYSTEM_V3 } from "@/ai/prompts";
import { EXTRA_PRICES, TOOL_SPECS, durationDiscount, executeTool, type ToolContext } from "@/ai/tools";
import { searchKnowledge } from "@/ai/tools/knowledge";
import { formatCurrency } from "@/lib/utils";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ConciergeVehicleCard = {
  slug: string;
  name: string;
  pricePerDay: number;
  seats: number;
  transmission: string;
  fuel: string;
  rating: number;
  segment: string;
  bodyType: string;
};

export type ConciergeReply = {
  message: string;
  vehicles: ConciergeVehicleCard[];
  suggestions: string[];
  toolCalls: { name: string; input: unknown; output: unknown }[];
  engine: EngineInfo;
  latencyMs: number;
  handoff: boolean;
  leadCaptured?: { id: string; tier: string; score: number };
  degraded?: string;
};

const MAX_TOOL_ITERATIONS = 4;

/* ===========================================================================
   Slot extraction — shared by both engines so the UI behaves identically.
   =========================================================================== */

/**
 * The most seats anything in the small segment offers. Party size is checked
 * against it so an adjective can never filter a large group down to a fleet
 * that cannot carry them.
 */
const SMALL_SEGMENT_MAX_SEATS = 5;

export type Slots = {
  passengers?: number;
  budgetPerDay?: number;
  days?: number;
  pickupDate?: string;
  dropoffDate?: string;
  location?: string;
  transmission?: "Automatic" | "Manual";
  fuel?: "Petrol" | "Octane" | "Hybrid" | "Diesel";
  segment?: "small" | "large" | "exclusive";
  name?: string;
  email?: string;
  phone?: string;
  vehicleSlug?: string;
};

const LOCATIONS = [
  "Dhaka Gulshan",
  "Dhaka Banani",
  "Dhaka Uttara",
  "Dhaka Dhanmondi",
  "Dhaka Motijheel",
  "Hazrat Shahjalal Airport",
  "Chattogram Agrabad",
  "Sylhet City",
  "Khulna City",
  "Rajshahi City",
  "Cox's Bazar",
];

/** Ordered longest-first at lookup time so "corolla axio" beats "corolla". */
const VEHICLE_ALIASES: Record<string, string> = {
  swift: "suzuki-swift",
  suzuki: "suzuki-swift",
  "corolla axio": "toyota-corolla-axio-hybrid",
  axio: "toyota-corolla-axio-hybrid",
  corolla: "toyota-corolla",
  premio: "toyota-premio",
  allion: "toyota-premio",
  vezel: "honda-vezel",
  honda: "honda-vezel",
  "x-trail": "nissan-x-trail",
  xtrail: "nissan-x-trail",
  nissan: "nissan-x-trail",
  hiace: "toyota-hiace-microbus",
  microbus: "toyota-hiace-microbus",
  noah: "toyota-hiace-microbus",
  pajero: "mitsubishi-pajero-sport",
  mitsubishi: "mitsubishi-pajero-sport",
  "c-class": "mercedes-benz-c-class",
  "c class": "mercedes-benz-c-class",
  prado: "toyota-land-cruiser-prado",
  "e-class": "mercedes-benz-e-class",
  "e class": "mercedes-benz-e-class",
  mercedes: "mercedes-benz-e-class",
  "land cruiser": "toyota-land-cruiser-v8",
  "v8": "toyota-land-cruiser-v8",
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15,
};

export function extractSlots(turns: ChatTurn[], previous: Slots = {}): Slots {
  const slots: Slots = { ...previous };
  const userText = turns
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join("\n");
  const text = userText.toLowerCase();

  const passengers =
    /(\d+)\s*(?:people|passengers|adults|seats?|of us|travellers|travelers)/i.exec(userText)?.[1] ??
    /(?:family|party|group|team)\s+of\s+(\d+)/i.exec(userText)?.[1] ??
    Object.keys(NUMBER_WORDS).find((w) =>
      new RegExp(`\\b${w}\\b\\s*(?:people|passengers|adults|of us)`, "i").test(userText),
    );
  if (passengers) slots.passengers = typeof passengers === "string" && NUMBER_WORDS[passengers] ? NUMBER_WORDS[passengers] : Number(passengers);
  // Only fall back to a nominal family size if no count was stated anywhere.
  if (/\bfamily\b/.test(text) && !slots.passengers) slots.passengers = 5;

  const budget =
    /(?:৳|\btk\.?\s*|\bbdt\s*)(\d{3,6})/i.exec(userText)?.[1] ??
    /(\d{3,6})\s*(?:taka|tk|bdt)?\s*(?:a|per|\/)\s*day/i.exec(userText)?.[1] ??
    /(?:under|below|max(?:imum)?|up to|around|about)\s*(?:৳|tk\.?\s*)?\s*(\d{3,6})/i.exec(userText)?.[1];
  if (budget) slots.budgetPerDay = Number(budget);

  const days = /(\d+)\s*(?:days?|nights?)/i.exec(userText)?.[1];
  if (days) slots.days = Math.min(90, Number(days));
  if (/\b(?:a |one )?week\b/i.test(userText) && !slots.days) slots.days = 7;
  if (/\bweekend\b/i.test(userText) && !slots.days) slots.days = 3;
  if (/\bfortnight|two weeks\b/i.test(userText)) slots.days = 14;

  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(userText)?.[1];
  if (iso) slots.pickupDate = iso;

  // A city can be where they are collecting from or where they are going. Only
  // the former is a branch: "going to Cox's Bazar" is a destination, and
  // filtering the fleet to the Cox's Bazar branch would wrongly return nothing.
  const isDestination = (name: string) =>
    new RegExp(`\\b(?:to|towards|visit|visiting|trip to|going to|travel to)\\s+(?:the\\s+)?${name}`, "i").test(userText);

  const location = LOCATIONS.find((l) => text.includes(l.toLowerCase()) && !isDestination(l));
  if (location) slots.location = location;
  else {
    const city = ["dhaka", "chattogram", "chittagong", "sylhet", "khulna", "rajshahi", "cox"].find(
      (c) => text.includes(c) && !isDestination(c),
    );
    if (city) {
      const normalised = city === "chittagong" ? "chattogram" : city;
      slots.location = LOCATIONS.find((l) => l.toLowerCase().includes(normalised));
    }
    if (/\bairport|shahjalal\b/.test(text)) slots.location = "Hazrat Shahjalal Airport";
  }

  if (/\bautomatic\b/.test(text)) slots.transmission = "Automatic";
  else if (/\bmanual|stick shift\b/.test(text)) slots.transmission = "Manual";

  if (/\bhybrid\b/.test(text)) slots.fuel = "Hybrid";
  else if (/\bdiesel\b/.test(text)) slots.fuel = "Diesel";
  else if (/\boctane\b/.test(text)) slots.fuel = "Octane";

  // "cheap" and "budget" are price signals, not size ones. Treating them as a
  // request for the small fleet meant "six of us, budget 9,000 taka" filtered
  // down to five-seat cars and returned nothing at all.
  if (/\b(small|compact|city car|economical|sedan|private car)\b/.test(text)) slots.segment = "small";
  if (/\b(suv|microbus|micro bus|hiace|noah|7 seater|seven seater|big car|large|van)\b/.test(text)) slots.segment = "large";
  if (/\b(luxury|exclusive|wedding|prestige|vip|premium|chauffeur)\b/.test(text)) slots.segment = "exclusive";

  // Party size is a hard constraint; a segment inferred from an adjective is
  // not. Nothing in the small fleet seats more than five, so a stated party
  // larger than that always wins over the guess.
  if (slots.passengers && slots.passengers > SMALL_SEGMENT_MAX_SEATS && slots.segment === "small") {
    delete slots.segment;
  }

  for (const alias of Object.keys(VEHICLE_ALIASES).sort((a, b) => b.length - a.length)) {
    if (text.includes(alias)) {
      slots.vehicleSlug = VEHICLE_ALIASES[alias];
      break;
    }
  }

  const email = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.exec(userText)?.[0];
  if (email) slots.email = email;

  const phone = /(\+?\d[\d\s().-]{8,}\d)/.exec(userText)?.[0];
  if (phone) slots.phone = phone.trim();

  const named =
    /\b(?:i'?m|i am|my name is|this is|it'?s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z']+)?)/.exec(userText)?.[1] ??
    /\bname:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z']+)?)/.exec(userText)?.[1];
  if (named) slots.name = named.trim();

  return slots;
}

/* ===========================================================================
   Intent classification for the rules engine.
   =========================================================================== */

export type Intent =
  | "greeting"
  | "search"
  | "quote"
  | "availability"
  | "policy"
  | "handoff"
  | "contact"
  | "thanks"
  | "out_of_scope"
  | "unknown";

const POLICY_HINT =
  /\b(insurance|excess|deposit|advance|licence|license|brta|nid|document|documents|paperwork|age|fuel|petrol|octane|diesel|cng|mileage|kilometre|kilometer|km|cancel|cancellation|refund|deliver|delivery|collect|collection|child seat|payment|bkash|nagad|rocket|invoice|vat|challan|overtime|monsoon|flood|waterlogged|decoration|chauffeur)\b|self[\s-]?drive|driver included|is the driver|driver charge|how old|old enough|minimum age|years old/i;

/** Vehicle names, used to tell a priced enquiry apart from a policy question. */
const NAMES_VEHICLE =
  /\b(corolla|axio|premio|allion|swift|vezel|x-?trail|hiace|microbus|noah|pajero|prado|land\s?cruiser|e-?class|c-?class|mercedes)\b/i;

export function classifyIntent(message: string, slots: Slots): Intent {
  const text = message.toLowerCase().trim();

  if (/^(hi|hey|hello|good (morning|afternoon|evening)|yo)\b/.test(text) && text.length < 40) return "greeting";
  if (/\b(thanks|thank you|cheers|great, ta|perfect)\b/.test(text) && text.length < 40) return "thanks";
  if (/\b(human|agent|person|someone|call me|speak to|sales team|representative)\b/.test(text)) return "handoff";

  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(message)) return "contact";
  if (/\b(book it|reserve|i'?ll take|go ahead|sign me up|yes please book)\b/.test(text)) return "contact";

  // Policy is checked before pricing: "how much deposit do you take" and "is
  // the driver included in the price" are policy questions that happen to
  // contain pricing words. A named vehicle with a duration is a real quote
  // request, so that still wins.
  const hasDuration = /\b\d+\s*(?:days?|nights?|weeks?)\b/.test(text);
  if (POLICY_HINT.test(text) && !(NAMES_VEHICLE.test(text) && hasDuration)) return "policy";

  if (/\b(how much|price|cost|quote|total|rate|per day|charge|taka|tk|৳|\bfee\b)\b/.test(text)) return "quote";
  if (/\b(available|availability|free on|in stock|can i get|do you have.*(on|for)\s)\b/.test(text)) return "availability";

  if (
    /\b(car|vehicle|suv|hatchback|sedan|coupe|convertible|seater|drive|rent|hire|need|looking for|recommend|suggest|show me|options)\b/.test(
      text,
    )
  ) {
    return "search";
  }

  if (slots.passengers || slots.budgetPerDay || slots.segment) return "search";

  // Anything with no rental vocabulary at all.
  if (text.length > 12 && !/\b(car|rent|hire|drive|book|price|day)\b/.test(text)) return "out_of_scope";

  return "unknown";
}

/* ===========================================================================
   Rules engine
   =========================================================================== */

const money = (n: number) => formatCurrency(n, { decimals: false });

function listCars(cars: ConciergeVehicleCard[]) {
  return cars
    .map((c) => `the ${c.name} at ${money(c.pricePerDay)} a day`)
    .join(cars.length === 2 ? " or " : ", ");
}

async function search(slots: Slots, limit = 3) {
  const result = await executeTool("search_vehicles", {
    segment: slots.segment,
    seatsMin: slots.passengers,
    priceMax: slots.budgetPerDay ? Math.round(slots.budgetPerDay * 1.15) : undefined,
    transmission: slots.transmission,
    fuel: slots.fuel,
    location: slots.location,
    limit,
  });
  if (!result.ok) return { cards: [] as ConciergeVehicleCard[], raw: result };
  const cards = (result.data as ConciergeVehicleCard[]).map((v) => ({
    slug: v.slug,
    name: v.name,
    pricePerDay: v.pricePerDay,
    seats: v.seats,
    transmission: v.transmission,
    fuel: v.fuel,
    rating: v.rating,
    segment: v.segment,
    bodyType: v.bodyType,
  }));
  return { cards, raw: result };
}

function nextQuestion(slots: Slots): string | null {
  if (!slots.passengers) return "How many people are travelling?";
  if (!slots.budgetPerDay) return "Roughly what would you like to keep it under per day?";
  if (!slots.days && !slots.pickupDate) return "How many days do you need it for?";
  if (!slots.location) return "Which branch is easiest for you to collect from?";
  return null;
}

function suggestionsFor(slots: Slots, cards: ConciergeVehicleCard[]): string[] {
  const out: string[] = [];
  if (cards[0]) out.push(`How much for the ${cards[0].name.split(" ").slice(0, 2).join(" ")} for a week?`);
  if (!slots.passengers) out.push("I need something for 5 people");
  if (!slots.budgetPerDay) out.push("Keep it under 5000 taka a day");
  out.push("Is the driver included?");
  out.push("Do you do airport pickup?");
  return [...new Set(out)].slice(0, 4);
}

export async function rulesConcierge(
  turns: ChatTurn[],
  ctx: ToolContext,
): Promise<Omit<ConciergeReply, "engine" | "latencyMs">> {
  const slots = extractSlots(turns);
  const last = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  const intent = classifyIntent(last, slots);
  const toolCalls: ConciergeReply["toolCalls"] = [];
  const record = (name: string, input: unknown, output: unknown) => toolCalls.push({ name, input, output });

  switch (intent) {
    case "greeting": {
      return {
        message:
          "Hello — I look after bookings at Best Auto. Tell me roughly what you need: how many people, when, and what you'd like to spend a day, and I'll pull up the right cars.",
        vehicles: [],
        suggestions: [
          "Something cheap for driving around Dhaka",
          "A microbus for a family trip to Cox's Bazar",
          "A wedding car with a chauffeur",
        ],
        toolCalls,
        handoff: false,
      };
    }

    case "thanks": {
      return {
        message: "Happy to help. If you'd like me to hold anything or send a quote over, just say the word.",
        vehicles: [],
        suggestions: ["Send me a quote", "What's your cancellation policy?"],
        toolCalls,
        handoff: false,
      };
    }

    case "handoff": {
      return {
        message:
          "Of course. Leave me a name and an email and I'll put you straight through to the team — they usually come back within the hour during working days.",
        vehicles: [],
        suggestions: ["My name is Tanvir, tanvir@example.com"],
        toolCalls,
        handoff: true,
      };
    }

    case "out_of_scope": {
      return {
        message:
          "That one's outside what I can help with — I only handle car rental here. If it's about a booking, a vehicle or our policies, I'm all yours.",
        vehicles: [],
        suggestions: ["What cars do you have?", "What's the deposit?"],
        toolCalls,
        handoff: false,
      };
    }

    case "policy": {
      const result = await executeTool("get_policy", { question: last });
      record("get_policy", { question: last }, result);
      const entries = result.ok ? (result.data as { found: boolean; entries?: { title: string; body: string }[] }) : null;

      if (!entries?.found || !entries.entries?.length) {
        return {
          message:
            "I don't have a documented answer for that one, so I'd rather not guess. Leave me your name and email and someone from the team will confirm it properly.",
          vehicles: [],
          suggestions: ["Is the driver included?", "What deposit do you take?"],
          toolCalls,
          handoff: true,
        };
      }

      const primary = entries.entries[0];
      const follow = nextQuestion(slots);
      return {
        message: `${primary.body}${follow ? `\n\nAnything else you want to check, or shall I start pulling up cars? ${follow}` : ""}`,
        vehicles: [],
        suggestions: ["Show me what's available", "What's the deposit?", "Do you do airport pickup?"],
        toolCalls,
        handoff: false,
      };
    }

    case "availability": {
      const slug = slots.vehicleSlug;
      if (!slug) {
        const { cards, raw } = await search(slots);
        record("search_vehicles", slots, raw);
        return {
          message: cards.length
            ? `Right now I've got ${listCars(cards)}. Which one shall I check dates for?`
            : "Nothing in the fleet matches that combination at the moment. Widening the budget or the branch usually opens things up — which would you rather flex?",
          vehicles: cards,
          suggestions: suggestionsFor(slots, cards),
          toolCalls,
          handoff: false,
        };
      }

      const pickup = slots.pickupDate ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const days = slots.days ?? 3;
      const dropoff = new Date(new Date(pickup).getTime() + days * 86_400_000).toISOString().slice(0, 10);
      const result = await executeTool("check_availability", { slug, pickupDate: pickup, dropoffDate: dropoff });
      record("check_availability", { slug, pickupDate: pickup, dropoffDate: dropoff }, result);

      if (!result.ok) {
        return {
          message: "I couldn't check that one — could you confirm the car and the dates you have in mind?",
          vehicles: [],
          suggestions: suggestionsFor(slots, []),
          toolCalls,
          handoff: false,
        };
      }

      const data = result.data as { name: string; available: boolean; unitsFree: number; days: number; estimatedTotal: number };
      return {
        message: data.available
          ? `Yes — ${data.unitsFree} ${data.unitsFree === 1 ? "unit" : "units"} of the ${data.name} ${
              data.unitsFree === 1 ? "is" : "are"
            } free from ${pickup} for ${data.days} days, about ${money(data.estimatedTotal)} all in. Want me to hold it?`
          : `The ${data.name} is fully committed across those dates. I can either shift the dates by a few days or put you in something similar — which suits you better?`,
        vehicles: [],
        suggestions: ["Hold it for me", "Show me something similar", "What if I move the dates?"],
        toolCalls,
        handoff: false,
      };
    }

    case "quote": {
      const days = slots.days ?? 3;
      let slug = slots.vehicleSlug;
      let cards: ConciergeVehicleCard[] = [];

      if (!slug) {
        const found = await search(slots, 3);
        record("search_vehicles", slots, found.raw);
        cards = found.cards;

        // Branch, budget and segment are all softer than party size — drop
        // them before telling someone we have nothing. Leaving the segment in
        // meant the recovery path inherited the very guess that caused the
        // empty result, so it could never actually recover.
        if (!cards.length) {
          const relaxed = await search(
            { ...slots, location: undefined, budgetPerDay: undefined, segment: undefined },
            3,
          );
          record("search_vehicles", { relaxed: true }, relaxed.raw);
          cards = relaxed.cards;
        }
        slug = cards[0]?.slug;
      }

      if (!slug) {
        // Quote the cheapest car that actually seats the party rather than a
        // hard-coded figure — the fixed "8000 taka" suggestion told anyone who
        // had already offered more to *raise* their budget to less than that.
        const affordable = await search({ passengers: slots.passengers }, 8);
        const cheapest = affordable.cards.reduce<ConciergeVehicleCard | undefined>(
          (min, car) => (!min || car.pricePerDay < min.pricePerDay ? car : min),
          undefined,
        );

        const stretch =
          cheapest && (!slots.budgetPerDay || cheapest.pricePerDay > slots.budgetPerDay)
            ? `Stretch to ${formatCurrency(cheapest.pricePerDay)} for the ${cheapest.name}`
            : null;

        return {
          message: cheapest
            ? `Nothing matches that brief right now. The closest I have is the ${cheapest.name} at ${formatCurrency(cheapest.pricePerDay)} a day — shall I price that up, or would a different branch help?`
            : "Nothing matches that brief right now. Tell me the party size and a rough daily budget and I'll try again.",
          vehicles: cheapest ? [cheapest] : [],
          suggestions: [stretch, "Try a different branch", "Is the driver included?"].filter(
            (x): x is string => Boolean(x),
          ),
          toolCalls,
          handoff: false,
        };
      }

      const result = await executeTool("quote_price", { slug, days });
      record("quote_price", { slug, days }, result);
      if (!result.ok) {
        return {
          message: "I couldn't price that up — which car and how many days did you have in mind?",
          vehicles: cards,
          suggestions: suggestionsFor(slots, cards),
          toolCalls,
          handoff: false,
        };
      }

      const q = result.data as {
        vehicle: string;
        pricePerDay: number;
        days: number;
        base: number;
        discount: number;
        discountRate: number;
        total: number;
      };
      const discountLine = q.discount > 0 ? ` That includes a ${Math.round(q.discountRate * 100)}% multi-day discount, saving ${money(q.discount)}.` : "";

      return {
        message: `The ${q.vehicle} is ${money(q.pricePerDay)} a day with a driver, so ${q.days} days comes to ${money(q.total)}.${discountLine} Fuel is billed at cost on top, and full protection is ${money(EXTRA_PRICES["Full insurance"])} a day if you want zero liability.`,
        vehicles: cards,
        suggestions: ["Add full insurance", "Is it available next week?", "Show me a cheaper option"],
        toolCalls,
        handoff: false,
      };
    }

    case "contact": {
      const { name, email } = slots;
      if (!email) {
        return {
          message: "Happy to get that over to the team — what's the best email for you?",
          vehicles: [],
          suggestions: [],
          toolCalls,
          handoff: false,
        };
      }

      const summaryBits = [
        slots.passengers ? `${slots.passengers} passengers` : null,
        slots.budgetPerDay ? `budget around ${formatCurrency(slots.budgetPerDay, { decimals: false })}/day` : null,
        slots.days ? `${slots.days} days` : null,
        slots.location ? `collecting from ${slots.location}` : null,
        slots.vehicleSlug ? `interested in ${slots.vehicleSlug.replace(/-/g, " ")}` : null,
      ].filter(Boolean);

      const conversation = turns
        .filter((t) => t.role === "user")
        .map((t) => t.content)
        .join(" | ");

      const result = await executeTool(
        "capture_lead",
        {
          name: name ?? email.split("@")[0].replace(/[._]/g, " "),
          email,
          phone: slots.phone,
          message: summaryBits.length ? `${summaryBits.join(", ")}. Conversation: ${conversation}` : conversation,
          intent: slots.vehicleSlug || slots.days ? "book" : "enquiry",
          budgetPerDay: slots.budgetPerDay,
          timeframe: slots.pickupDate ? "this_month" : slots.days ? "this_week" : "unknown",
          partySize: slots.passengers,
        },
        ctx,
      );
      record("capture_lead", { email }, result);

      const captured = result.ok ? (result.data as { leadId: string; tier: string; score: number }) : null;

      return {
        message: captured
          ? `Got it — I've passed your details to the team${
              captured.tier === "hot" ? ", flagged as priority so you'll hear back quickly" : ""
            }. ${
              summaryBits.length ? `They'll have your brief: ${summaryBits.join(", ")}.` : ""
            } Anything else I can check in the meantime?`
          : "I've noted that down. Anything else I can check for you while you're here?",
        vehicles: [],
        suggestions: ["What's your cancellation policy?", "Show me the cars again"],
        toolCalls,
        handoff: false,
        leadCaptured: captured
          ? { id: captured.leadId, tier: captured.tier, score: captured.score }
          : undefined,
      };
    }

    case "search":
    default: {
      const { cards, raw } = await search(slots, 3);
      record("search_vehicles", slots, raw);

      if (!cards.length) {
        const relaxed = await search({ ...slots, budgetPerDay: undefined, segment: undefined }, 3);
        record("search_vehicles", { relaxed: true }, relaxed.raw);
        return {
          message: relaxed.cards.length
            ? `Nothing hits that brief exactly. Closest I have is ${listCars(relaxed.cards)} — would any of those work?`
            : "I can't find a match for that. Tell me the party size and a rough daily budget and I'll try again.",
          vehicles: relaxed.cards,
          suggestions: suggestionsFor(slots, relaxed.cards),
          toolCalls,
          handoff: false,
        };
      }

      const constraints = [
        slots.passengers ? `${slots.passengers} people` : null,
        slots.budgetPerDay ? `under about ${formatCurrency(slots.budgetPerDay, { decimals: false })} a day` : null,
        slots.transmission ? slots.transmission.toLowerCase() : null,
        slots.location ? `from ${slots.location}` : null,
      ].filter(Boolean);

      const one = cards.length === 1;
      const opener = constraints.length
        ? `For ${constraints.join(", ")}, ${listCars(cards)} ${one ? "is the one" : "are the ones"} I'd put in front of you.`
        : `${listCars(cards).replace(/^the/, "The")} ${
            one ? "is the strongest option" : "are the strongest options"
          } on the fleet right now.`;

      const follow = nextQuestion(slots);
      const knowledgeHit = searchKnowledge(last, 1)[0];

      return {
        message: `${opener}${follow ? ` ${follow}` : knowledgeHit ? ` Worth knowing: ${knowledgeHit.body.split(". ")[0]}.` : ""}`,
        vehicles: cards,
        suggestions: suggestionsFor(slots, cards),
        toolCalls,
        handoff: false,
      };
    }
  }
}

/* ===========================================================================
   Hosted tool-calling loop
   =========================================================================== */

/**
 * Where a streamed turn sends its words.
 *
 * `onReset` exists for the turn that emits a sentence and *then* asks for a
 * tool — uncommon, but it does happen, and the words already shown belong to a
 * turn that is not the answer. The caller is told to discard them rather than
 * leaving a stale half-sentence above the real reply.
 */
export type ConciergeStreamSink = { onDelta: (delta: string) => void; onReset: () => void };

async function hostedConcierge(
  turns: ChatTurn[],
  ctx: ToolContext,
  sink?: ConciergeStreamSink,
): Promise<Omit<ConciergeReply, "engine" | "latencyMs">> {
  const provider = await resolveProviderForRequest();
  if (!provider) throw new Error("No provider");

  const messages: AiMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const toolCalls: ConciergeReply["toolCalls"] = [];
  const vehicles: ConciergeVehicleCard[] = [];
  let leadCaptured: ConciergeReply["leadCaptured"];
  let text = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const request = {
      system: CONCIERGE_SYSTEM_V3,
      messages,
      tools: TOOL_SPECS,
      maxTokens: 900,
      temperature: 0.4,
    };

    // Streamed when the caller wants words as they arrive and the provider
    // can produce them. Every turn is streamed rather than only the last,
    // because which turn is last is not knowable until it comes back without
    // a tool call — by which point the chance to stream it has gone.
    let res;
    let streamedThisTurn = false;
    if (sink && provider.stream) {
      const iterator = provider.stream(request);
      let step = await iterator.next();
      while (!step.done) {
        streamedThisTurn = true;
        sink.onDelta(step.value.delta);
        step = await iterator.next();
      }
      res = step.value;
    } else {
      res = await provider.complete(request);
    }

    text = res.text || text;
    if (!res.toolCalls.length) break;

    // This turn asked for a tool after all, so anything already shown was not
    // the answer.
    if (streamedThisTurn) sink?.onReset();

    const assistantBlocks: ContentBlock[] = [];
    if (res.text) assistantBlocks.push({ type: "text", text: res.text });
    for (const call of res.toolCalls) {
      assistantBlocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
    }
    messages.push({ role: "assistant", content: assistantBlocks });

    const resultBlocks: ContentBlock[] = [];
    for (const call of res.toolCalls) {
      const output = await executeTool(call.name, call.input, ctx);
      toolCalls.push({ name: call.name, input: call.input, output });

      if (call.name === "search_vehicles" && output.ok) {
        for (const v of output.data as ConciergeVehicleCard[]) {
          if (!vehicles.some((existing) => existing.slug === v.slug)) vehicles.push(v);
        }
      }
      if (call.name === "capture_lead" && output.ok) {
        const d = output.data as { leadId: string; tier: string; score: number };
        leadCaptured = { id: d.leadId, tier: d.tier, score: d.score };
      }

      resultBlocks.push({
        type: "tool_result",
        toolUseId: call.id,
        content: JSON.stringify(output.ok ? output.data : { error: output.error }),
        isError: !output.ok,
      });
    }
    messages.push({ role: "user", content: resultBlocks });
  }

  const slots = extractSlots(turns);
  return {
    message: text || "I'm not sure I follow — could you say that another way?",
    vehicles: vehicles.slice(0, 3),
    suggestions: suggestionsFor(slots, vehicles.slice(0, 3)),
    toolCalls,
    handoff: /human|team will|pass(?:ed)? (?:you|your)/i.test(text),
    leadCaptured,
  };
}

/* ===========================================================================
   Entry point
   =========================================================================== */

export async function runConcierge(
  turns: ChatTurn[],
  ctx: ToolContext = {},
  sink?: ConciergeStreamSink,
): Promise<ConciergeReply> {
  const started = Date.now();
  const provider = await resolveProviderForRequest();

  if (!provider) {
    const reply = await rulesConcierge(turns, ctx);
    return { ...reply, engine: describeEngine(null), latencyMs: Date.now() - started };
  }

  try {
    const reply = await hostedConcierge(turns, ctx, sink);
    return { ...reply, engine: describeEngine(provider), latencyMs: Date.now() - started };
  } catch (err) {
    // A vendor outage must never take the widget down — degrade, don't fail.
    // Anything already streamed came from the turn that failed, so it is
    // withdrawn before the rules engine answers in full.
    sink?.onReset();
    const reply = await rulesConcierge(turns, ctx);
    return {
      ...reply,
      engine: describeEngine(null),
      latencyMs: Date.now() - started,
      degraded: err instanceof Error ? err.message : "Model call failed; served rules engine.",
    };
  }
}

export { durationDiscount };
