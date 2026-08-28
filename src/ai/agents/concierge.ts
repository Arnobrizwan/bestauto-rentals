import { describeEngine, resolveProvider, type AiMessage, type ContentBlock, type EngineInfo } from "@/ai/provider";
import { CONCIERGE_SYSTEM_V3 } from "@/ai/prompts";
import { EXTRA_PRICES, TOOL_SPECS, durationDiscount, executeTool, type ToolContext } from "@/ai/tools";
import { searchKnowledge } from "@/ai/tools/knowledge";

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

export type Slots = {
  passengers?: number;
  budgetPerDay?: number;
  days?: number;
  pickupDate?: string;
  dropoffDate?: string;
  location?: string;
  transmission?: "Automatic" | "Manual";
  fuel?: "Petrol" | "Diesel" | "Hybrid" | "Electric";
  segment?: "small" | "large" | "exclusive";
  name?: string;
  email?: string;
  phone?: string;
  vehicleSlug?: string;
};

const LOCATIONS = [
  "London Heathrow",
  "London Kings Cross",
  "London Mayfair",
  "London Canary Wharf",
  "Manchester City",
  "Birmingham Central",
  "Edinburgh Airport",
  "Leeds City",
  "Bristol Temple",
  "Brighton Seafront",
  "Glasgow Central",
];

const VEHICLE_ALIASES: Record<string, string> = {
  panamera: "porsche-panamera-4s",
  porsche: "porsche-panamera-4s",
  mustang: "ford-mustang-gt",
  camaro: "chevrolet-camaro-rs",
  polo: "volkswagen-polo",
  expedition: "ford-expedition",
  i30: "hyundai-i30-n",
  "amg gt": "mercedes-amg-gt",
  "gt-r": "nissan-gt-r",
  gtr: "nissan-gt-r",
  m4: "bmw-m4-competition",
  bmw: "bmw-m4-competition",
  fiat: "fiat-500",
  "500": "fiat-500",
  chiron: "bugatti-chiron",
  bugatti: "bugatti-chiron",
  rav4: "toyota-rav4-hybrid",
  toyota: "toyota-rav4-hybrid",
  laferrari: "ferrari-laferrari",
  ferrari: "ferrari-laferrari",
  c63: "mercedes-amg-c63",
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
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
    /(?:£|\bgbp\s*)(\d{2,4})/i.exec(userText)?.[1] ??
    /(\d{2,4})\s*(?:pounds?|quid)?\s*(?:a|per|\/)\s*day/i.exec(userText)?.[1] ??
    /(?:under|below|max(?:imum)?|up to|around|about)\s*(?:£)?\s*(\d{2,4})/i.exec(userText)?.[1];
  if (budget) slots.budgetPerDay = Number(budget);

  const days = /(\d+)\s*(?:days?|nights?)/i.exec(userText)?.[1];
  if (days) slots.days = Math.min(90, Number(days));
  if (/\b(?:a |one )?week\b/i.test(userText) && !slots.days) slots.days = 7;
  if (/\bweekend\b/i.test(userText) && !slots.days) slots.days = 3;
  if (/\bfortnight|two weeks\b/i.test(userText)) slots.days = 14;

  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(userText)?.[1];
  if (iso) slots.pickupDate = iso;

  const location = LOCATIONS.find((l) => text.includes(l.toLowerCase()));
  if (location) slots.location = location;
  else {
    const city = ["london", "manchester", "birmingham", "edinburgh", "leeds", "bristol", "brighton", "glasgow"].find(
      (c) => text.includes(c),
    );
    if (city) slots.location = LOCATIONS.find((l) => l.toLowerCase().startsWith(city));
  }

  if (/\bautomatic\b/.test(text)) slots.transmission = "Automatic";
  else if (/\bmanual|stick shift\b/.test(text)) slots.transmission = "Manual";

  if (/\bhybrid\b/.test(text)) slots.fuel = "Hybrid";
  else if (/\belectric|\bev\b/.test(text)) slots.fuel = "Electric";
  else if (/\bdiesel\b/.test(text)) slots.fuel = "Diesel";

  if (/\b(small|compact|city car|cheap|budget|economical)\b/.test(text)) slots.segment = "small";
  if (/\b(suv|7 seater|seven seater|estate|big car|large)\b/.test(text)) slots.segment = "large";
  if (/\b(supercar|hypercar|exotic|luxury|exclusive|wedding|prestige)\b/.test(text)) slots.segment = "exclusive";

  for (const [alias, slug] of Object.entries(VEHICLE_ALIASES)) {
    if (text.includes(alias)) {
      slots.vehicleSlug = slug;
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
  /\b(insurance|excess|deposit|licence|license|age|fuel|petrol|mileage|miles|cancel|refund|deliver|collect|child seat|abroad|europe|pay|invoice|additional driver|young driver)\b|how old|old enough|minimum age|years old/i;

export function classifyIntent(message: string, slots: Slots): Intent {
  const text = message.toLowerCase().trim();

  if (/^(hi|hey|hello|good (morning|afternoon|evening)|yo)\b/.test(text) && text.length < 40) return "greeting";
  if (/\b(thanks|thank you|cheers|great, ta|perfect)\b/.test(text) && text.length < 40) return "thanks";
  if (/\b(human|agent|person|someone|call me|speak to|sales team|representative)\b/.test(text)) return "handoff";

  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(message)) return "contact";
  if (/\b(book it|reserve|i'?ll take|go ahead|sign me up|yes please book)\b/.test(text)) return "contact";

  if (/\b(how much|price|cost|quote|total|per day|charge|£|\bfee\b)\b/.test(text)) return "quote";
  if (/\b(available|availability|free on|in stock|can i get|do you have.*(on|for)\s)\b/.test(text)) return "availability";
  if (POLICY_HINT.test(text)) return "policy";

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

const money = (n: number) => `£${n.toFixed(n % 1 === 0 ? 0 : 2)}`;

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
  if (!slots.budgetPerDay) out.push("Keep it under £80 a day");
  out.push("What's the insurance excess?");
  out.push("Do you deliver to Heathrow?");
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
        suggestions: ["Something cheap for city driving", "A 7-seater for a family holiday", "Show me the exclusive fleet"],
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
        suggestions: ["My name is Alex, alex@example.com"],
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
          suggestions: ["What's the insurance excess?", "How old do I need to be?"],
          toolCalls,
          handoff: true,
        };
      }

      const primary = entries.entries[0];
      const follow = nextQuestion(slots);
      return {
        message: `${primary.body}${follow ? `\n\nAnything else you want to check, or shall I start pulling up cars? ${follow}` : ""}`,
        vehicles: [],
        suggestions: ["Show me what's available", "What's the deposit?", "Do you deliver?"],
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
        slug = cards[0]?.slug;
      }

      if (!slug) {
        return {
          message:
            "Nothing matches that brief right now. If you can stretch the budget a little or take a different branch, I'll find you something — which is easier?",
          vehicles: [],
          suggestions: ["Raise my budget to £120", "Try a different branch"],
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
        message: `The ${q.vehicle} is ${money(q.pricePerDay)} a day, so ${q.days} days comes to ${money(q.total)}.${discountLine} Full insurance is ${money(EXTRA_PRICES["Full insurance"])} a day on top if you'd like the excess taken to zero.`,
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
        slots.budgetPerDay ? `budget around £${slots.budgetPerDay}/day` : null,
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
        slots.budgetPerDay ? `under about £${slots.budgetPerDay} a day` : null,
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

async function hostedConcierge(
  turns: ChatTurn[],
  ctx: ToolContext,
): Promise<Omit<ConciergeReply, "engine" | "latencyMs">> {
  const provider = resolveProvider();
  if (!provider) throw new Error("No provider");

  const messages: AiMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
  const toolCalls: ConciergeReply["toolCalls"] = [];
  const vehicles: ConciergeVehicleCard[] = [];
  let leadCaptured: ConciergeReply["leadCaptured"];
  let text = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await provider.complete({
      system: CONCIERGE_SYSTEM_V3,
      messages,
      tools: TOOL_SPECS,
      maxTokens: 900,
      temperature: 0.4,
    });

    text = res.text || text;
    if (!res.toolCalls.length) break;

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

export async function runConcierge(turns: ChatTurn[], ctx: ToolContext = {}): Promise<ConciergeReply> {
  const started = Date.now();
  const provider = resolveProvider();

  if (!provider) {
    const reply = await rulesConcierge(turns, ctx);
    return { ...reply, engine: describeEngine(null), latencyMs: Date.now() - started };
  }

  try {
    const reply = await hostedConcierge(turns, ctx);
    return { ...reply, engine: describeEngine(provider), latencyMs: Date.now() - started };
  } catch (err) {
    // A vendor outage must never take the widget down — degrade, don't fail.
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
