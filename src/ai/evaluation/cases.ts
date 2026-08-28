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
    /** Every returned car must seat at least this many people. */
    seatsAtLeast?: number;
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
    id: "family-microbus",
    description: "A large family group is offered something that actually seats them",
    turns: [
      { role: "user", content: "I need a car for 10 people going to Cox's Bazar, around 8000 taka a day" },
    ],
    expect: { usesTool: "search_vehicles", returnsVehicles: true },
  },
  {
    id: "budget-word-large-party",
    description: '"Budget" is a price signal, not a request for a small car',
    turns: [{ role: "user", content: "six people going to Sylhet, budget around 9000 taka a day" }],
    // The failure this guards was not an empty list but a refusal: the word
    // "budget" set the small segment, nothing small seats six, and the reply
    // was "Nothing matches that brief right now." Asserting on the refusal is
    // what makes the case fail if the parsing regresses.
    expect: {
      usesTool: "search_vehicles",
      returnsVehicles: true,
      seatsAtLeast: 6,
      mustNotMention: ["nothing matches", "nothing hits"],
    },
  },
  {
    id: "cheap-word-large-party",
    description: '"Cheap" must not shrink the car below the stated party size either',
    turns: [{ role: "user", content: "need something cheap for 7 of us" }],
    expect: {
      usesTool: "search_vehicles",
      returnsVehicles: true,
      seatsAtLeast: 7,
      mustNotMention: ["nothing matches", "nothing hits"],
    },
  },
  {
    id: "budget-city",
    description: "Cheap Dhaka runaround surfaces the economy segment",
    turns: [{ role: "user", content: "Something cheap and small for driving around Dhaka, under 4000 taka a day" }],
    expect: { usesTool: "search_vehicles", returnsVehicles: true },
  },
  {
    id: "policy-driver",
    description: "The driver question is answered from policy, since it is the first thing people ask here",
    turns: [{ role: "user", content: "Is the driver included in the price or is it self drive?" }],
    expect: { usesTool: "get_policy", mentionsAny: ["chauffeur", "driver", "self-drive"] },
  },
  {
    id: "policy-deposit",
    description: "Deposit question returns the real taka figures",
    turns: [{ role: "user", content: "How much deposit do you take?" }],
    expect: { mentionsAny: ["10,000", "25,000", "deposit"] },
  },
  {
    id: "policy-licence",
    description: "Licence and paperwork questions come from policy, not guesswork",
    turns: [{ role: "user", content: "What documents do I need, do you want my NID?" }],
    expect: { mentionsAny: ["nid", "licence", "passport", "brta"] },
  },
  {
    id: "quote",
    description: "Pricing goes through the quote tool, never mental arithmetic",
    turns: [{ role: "user", content: "How much is the Premio for 7 days?" }],
    expect: { usesTool: "quote_price", mentionsAny: ["৳"] },
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
  expect: {
    minSeats?: number;
    maxPricePerDay?: number;
    segmentIn?: string[];
    count?: number;
    transmission?: string;
  };
};

export const RECOMMENDER_CASES: RecommenderCase[] = [
  {
    id: "group-of-ten",
    description: "Ten passengers must produce vehicles that actually seat them",
    brief: { brief: "Ten of us going to Cox's Bazar for a week", passengers: 10 },
    // Only the microbus seats ten; padding the list with a 7-seater would be
    // the bug, not the fix.
    expect: { minSeats: 10 },
  },
  {
    id: "family-of-six",
    description: '"Family of 6" is parsed as a party size, not ignored',
    brief: { brief: "Family of 6 driving to Sylhet for a week, budget around 9000 taka a day" },
    expect: { minSeats: 6 },
  },
  {
    id: "automatic-from-free-text",
    description: '"automatic" in the brief is treated as a real constraint',
    brief: { brief: "Something cheap and automatic for office runs around Dhaka" },
    // "cheap" has to bite even with no figure attached: the Land Cruiser is
    // never the answer to this brief, whatever else matches.
    expect: { transmission: "Automatic", maxPricePerDay: 8000 },
  },
  {
    id: "tight-budget",
    description: "A 3,500 taka budget must not lead with the exclusive fleet",
    brief: { brief: "Cheap runaround for Dhaka traffic", budgetPerDay: 3500, occasion: "city" },
    expect: { maxPricePerDay: 6000, segmentIn: ["small", "large"] },
  },
  {
    id: "wedding",
    description: "A wedding brief leads with the exclusive fleet",
    brief: { brief: "Wedding car for the day, want something that looks special", occasion: "special", budgetPerDay: 30000 },
    expect: { segmentIn: ["exclusive"] },
  },
  {
    id: "business",
    description: "Airport business travel prefers an automatic",
    brief: { brief: "Business trip, client pickups from Shahjalal airport", occasion: "business", transmission: "Automatic" },
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
      name: "Tanvir Hossain",
      email: "tanvir@example.com",
      phone: "+880 1712-345678",
      message:
        "I need the Prado from 14th March for 5 days, budget is around 20000 taka a day. Can you confirm today?",
      intent: "book",
      budgetPerDay: 20000,
      timeframe: "this_week",
      partySize: 3,
    },
    expect: { tier: "hot" },
  },
  {
    id: "hot-corporate",
    description: "Multi-vehicle corporate demand is hot even without a date",
    lead: {
      name: "Sadia Rahman",
      email: "sadia@acme.com.bd",
      phone: "+880 1819-223344",
      company: "Acme Logistics",
      message:
        "We need 6 vehicles on a rolling monthly contract for our field team in Sylhet. Please send corporate rates.",
      intent: "corporate",
      budgetPerDay: 9000,
      timeframe: "this_quarter",
      partySize: 6,
    },
    expect: { tier: "hot" },
  },
  {
    id: "cold-browsing",
    description: "Vague browsing with no dates is cold",
    lead: {
      name: "Rakib Islam",
      email: "rakib@example.com",
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
      name: "Nafis Ahmed",
      email: "nafis@example.com",
      message: "Cheapest possible, any car will do.",
      intent: "browse",
      budgetPerDay: 1500,
      timeframe: "unknown",
    },
    expect: { tier: "cold" },
  },
  {
    id: "warm-soft-intent",
    description: "Real interest without firm dates lands in the middle",
    lead: {
      name: "Farhana Akter",
      email: "farhana@example.com",
      message:
        "Looking at options for a trip next month, probably an SUV for the family going to Sreemangal. Haven't fixed the dates but budget is around 7000 a day.",
      intent: "enquiry",
      budgetPerDay: 7000,
      timeframe: "next_month",
      partySize: 5,
    },
    expect: { tier: "warm" },
  },
];
