import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
   Fleet
--------------------------------------------------------------------------- */
export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    /** popular | large | small | exclusive — the Figma deal tabs */
    segment: text("segment").notNull(),
    bodyType: text("body_type").notNull(),
    transmission: text("transmission").notNull(),
    fuel: text("fuel").notNull(),
    seats: integer("seats").notNull(),
    doors: integer("doors").notNull(),
    bags: integer("bags").notNull().default(2),
    pricePerDay: numeric("price_per_day", { precision: 10, scale: 2 }).notNull(),
    costPerDay: numeric("cost_per_day", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("image_url").notNull(),
    accentFrom: text("accent_from").notNull().default("#ff9f43"),
    accentTo: text("accent_to").notNull().default("#f5871f"),
    rating: real("rating").notNull().default(4.6),
    reviewCount: integer("review_count").notNull().default(0),
    location: text("location").notNull(),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("available"),
    unitsTotal: integer("units_total").notNull().default(4),
    unitsAvailable: integer("units_available").notNull().default(4),
    co2: integer("co2").notNull().default(120),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_slug_idx").on(t.slug), index("vehicles_segment_idx").on(t.segment)],
);

/* ---------------------------------------------------------------------------
   Customers
--------------------------------------------------------------------------- */
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    city: text("city").notNull().default(""),
    country: text("country").notNull().default("United Kingdom"),
    /** ISO 3166-1 numeric — joins to the world map shapes */
    countryCode: text("country_code").notNull().default("826"),
    avatarSeed: text("avatar_seed").notNull().default("a"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)],
);

/* ---------------------------------------------------------------------------
   Bookings — the source of truth every dashboard number is derived from
--------------------------------------------------------------------------- */
export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    customerId: text("customer_id").notNull(),
    pickupLocation: text("pickup_location").notNull(),
    dropoffLocation: text("dropoff_location").notNull(),
    pickupAt: timestamp("pickup_at", { withTimezone: true }).notNull(),
    dropoffAt: timestamp("dropoff_at", { withTimezone: true }).notNull(),
    days: integer("days").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    extrasTotal: numeric("extras_total", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    /** success | pending | cancelled — mirrors the Figma status pills */
    status: text("status").notNull().default("pending"),
    paymentMethod: text("payment_method").notNull().default("Stripe"),
    extras: jsonb("extras").$type<string[]>().notNull().default([]),
    source: text("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_reference_idx").on(t.reference),
    index("bookings_created_idx").on(t.createdAt),
    index("bookings_status_idx").on(t.status),
  ],
);

/* ---------------------------------------------------------------------------
   Leads — created by the site, scored by the AI lead qualifier
--------------------------------------------------------------------------- */
export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    company: text("company").notNull().default(""),
    message: text("message").notNull().default(""),
    intent: text("intent").notNull().default("browse"),
    budgetPerDay: integer("budget_per_day"),
    timeframe: text("timeframe").notNull().default("unknown"),
    partySize: integer("party_size"),
    score: integer("score").notNull().default(0),
    /** hot | warm | cold */
    tier: text("tier").notNull().default("cold"),
    status: text("status").notNull().default("new"),
    aiSummary: text("ai_summary").notNull().default(""),
    aiSignals: jsonb("ai_signals").$type<{ label: string; impact: number; detail: string }[]>()
      .notNull()
      .default([]),
    aiNextAction: text("ai_next_action").notNull().default(""),
    aiEngine: text("ai_engine").notNull().default("heuristic"),
    source: text("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_tier_idx").on(t.tier), index("leads_created_idx").on(t.createdAt)],
);

/* ---------------------------------------------------------------------------
   AI concierge transcripts
--------------------------------------------------------------------------- */
export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  channel: text("channel").notNull().default("web-widget"),
  engine: text("engine").notNull().default("heuristic"),
  handoff: boolean("handoff").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<{ name: string; input: unknown; output: unknown }[]>()
      .notNull()
      .default([]),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

/* ---------------------------------------------------------------------------
   Automation
--------------------------------------------------------------------------- */
export const automationRules = pgTable("automation_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  trigger: text("trigger").notNull(),
  conditions: jsonb("conditions").$type<{ field: string; op: string; value: unknown }[]>()
    .notNull()
    .default([]),
  actions: jsonb("actions").$type<{ type: string; config: Record<string, unknown> }[]>()
    .notNull()
    .default([]),
  enabled: boolean("enabled").notNull().default(true),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    steps: jsonb("steps").$type<{ action: string; status: string; detail: string }[]>()
      .notNull()
      .default([]),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("automation_runs_created_idx").on(t.createdAt)],
);

/** Append-only event log — everything the automation engine reacts to. */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    source: text("source").notNull().default("app"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_type_idx").on(t.type), index("events_created_idx").on(t.createdAt)],
);

/** Outbound notifications the automation actions produce (email/SMS/Slack stubs). */
export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("queued"),
  ruleId: text("rule_id").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Snapshot of country-level demand for the "Sales by Countries" map. */
export const countryTargets = pgTable("country_targets", {
  countryCode: text("country_code").primaryKey(),
  country: text("country").notNull(),
  target: integer("target").notNull().default(0),
  periodStart: date("period_start").notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type AutomationRule = typeof automationRules.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type AppEvent = typeof events.$inferSelect;
export type OutboxMessage = typeof outbox.$inferSelect;
