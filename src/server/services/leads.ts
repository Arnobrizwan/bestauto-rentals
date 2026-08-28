import { qualifyLead, type LeadInput } from "@/ai/agents/lead-qualifier";
import { emit } from "@/automation/engine";
import { log } from "@/lib/observability/logger";
import { sanitizeText } from "@/lib/security/http";
import { insertLead } from "@/server/repositories/leads";

export type CreateLeadInput = LeadInput;

/**
 * Single intake path for every lead, whatever the source: sanitise, score with
 * the AI qualifier, persist, then publish an event the automation engine picks
 * up. Automation failures are logged but never surfaced to the caller.
 */
export async function createLead(input: CreateLeadInput) {
  const clean: CreateLeadInput = {
    ...input,
    name: sanitizeText(input.name, 120),
    email: input.email.trim().toLowerCase().slice(0, 200),
    phone: input.phone ? sanitizeText(input.phone, 40) : "",
    company: input.company ? sanitizeText(input.company, 120) : "",
    message: sanitizeText(input.message, 2000),
  };

  const scored = await qualifyLead(clean);

  const lead = await insertLead({
    id: `led_${crypto.randomUUID().slice(0, 12)}`,
    name: clean.name,
    email: clean.email,
    phone: clean.phone ?? "",
    company: clean.company ?? "",
    message: clean.message,
    intent: clean.intent ?? "enquiry",
    budgetPerDay: clean.budgetPerDay ?? null,
    timeframe: clean.timeframe ?? "unknown",
    partySize: clean.partySize ?? null,
    score: scored.score,
    tier: scored.tier,
    status: "new",
    aiSummary: scored.summary,
    aiSignals: scored.signals,
    aiNextAction: scored.nextAction,
    aiEngine: scored.engine.engine,
    source: clean.source ?? "web",
  });

  log.info("lead.created", { leadId: lead.id, tier: lead.tier, score: lead.score, engine: scored.engine.engine });

  const runs = await emit("lead.created", {
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      score: lead.score,
      tier: lead.tier,
      summary: lead.aiSummary,
      nextAction: lead.aiNextAction,
      intent: lead.intent,
      source: lead.source,
    },
  });

  return { lead, scored, automation: runs };
}
