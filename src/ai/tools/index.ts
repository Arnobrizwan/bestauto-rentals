import { z } from "zod";

import { countOverlapping } from "@/server/repositories/bookings";
import { getVehicleBySlug, listFacets, listVehicles } from "@/server/repositories/vehicles";
import type { ToolSpec } from "@/ai/provider/types";

import { searchKnowledge } from "./knowledge";

/* ---------------------------------------------------------------------------
   Tool definitions.

   One registry drives three consumers: the JSON Schemas handed to the model,
   the runtime executors, and the deterministic rules engine — so hosted and
   fallback modes can never drift apart in behaviour.
--------------------------------------------------------------------------- */

const searchVehiclesInput = z.object({
  query: z.string().optional().describe("Free text, e.g. 'cheap automatic hatchback'"),
  segment: z.enum(["small", "large", "exclusive", "popular", "all"]).optional(),
  seatsMin: z.number().int().min(1).max(9).optional().describe("Minimum seats required"),
  priceMax: z.number().min(0).optional().describe("Maximum price per day in GBP"),
  priceMin: z.number().min(0).optional(),
  transmission: z.enum(["Automatic", "Manual"]).optional(),
  fuel: z.enum(["Petrol", "Diesel", "Hybrid", "Electric"]).optional(),
  bodyType: z.string().optional(),
  location: z.string().optional().describe("Branch name, e.g. 'London Heathrow'"),
  limit: z.number().int().min(1).max(8).optional(),
});

const checkAvailabilityInput = z.object({
  slug: z.string().describe("Vehicle slug from search_vehicles"),
  pickupDate: z.string().describe("ISO date, e.g. 2026-09-04"),
  dropoffDate: z.string().describe("ISO date, e.g. 2026-09-09"),
});

const quotePriceInput = z.object({
  slug: z.string(),
  days: z.number().int().min(1).max(90),
  extras: z.array(z.string()).optional().describe("Any of: Additional driver, Child seat, Full insurance, Unlimited mileage, Airport delivery, Wi-Fi hotspot"),
});

const getPolicyInput = z.object({
  question: z.string().describe("The customer's question about policy, in their own words"),
});

const listLocationsInput = z.object({});

const captureLeadInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(4),
  intent: z.enum(["book", "enquiry", "corporate", "browse"]).optional(),
  budgetPerDay: z.number().optional(),
  timeframe: z.enum(["today", "this_week", "this_month", "next_month", "this_quarter", "unknown"]).optional(),
  partySize: z.number().int().optional(),
});

export const EXTRA_PRICES: Record<string, number> = {
  "Additional driver": 11,
  "Child seat": 8,
  "Full insurance": 19,
  "Unlimited mileage": 12,
  "Airport delivery": 45,
  "Wi-Fi hotspot": 6,
};

/** Multi-day discounts — the same ladder the booking service charges. */
export function durationDiscount(days: number) {
  if (days >= 28) return 0.25;
  if (days >= 14) return 0.18;
  if (days >= 7) return 0.12;
  if (days >= 3) return 0.05;
  return 0;
}

const jsonSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as Record<string, unknown>;

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "search_vehicles",
    description:
      "Search the live fleet. Always use this before naming or pricing a car — never invent a vehicle, price or availability.",
    inputSchema: jsonSchema(searchVehiclesInput),
  },
  {
    name: "check_availability",
    description: "Check whether a specific vehicle has a unit free for a date range.",
    inputSchema: jsonSchema(checkAvailabilityInput),
  },
  {
    name: "quote_price",
    description: "Produce an exact price breakdown including multi-day discount and extras.",
    inputSchema: jsonSchema(quotePriceInput),
  },
  {
    name: "get_policy",
    description:
      "Look up company policy (insurance, deposit, licence and age, fuel, mileage, cancellation, delivery, child seats, travelling abroad, payment).",
    inputSchema: jsonSchema(getPolicyInput),
  },
  {
    name: "list_locations",
    description: "List the branches a customer can collect from.",
    inputSchema: jsonSchema(listLocationsInput),
  },
  {
    name: "capture_lead",
    description:
      "Save the customer's details so a human can follow up. Only call this once you have at least a name and an email address that the customer gave you.",
    inputSchema: jsonSchema(captureLeadInput),
  },
];

/* --------------------------------------------------------------- executors */

export type ToolContext = {
  /** Injected so the concierge route can create leads without a circular import. */
  createLead?: (input: z.infer<typeof captureLeadInput>) => Promise<{ id: string; tier: string; score: number }>;
};

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext = {}): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_vehicles": {
        const input = searchVehiclesInput.parse(rawInput ?? {});
        const { items } = await listVehicles({
          q: input.query,
          segment: input.segment,
          seatsMin: input.seatsMin,
          priceMax: input.priceMax,
          priceMin: input.priceMin,
          transmission: input.transmission,
          fuel: input.fuel,
          bodyType: input.bodyType,
          location: input.location,
          sort: input.segment === "popular" ? "popular" : undefined,
          limit: input.limit ?? 4,
        });
        return {
          ok: true,
          data: items.map((v) => ({
            slug: v.slug,
            name: v.name,
            segment: v.segment,
            bodyType: v.bodyType,
            transmission: v.transmission,
            fuel: v.fuel,
            seats: v.seats,
            bags: v.bags,
            pricePerDay: Number(v.pricePerDay),
            rating: v.rating,
            location: v.location,
            unitsAvailable: v.unitsAvailable,
            features: v.features.slice(0, 4),
          })),
        };
      }

      case "check_availability": {
        const input = checkAvailabilityInput.parse(rawInput);
        const vehicle = await getVehicleBySlug(input.slug);
        if (!vehicle) return { ok: false, error: `No vehicle with slug "${input.slug}".` };

        const pickup = new Date(input.pickupDate);
        const dropoff = new Date(input.dropoffDate);
        if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) {
          return { ok: false, error: "Dates must be ISO format (YYYY-MM-DD)." };
        }
        if (dropoff <= pickup) return { ok: false, error: "Drop-off must be after pick-up." };

        const committed = await countOverlapping(vehicle.id, pickup, dropoff);
        const free = Math.max(0, vehicle.unitsTotal - committed);
        const days = Math.max(1, Math.round((dropoff.getTime() - pickup.getTime()) / 86_400_000));

        return {
          ok: true,
          data: {
            slug: vehicle.slug,
            name: vehicle.name,
            available: free > 0,
            unitsFree: free,
            unitsTotal: vehicle.unitsTotal,
            days,
            estimatedTotal: Number((Number(vehicle.pricePerDay) * days * (1 - durationDiscount(days))).toFixed(2)),
          },
        };
      }

      case "quote_price": {
        const input = quotePriceInput.parse(rawInput);
        const vehicle = await getVehicleBySlug(input.slug);
        if (!vehicle) return { ok: false, error: `No vehicle with slug "${input.slug}".` };

        const base = Number(vehicle.pricePerDay) * input.days;
        const discountRate = durationDiscount(input.days);
        const discount = base * discountRate;
        const extras = (input.extras ?? []).filter((e) => e in EXTRA_PRICES);
        const extrasTotal = extras.reduce((sum, e) => sum + EXTRA_PRICES[e] * input.days, 0);
        const subtotal = base - discount + extrasTotal;

        return {
          ok: true,
          data: {
            vehicle: vehicle.name,
            pricePerDay: Number(vehicle.pricePerDay),
            days: input.days,
            base: Number(base.toFixed(2)),
            discountRate,
            discount: Number(discount.toFixed(2)),
            extras: extras.map((e) => ({ name: e, perDay: EXTRA_PRICES[e], total: EXTRA_PRICES[e] * input.days })),
            extrasTotal: Number(extrasTotal.toFixed(2)),
            total: Number(subtotal.toFixed(2)),
            currency: "GBP",
          },
        };
      }

      case "get_policy": {
        const input = getPolicyInput.parse(rawInput);
        const hits = searchKnowledge(input.question, 2);
        if (!hits.length) {
          return { ok: true, data: { found: false, note: "No matching policy — offer a human handoff." } };
        }
        return { ok: true, data: { found: true, entries: hits.map((h) => ({ title: h.title, body: h.body })) } };
      }

      case "list_locations": {
        const facets = await listFacets();
        return { ok: true, data: { locations: facets.locations } };
      }

      case "capture_lead": {
        const input = captureLeadInput.parse(rawInput);
        if (!ctx.createLead) return { ok: false, error: "Lead capture is not available in this context." };
        const lead = await ctx.createLead(input);
        return { ok: true, data: { saved: true, leadId: lead.id, tier: lead.tier, score: lead.score } };
      }

      default:
        return { ok: false, error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: `Invalid input: ${err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Tool execution failed." };
  }
}

export type SearchVehiclesInput = z.infer<typeof searchVehiclesInput>;
export type CaptureLeadInput = z.infer<typeof captureLeadInput>;
