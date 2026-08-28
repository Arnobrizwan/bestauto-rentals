/**
 * Deterministic seed generator.
 *
 * Everything the dashboard renders is *derived* from these rows — there are no
 * hard-coded totals anywhere in the UI. A seeded PRNG keeps runs reproducible
 * so screenshots and tests stay stable.
 */
import { SEED_FLEET } from "./fleet";

/* ------------------------------------------------------------------ PRNG */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const pick = <T,>(rng: () => number, arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
const between = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

/* -------------------------------------------------------------- markets */
export const MARKETS = [
  { country: "United Kingdom", code: "826", weight: 34, cities: ["London", "Manchester", "Leeds", "Bristol", "Glasgow"] },
  { country: "United States", code: "840", weight: 14, cities: ["New York", "Austin", "Chicago", "Seattle"] },
  { country: "Germany", code: "276", weight: 9, cities: ["Berlin", "Munich", "Hamburg"] },
  { country: "France", code: "250", weight: 7, cities: ["Paris", "Lyon", "Nice"] },
  { country: "Spain", code: "724", weight: 6, cities: ["Madrid", "Barcelona", "Valencia"] },
  { country: "Netherlands", code: "528", weight: 5, cities: ["Amsterdam", "Rotterdam"] },
  { country: "Italy", code: "380", weight: 5, cities: ["Milan", "Rome"] },
  { country: "United Arab Emirates", code: "784", weight: 4, cities: ["Dubai", "Abu Dhabi"] },
  { country: "Canada", code: "124", weight: 4, cities: ["Toronto", "Vancouver"] },
  { country: "Australia", code: "036", weight: 3, cities: ["Sydney", "Melbourne"] },
  { country: "Poland", code: "616", weight: 3, cities: ["Warsaw", "Krakow"] },
  { country: "India", code: "356", weight: 2, cities: ["Mumbai", "Bengaluru"] },
  { country: "Brazil", code: "076", weight: 2, cities: ["Sao Paulo", "Rio de Janeiro"] },
  { country: "South Africa", code: "710", weight: 1, cities: ["Cape Town"] },
  { country: "Japan", code: "392", weight: 1, cities: ["Tokyo"] },
] as const;

const FIRST = [
  "Amelia", "Noah", "Zara", "Marcus", "Priya", "Tomas", "Ines", "Karl", "Yuki", "Diego",
  "Hannah", "Idris", "Lena", "Oscar", "Fatima", "Ben", "Sofia", "Mateo", "Chloe", "Ravi",
  "Elena", "Jonas", "Nadia", "Felix", "Aisha", "Viezh", "Sam", "Marta", "Leo", "Nora",
  "Dmitri", "Grace", "Hugo", "Isabel", "Kwame", "Mia", "Otto", "Rosa", "Theo", "Wren",
];

const LAST = [
  "Whitfield", "Okonkwo", "Marchetti", "Novak", "Sharma", "Lindqvist", "Duarte", "Fischer",
  "Tanaka", "Alvarez", "Boateng", "Kowalski", "Rossi", "Nguyen", "Haddad", "O'Sullivan",
  "Bergström", "Mensah", "Petrov", "Kaur", "Robert", "Delacroix", "Van Dijk", "Silva",
  "Yilmaz", "Castellano", "Moreau", "Andersen", "Bianchi", "Reyes",
];

export const PICKUP_POINTS = [
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
] as const;

const PAYMENTS = ["Stripe", "Paypal", "Apple Pay", "PayU", "Paytm", "Bank transfer"] as const;
const EXTRAS = [
  "Additional driver",
  "Child seat",
  "Full insurance",
  "Unlimited mileage",
  "Airport delivery",
  "Wi-Fi hotspot",
] as const;

/**
 * Month-of-year demand multiplier. Shaped to mirror the seasonality in the
 * Figma sales-analytics curve: a February spike, a March trough, a June peak,
 * then a gentle autumn decline.
 */
const SEASONALITY = [0.82, 1.0, 0.58, 0.7, 0.68, 1.0, 0.66, 0.62, 0.57, 0.72, 0.79, 0.95];

export type SeedBundle = ReturnType<typeof buildSeed>;

export function buildSeed(now = new Date()) {
  const rng = makeRng(20260828);

  /* ------------------------------------------------------------ vehicles */
  const vehicles = SEED_FLEET.map((v, i) => ({
    id: `veh_${String(i + 1).padStart(3, "0")}`,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    model: v.model,
    year: v.year,
    segment: v.segment,
    bodyType: v.bodyType,
    transmission: v.transmission,
    fuel: v.fuel,
    seats: v.seats,
    doors: v.doors,
    bags: v.bags,
    pricePerDay: v.pricePerDay.toFixed(2),
    costPerDay: v.costPerDay.toFixed(2),
    imageUrl: v.photo,
    accentFrom: v.accentFrom,
    accentTo: v.accentTo,
    rating: v.rating,
    reviewCount: v.reviewCount,
    location: v.location,
    features: v.features,
    description: v.description,
    status: "available" as const,
    unitsTotal: v.unitsTotal,
    unitsAvailable: Math.max(1, v.unitsTotal - between(rng, 0, Math.min(2, v.unitsTotal - 1))),
    co2: v.co2,
    createdAt: new Date(now.getTime() - between(rng, 200, 900) * 86400000),
  }));

  /* ----------------------------------------------------------- customers */
  const weighted: (typeof MARKETS)[number][] = [];
  for (const m of MARKETS) for (let i = 0; i < m.weight; i++) weighted.push(m);

  const customers = Array.from({ length: 140 }, (_, i) => {
    const market = pick(rng, weighted);
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    return {
      id: `cus_${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}${i}@example.com`,
      phone: `+44 7${between(rng, 100, 999)} ${between(rng, 100000, 999999)}`,
      city: pick(rng, market.cities),
      country: market.country,
      countryCode: market.code,
      avatarSeed: `${first}${last}`,
      createdAt: new Date(now.getTime() - between(rng, 5, 700) * 86400000),
    };
  });

  /* ------------------------------------------------------------ bookings */
  const vehiclePool: string[] = [];
  SEED_FLEET.forEach((v, i) => {
    for (let n = 0; n < v.demand; n++) vehiclePool.push(vehicles[i].id);
  });

  const bookings: {
    id: string;
    reference: string;
    vehicleId: string;
    customerId: string;
    pickupLocation: string;
    dropoffLocation: string;
    pickupAt: Date;
    dropoffAt: Date;
    days: number;
    subtotal: string;
    extrasTotal: string;
    total: string;
    status: string;
    paymentMethod: string;
    extras: string[];
    source: string;
    createdAt: Date;
  }[] = [];

  let seq = 0;
  // 12 months back to today.
  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const season = SEASONALITY[anchor.getMonth()];
    // Gentle year-over-year growth on top of the seasonal shape.
    const growth = 1 + (11 - monthsAgo) * 0.022;
    const count = Math.round(52 * season * growth);
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

    for (let n = 0; n < count; n++) {
      const day = between(rng, 1, monthsAgo === 0 ? Math.max(1, now.getDate()) : daysInMonth);
      const createdAt = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        day,
        between(rng, 7, 21),
        between(rng, 0, 59),
      );
      if (createdAt > now) continue;

      const vehicleId = pick(rng, vehiclePool);
      const vehicle = vehicles.find((v) => v.id === vehicleId)!;
      const customer = pick(rng, customers);
      const days = between(rng, 1, 9);
      const pickupAt = new Date(createdAt.getTime() + between(rng, 1, 21) * 86400000);
      const dropoffAt = new Date(pickupAt.getTime() + days * 86400000);
      const price = Number(vehicle.pricePerDay);
      const subtotal = price * days;
      const chosenExtras = Array.from(
        new Set(Array.from({ length: between(rng, 0, 2) }, () => pick(rng, EXTRAS))),
      );
      const extrasTotal = chosenExtras.length * between(rng, 9, 24);

      // ~78% success / 13% pending / 9% cancelled, matching the Figma pill mix.
      const roll = rng();
      const status = roll < 0.78 ? "success" : roll < 0.91 ? "pending" : "cancelled";

      seq += 1;
      bookings.push({
        id: `bkg_${String(seq).padStart(4, "0")}`,
        reference: `#${between(rng, 100000000, 999999999)}${between(rng, 100, 999)}`,
        vehicleId,
        customerId: customer.id,
        pickupLocation: pick(rng, PICKUP_POINTS),
        dropoffLocation: pick(rng, PICKUP_POINTS),
        pickupAt,
        dropoffAt,
        days,
        subtotal: subtotal.toFixed(2),
        extrasTotal: extrasTotal.toFixed(2),
        total: (subtotal + extrasTotal).toFixed(2),
        status,
        paymentMethod: pick(rng, PAYMENTS),
        extras: chosenExtras,
        source: pick(rng, ["web", "web", "web", "ai-concierge", "phone", "partner"]),
        createdAt,
      });
    }
  }

  bookings.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  /* --------------------------------------------------------------- leads */
  const LEAD_MESSAGES = [
    {
      message:
        "Need a 7-seater for a family trip to Cornwall next weekend, 5 days. Two children so we'll need car seats. Budget is around £120 a day.",
      intent: "book",
      budgetPerDay: 120,
      timeframe: "this_week",
      partySize: 7,
    },
    {
      message:
        "We're a production company shooting in Manchester in March. Likely 3 vehicles for 3 weeks. Can you invoice a company account?",
      intent: "corporate",
      budgetPerDay: 400,
      timeframe: "this_quarter",
      partySize: 6,
    },
    {
      message: "Just browsing, what do you have in the way of sports cars?",
      intent: "browse",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 1,
    },
    {
      message:
        "Wedding on the 14th — need the Bugatti or the LaFerrari with a chauffeur for four hours. Money is not the issue, availability is.",
      intent: "book",
      budgetPerDay: 2500,
      timeframe: "this_month",
      partySize: 2,
    },
    {
      message: "Do you deliver to Edinburgh airport? Might need something for a day.",
      intent: "enquiry",
      budgetPerDay: 60,
      timeframe: "next_month",
      partySize: 2,
    },
    {
      message:
        "Our sales team needs 8 cars on a rolling monthly contract starting Q2. Please send commercial terms.",
      intent: "corporate",
      budgetPerDay: 90,
      timeframe: "this_quarter",
      partySize: 8,
    },
    {
      message: "How much is the cheapest car?",
      intent: "browse",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 1,
    },
    {
      message:
        "Curious what your rates look like. No rush, might need something later in the year for a road trip.",
      intent: "browse",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 2,
    },
    {
      message:
        "Is there a student discount? Looking for the cheapest possible option, any car will do really.",
      intent: "browse",
      budgetPerDay: 30,
      timeframe: "unknown",
      partySize: 1,
    },
    {
      message:
        "Considering hiring something for a few days at some point. What's included in the price?",
      intent: "enquiry",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 2,
    },
    {
      message: "Do you have anything automatic? Not sure on dates yet.",
      intent: "enquiry",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 2,
    },
    {
      message:
        "Looking at options for a trip next month, probably an SUV. Haven't fixed the dates but budget is around 90 a day.",
      intent: "enquiry",
      budgetPerDay: 90,
      timeframe: "next_month",
      partySize: 5,
    },
  ];

  const leads = Array.from({ length: 42 }, (_, i) => {
    const template = LEAD_MESSAGES[i % LEAD_MESSAGES.length];
    const customer = pick(rng, customers);
    return {
      id: `led_${String(i + 1).padStart(3, "0")}`,
      name: customer.name,
      email: customer.email,
      // Only about a third of web enquiries leave a phone number.
      phone: rng() < 0.34 || template.intent === "corporate" ? customer.phone : "",
      company: template.intent === "corporate" ? `${pick(rng, LAST)} Group` : "",
      message: template.message,
      intent: template.intent,
      budgetPerDay: template.budgetPerDay,
      timeframe: template.timeframe,
      partySize: template.partySize,
      source: pick(rng, ["web", "web", "ai-concierge", "partner"]),
      createdAt: new Date(now.getTime() - between(rng, 0, 75) * 86400000 - between(rng, 0, 86400000)),
    };
  });

  return { vehicles, customers, bookings, leads };
}
