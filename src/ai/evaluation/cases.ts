/**
 * Golden cases for the AI layer.
 *
 * These are assertions about behaviour, not about exact wording, so they hold
 * for both the rules engine and a hosted model. `npm run eval` runs them
 * against whichever engine is configured.
 */
export type ConciergeCase = {
  id: string;
  description: string;
  turns: { role: "user" | "assistant"; content: string }[];
  expect: {
    /** Substrings, any one of which satisfies the check (case-insensitive). */
    mentionsAny?: string[];
    mustNotMention?: string[];
    usesTool?: string;
    returnsVehicles?: boolean;
    handoff?: boolean;
    maxWords?: number;
  };
};

export const CONCIERGE_CASES: ConciergeCase[] = [
  {
    id: "greeting",
    description: "Opens with an invitation rather than a wall of options",
    turns: [{ role: "user", content: "hi" }],
    expect: { maxWords: 70, returnsVehicles: false },
  },
  {
    id: "family-search",
    description: "Family brief returns real vehicles with enough seats",
    turns: [{ role: "user", content: "I need a car for 6 people for a family holiday, around £150 a day" }],
    expect: { usesTool: "search_vehicles", returnsVehicles: true },
  },
  {
    id: "budget-city",
    description: "Cheap city brief surfaces the small segment",
    turns: [{ role: "user", content: "Something cheap and small for driving around London, under £50 a day" }],
    expect: { usesTool: "search_vehicles", returnsVehicles: true },
  },
  {
    id: "policy-excess",
    description: "Insurance question is answered from the knowledge base, with the real figure",
    turns: [{ role: "user", content: "What is the insurance excess?" }],
    expect: { usesTool: "get_policy", mentionsAny: ["excess", "950"] },
  },
  {
    id: "policy-age",
    description: "Age question is answered from policy rather than guessed",
    turns: [{ role: "user", content: "How old do I have to be to rent one of the supercars?" }],
    expect: { mentionsAny: ["30", "age", "licence"] },
  },
  {
    id: "quote",
    description: "Pricing goes through the quote tool, never mental arithmetic",
    turns: [{ role: "user", content: "How much is the Mustang for 7 days?" }],
    expect: { usesTool: "quote_price", mentionsAny: ["£"] },
  },
  {
    id: "handoff",
    description: "Asking for a human triggers a handoff",
    turns: [{ role: "user", content: "Can I speak to a real person please" }],
    expect: { handoff: true },
  },
  {
    id: "out-of-scope",
    description: "Declines unrelated requests without inventing an answer",
    turns: [{ role: "user", content: "What do you think about the stock market this year?" }],
    expect: { mustNotMention: ["stock", "invest"], maxWords: 80 },
  },
  {
    id: "no-hallucinated-fleet",
    description: "Never offers a vehicle that is not in the fleet",
    turns: [{ role: "user", content: "Do you have a Rolls-Royce Phantom?" }],
    expect: { mustNotMention: ["yes, the rolls", "our rolls-royce"] },
  },
];

export type RecommenderCase = {
  id: string;
  description: string;
  brief: Record<string, unknown>;
  expect: { minSeats?: number; maxPricePerDay?: number; segmentIn?: string[]; count?: number };
};

export const RECOMMENDER_CASES: RecommenderCase[] = [
  {
    id: "family-seven",
    description: "Seven passengers must produce vehicles that actually seat them",
    brief: { brief: "Family of 7 going to Cornwall for a week", passengers: 7 },
    // No count assertion: only one vehicle in the fleet seats 7, and returning
    // a 5-seater to pad the list would be the bug, not the fix.
    expect: { minSeats: 7 },
  },
  {
    id: "family-of-six-phrasing",
    description: "\"Family of 6\" is parsed as a party size, not ignored",
    brief: { brief: "Family of 6 driving to Cornwall for a week, budget around £150 a day" },
    expect: { minSeats: 6 },
  },
  {
    id: "tight-budget",
    description: "A £50 budget must not lead with a hypercar",
    brief: { brief: "Cheap runaround for the city", budgetPerDay: 50, occasion: "city" },
    expect: { maxPricePerDay: 80, segmentIn: ["small", "large"] },
  },
  {
    id: "wedding",
    description: "A wedding brief leads with the exclusive fleet",
    brief: { brief: "Wedding car for the day, want something spectacular", occasion: "special", budgetPerDay: 3000 },
    expect: { segmentIn: ["exclusive"] },
  },
  {
    id: "business",
    description: "Airport business travel prefers an automatic",
    brief: { brief: "Business trip, client pickups from Heathrow", occasion: "business", transmission: "Automatic" },
    expect: { count: 3 },
  },
];

export type QualifierCase = {
  id: string;
  description: string;
  lead: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    message: string;
    intent?: string;
    budgetPerDay?: number | null;
    timeframe?: string;
    partySize?: number | null;
  };
  expect: { tier: "hot" | "warm" | "cold" };
};

export const QUALIFIER_CASES: QualifierCase[] = [
  {
    id: "hot-dated-booking",
    description: "Dates plus budget plus a named car is a hot lead",
    lead: {
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: "+44 7700 900123",
      message: "I need the BMW M4 from 14th March for 5 days, budget is around £250 a day. Can you confirm today?",
      intent: "book",
      budgetPerDay: 250,
      timeframe: "this_week",
      partySize: 2,
    },
    expect: { tier: "hot" },
  },
  {
    id: "hot-corporate",
    description: "Multi-vehicle corporate demand is hot even without a date",
    lead: {
      name: "Tomas Novak",
      email: "tomas@acme.com",
      phone: "+44 7700 900456",
      company: "Acme Logistics",
      message: "We need 6 vehicles on a rolling monthly contract for our field team. Please send commercial terms.",
      intent: "corporate",
      budgetPerDay: 90,
      timeframe: "this_quarter",
      partySize: 6,
    },
    expect: { tier: "hot" },
  },
  {
    id: "cold-browsing",
    description: "Vague browsing with no dates is cold",
    lead: {
      name: "Sam Lee",
      email: "sam@example.com",
      message: "Just looking, no rush. Might need something someday.",
      intent: "browse",
      timeframe: "unknown",
    },
    expect: { tier: "cold" },
  },
  {
    id: "cold-price-only",
    description: "Price-only motivation scores low",
    lead: {
      name: "Alex Kim",
      email: "alex@example.com",
      message: "Cheapest possible, any car will do.",
      intent: "browse",
      budgetPerDay: 25,
      timeframe: "unknown",
    },
    expect: { tier: "cold" },
  },
  {
    id: "warm-soft-intent",
    description: "Real interest without firm dates lands in the middle",
    lead: {
      name: "Nadia Haddad",
      email: "nadia@example.com",
      message:
        "Looking at options for a trip next month, probably an SUV for the family. Haven't fixed the dates but budget is around 90 a day.",
      intent: "enquiry",
      budgetPerDay: 90,
      timeframe: "next_month",
      partySize: 5,
    },
    expect: { tier: "warm" },
  },
];
