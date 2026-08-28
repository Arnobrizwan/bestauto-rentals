import type { RuleDefinition } from "./types";

/**
 * The shipped automation catalogue.
 *
 * These are seeded into the database on first run and are editable (enable /
 * disable) from the admin UI. The engine reads them from the database, not
 * from this file, so operators can change behaviour without a deploy.
 */
export const DEFAULT_RULES: RuleDefinition[] = [
  {
    id: "rule_hot_lead_escalation",
    name: "Hot lead escalation",
    description:
      "When the AI scores a lead 70 or above, page the sales channel immediately and open a call task due within the hour.",
    trigger: "lead.created",
    conditions: [{ field: "lead.score", op: "gte", value: 70 }],
    actions: [
      {
        type: "notify_slack",
        config: {
          channel: "#sales-hot",
          template:
            "🔥 Hot lead ({{lead.score}}/100): {{lead.name}} — {{lead.nextAction}}",
        },
      },
      {
        type: "create_task",
        config: { queue: "sales", title: "Call {{lead.name}} within 60 minutes", dueInMinutes: 60 },
      },
      {
        type: "send_email",
        config: {
          to: "{{lead.email}}",
          subject: "Your Best Auto enquiry — we're on it",
          template:
            "Assalamu alaikum {{lead.name}},\n\nThank you for getting in touch. One of our team is looking at your requirements now and will call you shortly.\n\n{{lead.summary}}\n\n— Best Auto",
        },
      },
    ],
    enabled: true,
  },
  {
    id: "rule_warm_lead_nurture",
    name: "Warm lead nurture",
    description: "Leads scoring 40-69 get a matched shortlist by email instead of a phone call.",
    trigger: "lead.created",
    conditions: [
      { field: "lead.score", op: "gte", value: 40 },
      { field: "lead.score", op: "lt", value: 70 },
    ],
    actions: [
      {
        type: "send_email",
        config: {
          to: "{{lead.email}}",
          subject: "Three cars picked for you",
          template:
            "Assalamu alaikum {{lead.name}},\n\nBased on what you told us, here are the closest matches on our fleet. Reply with your dates and we will hold one for you.\n\n{{lead.summary}}\n\n— Best Auto",
        },
      },
      { type: "tag_record", config: { entity: "lead", tag: "nurture-sequence" } },
    ],
    enabled: true,
  },
  {
    id: "rule_cold_lead_digest",
    name: "Cold lead digest",
    description: "Low-scoring leads are batched into a weekly digest rather than interrupting anyone.",
    trigger: "lead.created",
    conditions: [{ field: "lead.score", op: "lt", value: 40 }],
    actions: [{ type: "tag_record", config: { entity: "lead", tag: "weekly-digest" } }],
    enabled: true,
  },
  {
    id: "rule_booking_confirmation",
    name: "Booking confirmation",
    description:
      "Every confirmed booking triggers a customer confirmation, an ops notification and an inventory decrement.",
    trigger: "booking.created",
    conditions: [],
    actions: [
      {
        type: "send_email",
        config: {
          to: "{{booking.customerEmail}}",
          subject: "Booking {{booking.reference}} confirmed",
          template:
            "Assalamu alaikum {{booking.customerName}},\n\nYour {{booking.vehicleName}} is confirmed for {{booking.days}} days from {{booking.pickupDate}}, collecting from {{booking.pickupLocation}}. A driver is included; fuel is billed at cost.\n\nTotal: {{booking.total}}\nReference: {{booking.reference}}\n\n— Best Auto",
        },
      },
      { type: "adjust_inventory", config: { delta: -1 } },
      {
        type: "notify_slack",
        config: { channel: "#ops", template: "New booking {{booking.reference}} — {{booking.vehicleName}} ({{booking.total}})" },
      },
    ],
    enabled: true,
  },
  {
    id: "rule_high_value_booking",
    name: "High-value booking review",
    description:
      "Bookings over ৳50,000 get a manual NID verification task before the vehicle is released.",
    trigger: "booking.created",
    conditions: [{ field: "booking.totalValue", op: "gte", value: 50000 }],
    actions: [
      {
        type: "create_task",
        config: { queue: "risk", title: "Verify NID for {{booking.reference}} ({{booking.total}})", dueInMinutes: 240 },
      },
      {
        type: "notify_slack",
        config: { channel: "#risk", template: "High-value booking {{booking.reference}} at {{booking.total}} needs NID verification" },
      },
    ],
    enabled: true,
  },
  {
    id: "rule_cancellation_recovery",
    name: "Cancellation recovery",
    description: "A cancellation returns the unit to stock and offers the customer an alternative within a day.",
    trigger: "booking.cancelled",
    conditions: [],
    actions: [
      { type: "adjust_inventory", config: { delta: 1 } },
      {
        type: "send_email",
        config: {
          to: "{{booking.customerEmail}}",
          subject: "Sorry to see you go — a couple of alternatives",
          template:
            "Assalamu alaikum {{booking.customerName}},\n\nWe have cancelled {{booking.reference}} and released the hold. If it was the price or the dates, we usually have flexibility on both — just reply and we will take another look.\n\n— Best Auto",
        },
      },
    ],
    enabled: true,
  },
  {
    id: "rule_concierge_handoff",
    name: "Concierge handoff",
    description: "When the AI concierge cannot answer, a human is pulled into the same thread.",
    trigger: "conversation.handoff",
    conditions: [],
    actions: [
      {
        type: "notify_slack",
        config: { channel: "#support", template: "Concierge handed off session {{conversation.sessionId}} — needs a human" },
      },
      { type: "create_task", config: { queue: "support", title: "Take over chat {{conversation.sessionId}}", dueInMinutes: 15 } },
    ],
    enabled: true,
  },
  {
    id: "rule_daily_ops_digest",
    name: "Daily operations digest",
    description:
      "A scheduled job posts yesterday's revenue, bookings and idle capacity to the ops channel each morning.",
    trigger: "schedule.daily",
    conditions: [],
    actions: [
      {
        type: "notify_slack",
        config: {
          channel: "#ops",
          template:
            "Daily digest — revenue {{metrics.revenue}}, {{metrics.bookings}} bookings, {{metrics.hotLeads}} hot leads waiting",
        },
      },
      { type: "post_webhook", config: { url: "{{env.OPS_WEBHOOK_URL}}", event: "daily.digest" } },
    ],
    enabled: true,
  },
];
