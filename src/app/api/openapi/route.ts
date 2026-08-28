import { TOOL_SPECS } from "@/ai/tools";
import { ok } from "@/lib/security/http";

export const dynamic = "force-dynamic";

/**
 * Machine-readable description of the public API. Kept here rather than in a
 * static file so the AI tool catalogue stays in sync with the code.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const errorResponse = {
    description: "Error",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: { error: { type: "string" }, detail: {} },
          required: ["error"],
        },
      },
    },
  };

  return ok({
    openapi: "3.1.0",
    info: {
      title: "Best Auto API",
      version: "1.0.0",
      description:
        "Fleet, booking, lead, analytics, AI and automation endpoints. Every write is validated with Zod and rate limited per client.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/health": {
        get: { summary: "Liveness and dependency check", responses: { "200": { description: "Healthy" }, "503": { description: "Degraded" } } },
      },
      "/api/vehicles": {
        get: {
          summary: "Search the fleet",
          parameters: [
            { name: "segment", in: "query", schema: { enum: ["small", "large", "exclusive", "popular"] } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "seatsMin", in: "query", schema: { type: "integer" } },
            { name: "priceMax", in: "query", schema: { type: "number" } },
            { name: "transmission", in: "query", schema: { enum: ["Automatic", "Manual"] } },
            { name: "fuel", in: "query", schema: { enum: ["Petrol", "Diesel", "Hybrid", "Electric"] } },
            { name: "sort", in: "query", schema: { enum: ["popular", "price-asc", "price-desc", "rating", "newest"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", default: 8, maximum: 48 } },
          ],
          responses: { "200": { description: "Paged vehicles" }, "422": errorResponse },
        },
      },
      "/api/vehicles/{slug}": {
        get: {
          summary: "Fetch one vehicle",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Vehicle" }, "404": errorResponse },
        },
      },
      "/api/vehicles/facets": { get: { summary: "Filter facets for the fleet", responses: { "200": { description: "Facets" } } } },
      "/api/bookings": {
        get: { summary: "List bookings", responses: { "200": { description: "Paged bookings" } } },
        post: {
          summary: "Create a booking",
          description:
            "Re-prices server-side, checks overlapping availability, upserts the customer, then publishes booking.created to the automation engine.",
          responses: {
            "201": { description: "Created" },
            "409": { description: "No units free for those dates" },
            "422": errorResponse,
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/bookings/{reference}": {
        get: {
          summary: "Fetch a booking by reference",
          parameters: [{ name: "reference", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Booking" }, "404": errorResponse },
        },
      },
      "/api/leads": {
        get: { summary: "List leads", responses: { "200": { description: "Paged leads" } } },
        post: {
          summary: "Create and score a lead",
          description: "Scores with the AI qualifier, persists, then publishes lead.created to the automation engine.",
          responses: { "201": { description: "Created with score and automation trace" }, "422": errorResponse },
        },
        patch: { summary: "Update lead status", responses: { "200": { description: "Updated" }, "404": errorResponse } },
      },
      "/api/analytics": {
        get: {
          summary: "Dashboard aggregates",
          parameters: [
            { name: "preset", in: "query", schema: { enum: ["7d", "30d", "90d", "365d"] } },
            { name: "from", in: "query", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", schema: { type: "string", format: "date" } },
            { name: "grain", in: "query", schema: { enum: ["day", "week", "month"] } },
          ],
          responses: { "200": { description: "KPIs, series, countries, best sellers, utilisation and mix" } },
        },
      },
      "/api/ai/chat": {
        post: {
          summary: "AI concierge turn",
          description: "Stateless per request; the whole transcript is sent. Returns the reply, vehicle cards and the tools used.",
          responses: { "200": { description: "Reply" }, "422": errorResponse, "429": { description: "Rate limited" } },
        },
      },
      "/api/ai/recommend": { post: { summary: "AI vehicle recommendation", responses: { "200": { description: "Ranked picks with reasoning" } } } },
      "/api/ai/qualify": { post: { summary: "Score a lead without persisting", responses: { "200": { description: "Score, tier, signals, next action" } } } },
      "/api/ai/insights": { get: { summary: "AI operations brief over the analytics snapshot", responses: { "200": { description: "Insights" } } } },
      "/api/automations": { get: { summary: "Rules, runs, events, outbox and stats", responses: { "200": { description: "Automation state" } } } },
      "/api/automations/{id}": {
        patch: {
          summary: "Enable or disable a rule",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" }, "404": errorResponse },
        },
      },
      "/api/webhooks/{source}": {
        post: {
          summary: "Inbound webhook receiver",
          description:
            "Sources: stripe, partner, crm, fleet-telematics. HMAC-SHA256 over the raw body in x-signature is required when WEBHOOK_SECRET_<SOURCE> is set.",
          parameters: [{ name: "source", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Accepted" }, "401": errorResponse, "404": errorResponse },
        },
      },
      "/api/cron/daily-digest": {
        get: { summary: "Scheduled digest (Bearer CRON_SECRET)", responses: { "200": { description: "Ran" }, "401": errorResponse } },
        post: { summary: "Trigger the digest manually from the admin UI", responses: { "200": { description: "Ran" } } },
      },
    },
    "x-ai-tools": TOOL_SPECS.map((t) => ({ name: t.name, description: t.description })),
  });
}
