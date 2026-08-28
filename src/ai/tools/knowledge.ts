/**
 * Retrieval corpus for the concierge. Small enough to keep in-process; the
 * lookup is keyword-scored so behaviour is identical whether the caller is the
 * model (via the get_policy tool) or the rules engine.
 */
export type KnowledgeEntry = {
  topic: string;
  title: string;
  keywords: string[];
  body: string;
};

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: "licence",
    title: "Driving licence requirements",
    keywords: [
      "licence", "license", "permit", "idp", "age", "old", "years", "young driver",
      "provisional", "supercar", "hypercar", "exclusive", "minimum",
    ],
    body: "Drivers must hold a full licence held for at least 12 months. Standard and small cars are available from age 21; large cars and SUVs from 25; the exclusive fleet (AMG GT, GT-R, Chiron, LaFerrari) requires age 30+, a licence held 3 years, and a clean record. Non-UK licences are accepted alongside a passport; an International Driving Permit is required for non-Latin-script licences.",
  },
  {
    topic: "insurance",
    title: "Insurance and excess",
    keywords: ["insurance", "excess", "damage", "waiver", "cdw", "cover", "protection", "liable"],
    body: "Every rental includes third-party liability, theft protection and collision damage waiver with a £950 excess (£2,500 on the exclusive fleet). Full Protection reduces the excess to zero for £19/day and can be added at booking or at the counter. Tyres, glass and undercarriage are covered only under Full Protection.",
  },
  {
    topic: "deposit",
    title: "Security deposit",
    keywords: ["deposit", "hold", "card", "pre-authorisation", "preauth", "security"],
    body: "A refundable pre-authorisation is held on a credit card in the main driver's name: £250 for small cars, £500 for large cars, and £5,000 for the exclusive fleet. Debit cards are accepted for small and large cars only. The hold is released within 5 working days of return.",
  },
  {
    topic: "fuel",
    title: "Fuel and charging policy",
    keywords: ["fuel", "petrol", "diesel", "charge", "charging", "electric", "tank", "refuel"],
    body: "All vehicles are supplied full and must be returned full. A refuelling service charge of £35 plus fuel at market rate applies otherwise. Hybrids need no special handling. Electric vehicles are supplied at 80%+ and should be returned above 50%; a public charging card is included.",
  },
  {
    topic: "cancellation",
    title: "Cancellation and amendments",
    keywords: ["cancel", "cancellation", "refund", "change", "amend", "reschedule", "postpone"],
    body: "Free cancellation up to 48 hours before pick-up for a full refund. Between 48 and 24 hours, 50% is refunded. Inside 24 hours the first rental day is retained. Amendments to dates or vehicle are free subject to availability; a price difference may apply. Exclusive-fleet bookings require 7 days' notice.",
  },
  {
    topic: "mileage",
    title: "Mileage limits",
    keywords: ["mileage", "miles", "km", "unlimited", "limit", "distance"],
    body: "Small and large cars include 250 miles per day; unlimited mileage is £12/day. The exclusive fleet includes 100 miles per day with £4.50 per additional mile. Mileage is pooled across the rental, so a quiet day offsets a long one.",
  },
  {
    topic: "delivery",
    title: "Delivery and collection",
    keywords: ["deliver", "delivery", "collect", "collection", "airport", "hotel", "drop", "pick up"],
    body: "Free collection at any of our 11 branches. Delivery to an address or airport terminal is £45 within 20 miles of a branch and £1.80 per mile beyond. Hypercars are delivered by covered transporter at no extra cost. Out-of-hours pick-up between 22:00 and 06:00 is £30.",
  },
  {
    topic: "additional-driver",
    title: "Additional drivers",
    keywords: ["additional driver", "second driver", "extra driver", "share", "swap"],
    body: "Additional drivers are £11/day each and must meet the same age and licence rules as the main driver and be present at pick-up with their licence. Up to three additional drivers per rental. The exclusive fleet permits one additional driver, assessed individually.",
  },
  {
    topic: "payment",
    title: "Payment methods",
    keywords: ["pay", "payment", "card", "invoice", "stripe", "paypal", "apple pay", "business", "account"],
    body: "We accept Visa, Mastercard, Amex, Apple Pay, PayPal and bank transfer. Business accounts can be invoiced on 30-day terms after a short credit check — useful for fleets of three vehicles or more.",
  },
  {
    topic: "child-seat",
    title: "Child seats and family travel",
    keywords: ["child", "baby", "infant", "seat", "booster", "isofix", "family", "kids"],
    body: "Infant, toddler and booster seats are £8/day each and are ISOFIX where the vehicle supports it. Reserve at booking — seats are fitted before pick-up and checked by staff. Vehicles with 5+ seats can take up to two child seats in the rear.",
  },
  {
    topic: "abroad",
    title: "Travelling abroad",
    keywords: ["abroad", "europe", "ferry", "tunnel", "cross border", "france", "ireland"],
    body: "Cross-Channel travel is permitted on small and large cars with 72 hours' notice and a £60 European cover fee, which includes a green card and roadside assistance across the EU. The exclusive fleet may not leave the UK.",
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
