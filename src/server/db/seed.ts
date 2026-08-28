/**
 * Idempotent seed. Truncates the demo tables and rebuilds them from the
 * deterministic generator, then scores every seeded lead with the AI qualifier
 * so the admin lead board reflects the real scoring model.
 *
 * Run with: npm run db:seed
 */
import { rulesQualify } from "@/ai/agents/lead-qualifier";
import { DEFAULT_RULES } from "@/automation/rules";
import { hashPassword } from "@/lib/auth/password";

import { db } from "./client";
import { buildSeed } from "./seed-data";
import {
  adminUsers,
  automationRules,
  automationRuns,
  bookings,
  conversations,
  customers,
  events,
  leads,
  messages,
  outbox,
  vehicles,
} from "./schema";

async function chunked<T>(rows: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const started = Date.now();
  console.log("Seeding Best Auto...");

  // Order matters only for readability — there are no FK constraints declared,
  // so the app can tolerate partial data during a rolling seed.
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(automationRuns);
  await db.delete(outbox);
  await db.delete(events);
  await db.delete(automationRules);
  await db.delete(adminUsers);
  await db.delete(bookings);
  await db.delete(leads);
  await db.delete(customers);
  await db.delete(vehicles);

  const seed = buildSeed();

  await chunked(seed.vehicles, 50, (batch) => db.insert(vehicles).values(batch));
  console.log(`  vehicles   ${seed.vehicles.length}`);

  await chunked(seed.customers, 100, (batch) => db.insert(customers).values(batch));
  console.log(`  customers  ${seed.customers.length}`);

  await chunked(seed.bookings, 200, (batch) => db.insert(bookings).values(batch));
  console.log(`  bookings   ${seed.bookings.length}`);

  const scoredLeads = seed.leads.map((lead) => {
    const scored = rulesQualify({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      message: lead.message,
      intent: lead.intent,
      budgetPerDay: lead.budgetPerDay,
      timeframe: lead.timeframe,
      partySize: lead.partySize,
      source: lead.source,
    });
    return {
      ...lead,
      score: scored.score,
      tier: scored.tier,
      status: scored.tier === "hot" ? "contacted" : "new",
      aiSummary: scored.summary,
      aiSignals: scored.signals,
      aiNextAction: scored.nextAction,
      aiEngine: "heuristic",
    };
  });

  await chunked(scoredLeads, 100, (batch) => db.insert(leads).values(batch));
  console.log(
    `  leads      ${scoredLeads.length} (${scoredLeads.filter((l) => l.tier === "hot").length} hot)`,
  );

  // Admin account. Credentials come from the environment so a real deployment
  // never inherits a password that is written down in the repository.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "ops@bestauto.co.uk").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required so the seed never creates an account with a default password.",
    );
  }
  await db.insert(adminUsers).values({
    id: "adm_001",
    email: adminEmail,
    name: process.env.SEED_ADMIN_NAME ?? "Mike Witzel",
    passwordHash: await hashPassword(adminPassword),
    role: "admin",
  });
  console.log(`  admin      1 (${adminEmail})`);

  await db.insert(automationRules).values(
    DEFAULT_RULES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      trigger: r.trigger,
      conditions: r.conditions,
      actions: r.actions,
      enabled: r.enabled,
    })),
  );
  console.log(`  rules      ${DEFAULT_RULES.length}`);

  console.log(`Done in ${Date.now() - started}ms.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
