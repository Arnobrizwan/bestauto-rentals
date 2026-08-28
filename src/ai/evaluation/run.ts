/**
 * AI evaluation harness.
 *
 * Runs the golden cases against whichever engine is configured and prints a
 * scorecard. Exits non-zero below the pass threshold so it can gate CI.
 *
 * Run with: npm run eval
 */
import { runConcierge } from "@/ai/agents/concierge";
import { qualifyLead } from "@/ai/agents/lead-qualifier";
import { recommendVehicles } from "@/ai/agents/recommender";
import { describeEngine, resolveProvider } from "@/ai/provider";

import { CONCIERGE_CASES, QUALIFIER_CASES, RECOMMENDER_CASES } from "./cases";

/**
 * How much failure is tolerated, and why it depends on the engine.
 *
 * A hosted model rephrases itself between runs, so a small tolerance stops a
 * wording change failing the build. The deterministic engine has no such
 * variance: the same input produces the same answer every time, so any failing
 * check is a defect rather than noise.
 *
 * This distinction is not academic. A real parsing bug — the word "budget"
 * being read as a request for a small car, so a party of six was told nothing
 * matched — scored 96.9% and sailed through a flat 85% gate. Under the rules
 * engine the bar is now every check.
 */
const HOSTED_PASS_THRESHOLD = 0.85;
const RULES_PASS_THRESHOLD = 1;

type Check = { name: string; passed: boolean; detail: string };
type CaseResult = { suite: string; id: string; description: string; checks: Check[]; latencyMs: number };

const results: CaseResult[] = [];

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function runConciergeSuite() {
  for (const testCase of CONCIERGE_CASES) {
    const started = Date.now();
    const reply = await runConcierge(testCase.turns, {
      // Evals must never write to the leads table.
      createLead: async () => ({ id: "eval", tier: "warm", score: 50 }),
    });
    const checks: Check[] = [];
    const text = reply.message.toLowerCase();

    if (testCase.expect.mentionsAny) {
      const hit = testCase.expect.mentionsAny.find((m) => text.includes(m.toLowerCase()));
      checks.push({
        name: `mentions one of [${testCase.expect.mentionsAny.join(", ")}]`,
        passed: Boolean(hit),
        detail: hit ? `found "${hit}"` : `none present`,
      });
    }
    if (testCase.expect.mustNotMention) {
      const bad = testCase.expect.mustNotMention.find((m) => text.includes(m.toLowerCase()));
      checks.push({ name: "avoids forbidden phrases", passed: !bad, detail: bad ? `said "${bad}"` : "clean" });
    }
    if (testCase.expect.usesTool) {
      const used = reply.toolCalls.some((t) => t.name === testCase.expect.usesTool);
      checks.push({
        name: `calls ${testCase.expect.usesTool}`,
        passed: used,
        detail: used ? "called" : `called [${reply.toolCalls.map((t) => t.name).join(", ") || "nothing"}]`,
      });
    }
    if (testCase.expect.returnsVehicles !== undefined) {
      const has = reply.vehicles.length > 0;
      checks.push({
        name: testCase.expect.returnsVehicles ? "returns vehicles" : "returns no vehicles",
        passed: has === testCase.expect.returnsVehicles,
        detail: `${reply.vehicles.length} returned`,
      });
    }
    if (testCase.expect.seatsAtLeast) {
      // "Returned something" is too weak an assertion: the bug this guards
      // against returned nothing, but the near miss returns cars too small.
      const need = testCase.expect.seatsAtLeast;
      const tooSmall = reply.vehicles.filter((v) => v.seats < need);
      checks.push({
        name: `every car seats at least ${need}`,
        passed: reply.vehicles.length > 0 && tooSmall.length === 0,
        detail:
          reply.vehicles.length === 0
            ? "no vehicles returned"
            : `${reply.vehicles.map((v) => `${v.name} (${v.seats})`).join(", ")}`,
      });
    }
    if (testCase.expect.handoff !== undefined) {
      checks.push({
        name: "flags handoff",
        passed: reply.handoff === testCase.expect.handoff,
        detail: `handoff=${reply.handoff}`,
      });
    }
    if (testCase.expect.maxWords) {
      const words = reply.message.split(/\s+/).filter(Boolean).length;
      checks.push({
        name: `stays under ${testCase.expect.maxWords} words`,
        passed: words <= testCase.expect.maxWords,
        detail: `${words} words`,
      });
    }

    // Applies to every case: the concierge must never quote a price it did not
    // obtain from a tool.
    const quotedMoney = /৳\s?\d/.test(reply.message);
    const PRICE_SOURCES = ["quote_price", "search_vehicles", "check_availability", "get_policy"];
    const pricedViaTool = reply.toolCalls.some((t) => PRICE_SOURCES.includes(t.name));
    checks.push({
      name: "no unsourced prices",
      passed: !quotedMoney || pricedViaTool,
      detail: quotedMoney ? (pricedViaTool ? "priced from a tool" : "quoted money with no tool call") : "no price quoted",
    });

    results.push({
      suite: "concierge",
      id: testCase.id,
      description: testCase.description,
      checks,
      latencyMs: Date.now() - started,
    });
  }
}

async function runRecommenderSuite() {
  for (const testCase of RECOMMENDER_CASES) {
    const started = Date.now();
    const result = await recommendVehicles(testCase.brief);
    const checks: Check[] = [];

    if (testCase.expect.count) {
      checks.push({
        name: `returns ${testCase.expect.count} picks`,
        passed: result.picks.length === testCase.expect.count,
        detail: `${result.picks.length} returned`,
      });
    }
    if (testCase.expect.minSeats) {
      const bad = result.picks.filter((p) => p.seats < testCase.expect.minSeats!);
      checks.push({
        name: `every pick seats ${testCase.expect.minSeats}+`,
        passed: bad.length === 0,
        detail: bad.length ? `${bad.map((b) => `${b.name}(${b.seats})`).join(", ")}` : "all fit",
      });
    }
    if (testCase.expect.maxPricePerDay) {
      const lead = result.picks[0];
      checks.push({
        name: `top pick under ৳${testCase.expect.maxPricePerDay}/day`,
        passed: Boolean(lead) && lead.pricePerDay <= testCase.expect.maxPricePerDay,
        detail: lead ? `৳${lead.pricePerDay}` : "no picks",
      });
    }
    if (testCase.expect.segmentIn) {
      const lead = result.picks[0];
      checks.push({
        name: `top pick in [${testCase.expect.segmentIn.join(", ")}]`,
        passed: Boolean(lead) && testCase.expect.segmentIn.includes(lead.segment),
        detail: lead ? lead.segment : "no picks",
      });
    }

    if (testCase.expect.transmission) {
      const wrong = result.picks.filter((p) => p.transmission !== testCase.expect.transmission);
      checks.push({
        name: `every pick is ${testCase.expect.transmission}`,
        passed: wrong.length === 0,
        detail: wrong.length ? wrong.map((w) => `${w.name}(${w.transmission})`).join(", ") : "all match",
      });
    }

    checks.push({
      name: "every pick has a reason",
      passed: result.picks.every((p) => p.reason.trim().length > 10),
      detail: `${result.picks.filter((p) => p.reason.trim().length > 10).length}/${result.picks.length}`,
    });

    results.push({
      suite: "recommender",
      id: testCase.id,
      description: testCase.description,
      checks,
      latencyMs: Date.now() - started,
    });
  }
}

async function runQualifierSuite() {
  for (const testCase of QUALIFIER_CASES) {
    const started = Date.now();
    const scored = await qualifyLead(testCase.lead);
    const checks: Check[] = [
      {
        name: `tier is ${testCase.expect.tier}`,
        passed: scored.tier === testCase.expect.tier,
        detail: `${scored.tier} (${scored.score}/100)`,
      },
      {
        name: "produces at least two signals",
        passed: scored.signals.length >= 2,
        detail: `${scored.signals.length} signals`,
      },
      {
        name: "next action is actionable",
        passed: scored.nextAction.trim().length > 10,
        detail: scored.nextAction.slice(0, 60),
      },
    ];

    results.push({
      suite: "qualifier",
      id: testCase.id,
      description: testCase.description,
      checks,
      latencyMs: Date.now() - started,
    });
  }
}

async function main() {
  const engine = describeEngine(resolveProvider());
  console.log(`\nBest Auto — AI evaluation`);
  console.log(dim(`engine: ${engine.engine} (${engine.model})\n`));

  await runConciergeSuite();
  await runRecommenderSuite();
  await runQualifierSuite();

  let totalChecks = 0;
  let passedChecks = 0;
  let currentSuite = "";

  for (const result of results) {
    if (result.suite !== currentSuite) {
      currentSuite = result.suite;
      console.log(`\n  ${currentSuite.toUpperCase()}`);
    }
    const failures = result.checks.filter((c) => !c.passed);
    totalChecks += result.checks.length;
    passedChecks += result.checks.length - failures.length;

    const mark = failures.length === 0 ? green("PASS") : red("FAIL");
    console.log(`  ${mark}  ${result.id.padEnd(22)} ${dim(`${result.latencyMs}ms`)}  ${result.description}`);
    for (const failure of failures) console.log(red(`         - ${failure.name}: ${failure.detail}`));
  }

  const rate = totalChecks === 0 ? 0 : passedChecks / totalChecks;
  const suites = [...new Set(results.map((r) => r.suite))];
  const threshold = resolveProvider() ? HOSTED_PASS_THRESHOLD : RULES_PASS_THRESHOLD;

  console.log(`\n  ${passedChecks}/${totalChecks} checks passed (${(rate * 100).toFixed(1)}%) across ${suites.length} suites`);
  console.log(
    `  threshold ${(threshold * 100).toFixed(0)}% (${resolveProvider() ? "hosted model — wording varies between runs" : "rules engine — deterministic, so every check must pass"})\n`,
  );

  process.exit(rate >= threshold ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
