/**
 * Retrieval corpus for the concierge. Small enough to keep in-process; the
 * lookup is keyword-scored so behaviour is identical whether the caller is the
 * model (via the get_policy tool) or the rules engine.
 *
 * Content is written for the Bangladeshi market: BRTA licences, NID
 * verification, taka deposits, chauffeur-included pricing and the realities of
 * intercity travel and monsoon flooding.
 */
export type KnowledgeEntry = {
  topic: string;
  title: string;
  keywords: string[];
  body: string;
};

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: "driver",
    title: "Driver included, or self-drive",
    keywords: ["driver", "chauffeur", "self drive", "self-drive", "myself", "own driver", "included"],
    body: "Every rate on the site is quoted with a professional chauffeur included — that is the normal arrangement in Bangladesh and it is what most customers want. Self-drive is available on the economy and standard fleet only, for holders of a BRTA licence held at least two years, and reduces the daily rate by about ৳800. The exclusive fleet is chauffeur-only, without exception.",
  },
  {
    topic: "licence",
    title: "Licence, NID and age requirements",
    keywords: [
      "licence", "license", "brta", "nid", "passport", "age", "old", "years", "young driver",
      "documents", "paperwork", "minimum", "verification",
    ],
    body: "For a chauffeur-driven booking you only need a National ID or passport for the lead traveller. For self-drive you must be 23 or over and hold a valid BRTA driving licence held at least two years, plus an NID. Foreign nationals need a passport, a valid visa and either a Bangladeshi licence or an International Driving Permit. We photograph and verify documents at handover.",
  },
  {
    topic: "insurance",
    title: "Insurance and damage liability",
    keywords: ["insurance", "excess", "damage", "waiver", "cover", "protection", "liable", "accident"],
    body: "All vehicles carry first-party comprehensive insurance and third-party liability as required by law. On a chauffeur-driven booking you carry no damage liability at all unless the damage is caused by the passengers. On self-drive there is a ৳25,000 liability on economy and standard cars; Full Protection reduces that to zero for ৳1,200 per day.",
  },
  {
    topic: "deposit",
    title: "Security deposit",
    keywords: ["deposit", "hold", "advance", "security", "bkash", "booking money", "pay upfront"],
    body: "A refundable security deposit is taken at handover: ৳10,000 for the economy fleet, ৳25,000 for standard cars and microbuses, and ৳1,00,000 for the exclusive fleet. Chauffeur-driven bookings under three days usually require only a 30% advance instead. Deposits are returned within three working days by bKash, Nagad or bank transfer.",
  },
  {
    topic: "fuel",
    title: "Fuel policy",
    keywords: ["fuel", "petrol", "octane", "diesel", "cng", "gas", "tank", "refuel", "mileage cost"],
    body: "Fuel is billed at actual cost on top of the daily rate, which is standard practice here — you pay for what the trip uses and we show the pump receipts. Alternatively, ask for an all-inclusive rate and we will fold an estimated fuel allowance into the quote. Hybrids and CNG-converted vehicles cost noticeably less to run in Dhaka traffic.",
  },
  {
    topic: "cancellation",
    title: "Cancellation and amendments",
    keywords: ["cancel", "cancellation", "refund", "change", "amend", "reschedule", "postpone"],
    body: "Free cancellation up to 24 hours before pick-up for a full refund of any advance. Inside 24 hours we retain one day's rate. Date and vehicle changes are free subject to availability and a price difference may apply. Wedding and exclusive-fleet bookings need seven days' notice because those vehicles are blocked out well in advance.",
  },
  {
    topic: "mileage",
    title: "Mileage and intercity limits",
    keywords: ["mileage", "kilometre", "kilometer", "km", "limit", "distance", "unlimited", "outside dhaka"],
    body: "Inside Dhaka the daily rate covers 120km. Intercity trips are quoted separately per route rather than by the kilometre — Dhaka to Cox's Bazar, Sylhet or Chattogram each have a fixed round-trip rate that includes the driver's food and accommodation. Unlimited mileage inside Dhaka is ৳900 per day.",
  },
  {
    topic: "delivery",
    title: "Pick-up, delivery and airport",
    keywords: ["deliver", "delivery", "collect", "collection", "airport", "shahjalal", "hotel", "pick up", "drop"],
    body: "Collection is free at any of our eleven branches. Delivery anywhere inside Dhaka city is ৳500; Hazrat Shahjalal Airport pick-up with a name board is ৳1,500 and includes one hour of waiting time. Outside Dhaka, delivery is quoted with the route. Late-night pick-ups between midnight and 6am carry a ৳700 surcharge.",
  },
  {
    topic: "additional-driver",
    title: "Additional drivers and long duty",
    keywords: ["additional driver", "second driver", "extra driver", "overtime", "duty hours", "night"],
    body: "A chauffeur's standard duty is twelve hours. Beyond that, overtime is ৳150 per hour, and an overnight stay outside Dhaka is ৳800 per night for the driver's accommodation. For self-drive, an additional named driver is ৳800 per day and must meet the same licence requirements.",
  },
  {
    topic: "payment",
    title: "Payment methods",
    keywords: ["pay", "payment", "bkash", "nagad", "rocket", "card", "invoice", "business", "account", "cash"],
    body: "We accept bKash, Nagad, Rocket, all local and international cards through SSLCOMMERZ, bank transfer and cash at handover. Corporate clients running three vehicles or more can be invoiced monthly on 15-day terms after a short verification. A VAT challan is issued on every corporate booking.",
  },
  {
    topic: "child-seat",
    title: "Child seats and family travel",
    keywords: ["child", "baby", "infant", "seat", "booster", "family", "kids"],
    body: "Infant and booster seats are ৳500 per day each and are fitted and checked by our team before handover. Reserve them at booking — we hold a limited number. Microbuses and seven-seat SUVs can take up to two child seats in the middle row.",
  },
  {
    topic: "monsoon",
    title: "Monsoon, flooding and road conditions",
    keywords: ["monsoon", "rain", "flood", "waterlogged", "water", "weather", "road condition"],
    body: "During heavy monsoon we recommend an SUV or the microbus for anything outside the main arterial roads — the Vezel, X-Trail and Pajero Sport all have the ground clearance for a waterlogged street. If a route becomes impassable mid-hire, our drivers reroute at no extra charge, and we do not charge for time lost to flooding.",
  },
  {
    topic: "wedding",
    title: "Wedding bookings",
    keywords: ["wedding", "bou", "gaye holud", "decoration", "flowers", "reception", "marriage"],
    body: "Wedding cars are booked as a full-day hire with a uniformed chauffeur. Floral decoration is permitted on the E-Class, C-Class and Land Cruiser and is fitted by our team on the morning at no extra cost if you supply the flowers, or ৳4,000 if we arrange them. Book at least two weeks ahead in the November-to-February season — those dates go early.",
  },
  {
    topic: "intercity",
    title: "Intercity and tourist routes",
    keywords: ["cox's bazar", "coxs bazar", "sylhet", "chattogram", "bandarban", "sreemangal", "tour", "intercity", "outside dhaka", "long trip"],
    body: "Popular routes are quoted as fixed round trips including the driver's food and accommodation: Dhaka to Cox's Bazar, Sylhet, Chattogram, Sreemangal and Bandarban. Hill-tract routes such as Bandarban and Rangamati require a 4WD — the X-Trail, Pajero Sport or Prado — and we will not release a sedan for them.",
  },
];

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "can", "i", "we", "you", "my", "our", "to", "for",
  "of", "and", "or", "on", "in", "with", "what", "how", "much", "it", "be", "your", "have", "there",
]);

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Keyword-overlap retrieval — deterministic, explainable and fast. */
export function searchKnowledge(query: string, limit = 2) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const scored = KNOWLEDGE.map((entry) => {
    const haystack = `${entry.title} ${entry.keywords.join(" ")} ${entry.body}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (entry.keywords.some((k) => k.includes(token) || token.includes(k))) score += 3;
      else if (haystack.includes(token)) score += 1;
    }
    return { entry, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.entry);
}
