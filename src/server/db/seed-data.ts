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

/**
 * Domestic demand dominates, but a meaningful slice of bookings is placed from
 * abroad — the diaspora arranging a car before they land, and corporate travel
 * from the Gulf and Southeast Asia. Codes are ISO 3166-1 numeric so they join
 * straight onto the world-map shapes.
 */
export const MARKETS = [
  {
    country: "Bangladesh",
    code: "050",
    weight: 52,
    cities: ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Narayanganj", "Gazipur", "Cox's Bazar"],
  },
  { country: "India", code: "356", weight: 8, cities: ["Kolkata", "Delhi", "Chennai"] },
  { country: "United Kingdom", code: "826", weight: 7, cities: ["London", "Birmingham", "Oldham"] },
  { country: "United States", code: "840", weight: 6, cities: ["New York", "Detroit", "Paterson"] },
  { country: "Saudi Arabia", code: "682", weight: 5, cities: ["Riyadh", "Jeddah"] },
  { country: "United Arab Emirates", code: "784", weight: 5, cities: ["Dubai", "Abu Dhabi"] },
  { country: "Malaysia", code: "458", weight: 4, cities: ["Kuala Lumpur", "Penang"] },
  { country: "Qatar", code: "634", weight: 3, cities: ["Doha"] },
  { country: "Australia", code: "036", weight: 2, cities: ["Sydney", "Melbourne"] },
  { country: "Canada", code: "124", weight: 2, cities: ["Toronto"] },
  { country: "Japan", code: "392", weight: 2, cities: ["Tokyo"] },
  { country: "Italy", code: "380", weight: 2, cities: ["Rome"] },
  { country: "Oman", code: "512", weight: 1, cities: ["Muscat"] },
  { country: "Kuwait", code: "414", weight: 1, cities: ["Kuwait City"] },
  { country: "South Korea", code: "410", weight: 1, cities: ["Seoul"] },
] as const;

const FIRST = [
  "Rahim", "Karim", "Fatema", "Ayesha", "Tanvir", "Sadia", "Nusrat", "Arif", "Sabbir", "Mim",
  "Rakib", "Sumaiya", "Imran", "Farhana", "Shakib", "Tasnim", "Mahmud", "Rubel", "Jannatul", "Nafis",
  "Anika", "Rifat", "Sharmin", "Zahid", "Priyanka", "Sohel", "Lamia", "Naeem", "Tahmina", "Asif",
  "Mehedi", "Sanjida", "Tousif", "Ishrat", "Rezaul", "Nabila", "Shanto", "Marufa", "Adnan", "Raisa",
];

const LAST = [
  "Rahman", "Hossain", "Islam", "Ahmed", "Chowdhury", "Khan", "Akter", "Begum", "Uddin", "Sarkar",
  "Mia", "Ali", "Haque", "Karim", "Siddique", "Bhuiyan", "Talukder", "Mollah", "Sheikh", "Das",
  "Roy", "Barua", "Majumder", "Kabir", "Alam", "Nahar", "Parvez", "Rashid", "Anam", "Jahan",
];

/** The eleven branches. Dhaka-heavy, because the market is. */
export const PICKUP_POINTS = [
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
] as const;

/** Payment rails people in Bangladesh actually use. */
const PAYMENTS = ["bKash", "Nagad", "Rocket", "SSLCOMMERZ", "Visa", "Bank transfer", "Cash on pickup"] as const;

const EXTRAS = [
  "Additional driver",
  "Child seat",
  "Full insurance",
  "Unlimited mileage",
  "Airport pickup",
  "Wi-Fi hotspot",
] as const;

/**
 * Month-of-year demand multiplier for Bangladesh: the November-to-February
 * wedding and tourist season is the peak, and the June-to-September monsoon is
 * the trough. Two months either side of Eid lift as well, but Eid moves against
 * the Gregorian calendar so it is left out rather than faked.
 */
const SEASONALITY = [1.15, 1.1, 0.85, 0.95, 0.8, 0.62, 0.58, 0.6, 0.7, 0.85, 1.0, 1.2];

export type SeedBundle = ReturnType<typeof buildSeed>;

const DAY_MS = 86_400_000;

/** Registering cities as they appear on a Bangladeshi plate. */
const PLATE_CITIES = ["DHAKA METRO", "DHAKA METRO", "DHAKA METRO", "CHATTA METRO", "SYLHET", "KHULNA", "RAJ METRO"] as const;
const PLATE_SERIES = ["GA", "GHA", "KHA", "CHA", "JA", "TA"] as const;

/** The four papers a commercial hire car must carry current. */
const DOCUMENT_KINDS = ["fitness", "tax-token", "insurance", "route-permit"] as const;

const MAINTENANCE_KINDS = [
  { kind: "service", summary: "Scheduled service — oil, filters, brake check", base: 6500 },
  { kind: "tyres", summary: "Tyre replacement, front pair", base: 18000 },
  { kind: "repair", summary: "Air-conditioning compressor rebuild", base: 22000 },
  { kind: "repair", summary: "Suspension bushes after monsoon potholing", base: 14000 },
  { kind: "accident", summary: "Rear bumper and tail lamp after a low-speed knock", base: 31000 },
  { kind: "inspection", summary: "Pre-fitness inspection at the BRTA centre", base: 4500 },
] as const;

const GARAGES = ["Tejgaon Workshop", "Uttara Service Point", "Agrabad Garage", "Authorised Toyota Service"] as const;

const COUPONS = [
  { code: "EIDSAFAR", description: "Eid travel — flat taka off any booking of three days or more", kind: "flat", value: 3000, minDays: 3, startedDaysAgo: 20, endsInDays: 25, usageLimit: 200 },
  { code: "BIYE10", description: "Wedding season discount on the exclusive fleet", kind: "percent", value: 10, minDays: 1, startedDaysAgo: 40, endsInDays: 60, usageLimit: 120 },
  { code: "MONSOON15", description: "Monsoon trough offer to keep the fleet moving", kind: "percent", value: 15, minDays: 2, startedDaysAgo: 90, endsInDays: -10, usageLimit: 300 },
  { code: "COXWEEK", description: "Seven-day Cox's Bazar round trip", kind: "flat", value: 7500, minDays: 7, startedDaysAgo: 15, endsInDays: 45, usageLimit: 80 },
  { code: "CORPORATE5", description: "Standing corporate rate for accounts on monthly invoicing", kind: "percent", value: 5, minDays: 1, startedDaysAgo: 200, endsInDays: 160, usageLimit: 500 },
  { code: "AIRPORT500", description: "Shahjalal Airport pickup credit", kind: "flat", value: 500, minDays: 1, startedDaysAgo: 30, endsInDays: 30, usageLimit: 400 },
  { code: "FIRSTHIRE", description: "First booking with Best Auto", kind: "percent", value: 8, minDays: 1, startedDaysAgo: 120, endsInDays: 90, usageLimit: 1000 },
  { code: "MICROBUS12", description: "Microbus group travel, twelve percent off", kind: "percent", value: 12, minDays: 2, startedDaysAgo: 10, endsInDays: 50, usageLimit: 150 },
] as const;

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
      phone: `+880 1${between(rng, 3, 9)}${between(rng, 10, 99)}-${between(rng, 100000, 999999)}`,
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
  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const season = SEASONALITY[anchor.getMonth()];
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
      const extrasTotal = chosenExtras.length * between(rng, 400, 1500);

      const roll = rng();
      const status = roll < 0.78 ? "success" : roll < 0.91 ? "pending" : "cancelled";

      seq += 1;
      bookings.push({
        id: `bkg_${String(seq).padStart(4, "0")}`,
        reference: `BA-${between(rng, 100000, 999999)}${between(rng, 10, 99)}`,
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
        "Need a microbus for a family trip to Cox's Bazar next weekend, 4 days, 10 of us. Budget around 8000 taka a day with driver.",
      intent: "book",
      budgetPerDay: 8000,
      timeframe: "this_week",
      partySize: 10,
    },
    {
      message:
        "We are an NGO running field visits in Sylhet from next month. Likely 3 vehicles for 3 weeks. Can you invoice against a project code?",
      intent: "corporate",
      budgetPerDay: 12000,
      timeframe: "this_quarter",
      partySize: 6,
    },
    {
      message: "Just browsing, what cars do you have available?",
      intent: "browse",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 1,
    },
    {
      message:
        "Wedding on the 14th at a Gulshan community centre. Need the E-Class with decoration and a chauffeur for the full day. Budget is not the issue, availability is.",
      intent: "book",
      budgetPerDay: 25000,
      timeframe: "this_month",
      partySize: 2,
    },
    {
      message: "Do you do airport pickup from Shahjalal? Might need a car for one day only.",
      intent: "enquiry",
      budgetPerDay: 5000,
      timeframe: "next_month",
      partySize: 2,
    },
    {
      message:
        "Our Dhaka office needs 8 cars on a monthly contract for the sales team starting from the new quarter. Please send corporate rates.",
      intent: "corporate",
      budgetPerDay: 4500,
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
        "Curious what your rates look like. No rush, might need something later in the year for a trip to Bandarban.",
      intent: "browse",
      budgetPerDay: null,
      timeframe: "unknown",
      partySize: 4,
    },
    {
      message: "Is there a student discount? Looking for the cheapest possible option, any car will do really.",
      intent: "browse",
      budgetPerDay: 2000,
      timeframe: "unknown",
      partySize: 1,
    },
    {
      message: "Considering hiring something for a few days at some point. Is the driver included in the price?",
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
        "Looking at options for a trip next month, probably an SUV for the family going to Sreemangal. Haven't fixed the dates but budget is around 7000 a day.",
      intent: "enquiry",
      budgetPerDay: 7000,
      timeframe: "next_month",
      partySize: 5,
    },
    {
      message:
        "Flying in from Dubai on the 20th, need a Prado with driver for a week of meetings in Dhaka and one day to Chattogram.",
      intent: "book",
      budgetPerDay: 20000,
      timeframe: "this_month",
      partySize: 3,
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

  /* -------------------------------------------------------------- units */
  // Every model expands into its registered cars. Registrations follow the
  // BRTA plate format, with the series letters drawn per registering city.
  const units = vehicles.flatMap((v) =>
    Array.from({ length: v.unitsTotal }, (_, u) => {
      const city = pick(rng, PLATE_CITIES);
      const series = pick(rng, PLATE_SERIES);
      return {
        id: `unit_${v.id.slice(4)}_${u + 1}`,
        vehicleId: v.id,
        registration: `${city} ${series} ${between(rng, 11, 39)}-${between(rng, 1000, 9999)}`,
        status: "available",
        branch: v.location,
        odometerKm: between(rng, 12_000, 190_000),
        acquiredAt: new Date(now.getTime() - between(rng, 200, 1900) * DAY_MS).toISOString().slice(0, 10),
      };
    }),
  );

  /* ---------------------------------------------------------- documents */
  // Expiry dates are deliberately spread across expired / due / current so the
  // compliance board has something real to sort, rather than every car being
  // green. Roughly one unit in six is carrying a lapsed document.
  const documents = units.flatMap((unit) =>
    DOCUMENT_KINDS.map((kind, k) => {
      const roll = rng();
      const daysOut = roll < 0.08 ? -between(rng, 1, 45) : roll < 0.22 ? between(rng, 1, 30) : between(rng, 31, 330);
      const expiresAt = new Date(now.getTime() + daysOut * DAY_MS);
      const issuedAt = new Date(expiresAt.getTime() - 365 * DAY_MS);
      return {
        id: `doc_${unit.id.slice(5)}_${k}`,
        unitId: unit.id,
        kind,
        reference: `${kind.slice(0, 3).toUpperCase()}-${between(rng, 100000, 999999)}`,
        issuedAt: issuedAt.toISOString().slice(0, 10),
        expiresAt: expiresAt.toISOString().slice(0, 10),
      };
    }),
  );

  /* -------------------------------------------------------- maintenance */
  const maintenance = units
    .filter(() => rng() < 0.28)
    .map((unit, i) => {
      const kind = pick(rng, MAINTENANCE_KINDS);
      const openedAt = new Date(now.getTime() - between(rng, 0, 120) * DAY_MS);
      const done = rng() < 0.62;
      return {
        id: `job_${String(i + 1).padStart(4, "0")}`,
        unitId: unit.id,
        kind: kind.kind,
        status: done ? "done" : rng() < 0.5 ? "open" : "in-progress",
        summary: kind.summary,
        garage: pick(rng, GARAGES),
        odometerKm: unit.odometerKm - between(rng, 0, 4000),
        cost: (kind.base + between(rng, 0, kind.base)).toFixed(2),
        openedAt,
        closedAt: done ? new Date(openedAt.getTime() + between(rng, 1, 6) * DAY_MS) : null,
      };
    });

  /* ------------------------------------------------------------ coupons */
  const coupons = COUPONS.map((c, i) => ({
    id: `cpn_${String(i + 1).padStart(3, "0")}`,
    code: c.code,
    description: c.description,
    kind: c.kind,
    value: c.value.toFixed(2),
    minDays: c.minDays,
    startsAt: new Date(now.getTime() - c.startedDaysAgo * DAY_MS).toISOString().slice(0, 10),
    endsAt: new Date(now.getTime() + c.endsInDays * DAY_MS).toISOString().slice(0, 10),
    usageLimit: c.usageLimit,
    usedCount: between(rng, 0, Math.max(1, Math.floor(c.usageLimit * 0.7))),
    active: c.endsInDays > 0,
  }));

  return { vehicles, customers, bookings, leads, units, documents, maintenance, coupons };
}
