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
        post: {
          summary: "Add a model to the fleet",
          description: "Admin role required; a viewer session receives 403. The slug is derived from the name and must be unique.",
          responses: { "200": { description: "Created" }, "403": errorResponse, "409": errorResponse, "422": errorResponse },
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
      "/api/coupons/validate": {
        post: {
          summary: "Preview a discount code",
          description:
            "Preview only — nothing is reserved or redeemed. POST /api/bookings looks the code up again and re-prices it against its own quote, so a client that edits this response changes nothing.",
          responses: { "200": { description: "valid true with the discount, or false with a reason" }, "422": errorResponse },
        },
      },
      "/api/team": {
        get: { summary: "Staff accounts (never returns a password hash)", responses: { "200": { description: "Members" }, "401": errorResponse } },
        post: {
          summary: "Create a further staff account",
          description:
            "Requires an existing admin session. This is the counterpart to /api/auth/setup closing permanently: every account after the first is created here rather than through a public route. Roles are admin or viewer.",
          responses: { "200": { description: "Created" }, "403": errorResponse, "409": errorResponse },
        },
        patch: {
          summary: "Activate or deactivate an account",
          description: "An admin cannot deactivate their own account.",
          responses: { "200": { description: "Updated" }, "400": errorResponse, "404": errorResponse },
        },
      },
      "/api/auth/setup": {
        post: {
          summary: "Create the first administrator",
          description:
            "Open only while no admin account exists. Once one does, this returns 409 permanently — it can never mint a second privileged account.",
          responses: { "200": { description: "Administrator created and signed in" }, "409": errorResponse, "422": errorResponse },
        },
      },
      "/api/auth/login": {
        post: {
          summary: "Sign in",
          description:
            "Rate limited to five attempts per fifteen minutes per client. A missing account and a wrong password return the same message and run the same PBKDF2 work, so accounts cannot be enumerated by response or by timing.",
          responses: { "200": { description: "Session cookie issued" }, "401": errorResponse, "429": { description: "Rate limited" } },
        },
      },
      "/api/auth/logout": {
        post: { summary: "Sign out and clear the session cookie", responses: { "200": { description: "Signed out" } } },
      },
      "/api/openapi": {
        get: { summary: "This document", responses: { "200": { description: "OpenAPI 3.1 specification" } } },
      },
    },
    "x-ai-tools": TOOL_SPECS.map((t) => ({ name: t.name, description: t.description })),
  });
}
