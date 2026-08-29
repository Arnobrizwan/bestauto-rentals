/**
 * What a model hands back is not trusted.
 *
 * The bug these guard: the operations brief rendered `53.6015004126` as a
 * metric chip because the hosted path cast the model's JSON instead of
 * checking it, and passed the raw string to the dashboard.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseInsightsResponse } from "../src/ai/agents/ops-analyst";
import { clampScore, normaliseMetric } from "../src/ai/validation";

describe("normaliseMetric", () => {
  it("repairs the raw float that shipped to the dashboard", () => {
    assert.equal(normaliseMetric(53.6015004126, "Revenue up sharply"), "+53.6% revenue");
  });

  it("never renders more than one decimal place", () => {
    for (const value of [53.6015004126, "12.98765", 0.049, 99.999, -7.7777]) {
      const out = normaliseMetric(value, "utilisation");
      const decimals = out.match(/\.(\d+)/)?.[1]?.length ?? 0;
      assert.ok(decimals <= 1, `${out} carries ${decimals} decimals`);
    }
  });

  it("never exceeds 24 characters", () => {
    assert.ok(normaliseMetric("a".repeat(200)).length <= 24);
    assert.ok(normaliseMetric(123456.789, "revenue").length <= 24);
  });

  it("infers the unit from the surrounding wording", () => {
    assert.equal(normaliseMetric(4, "Fleet utilisation is low"), "4% utilisation");
    assert.equal(normaliseMetric(31, "Total bookings"), "31 bookings");
    assert.equal(normaliseMetric(12, "New leads this week"), "12 leads");
  });

  it("signs a change but not a count", () => {
    assert.equal(normaliseMetric(9.5, "Revenue up on last week"), "+9.5% revenue");
    assert.equal(normaliseMetric(31, "Total bookings"), "31 bookings");
  });

  it("leaves a string that is already a display value alone", () => {
    assert.equal(normaliseMetric("+53.6% revenue", "Revenue up"), "+53.6% revenue");
    assert.equal(normaliseMetric("4% utilisation", "utilisation"), "4% utilisation");
  });

  it("parses a bare numeric string as a number, not as text", () => {
    assert.equal(normaliseMetric("53.6015004126", "Revenue up"), "+53.6% revenue");
  });

  it("survives what a model should never send", () => {
    assert.equal(normaliseMetric(null), "");
    assert.equal(normaliseMetric(undefined), "");
    assert.equal(normaliseMetric(Number.NaN, "revenue"), "NaN");
    assert.equal(normaliseMetric(Number.POSITIVE_INFINITY, "revenue"), "Infinity");
  });
});

describe("clampScore", () => {
  it("rounds to an integer inside the range", () => {
    assert.equal(clampScore(82.4), 82);
    assert.equal(clampScore("80"), 80);
    assert.equal(clampScore(9.7, 0, 100), 10);
  });

  it("clamps a model that ignores the range", () => {
    assert.equal(clampScore(140), 100);
    assert.equal(clampScore(-20), 0);
  });

  it("returns null for something that is not a number, so a caller can fall back", () => {
    assert.equal(clampScore("hot"), null);
    assert.equal(clampScore(undefined), null);
    assert.equal(clampScore(Number.NaN), null);
  });
});

/**
 * The acceptance case, end to end over the real parse path.
 *
 * A hosted model is not reachable from CI, so this feeds the raw text a model
 * returns straight into the function `generateInsights` calls, and asserts on
 * the chips the dashboard would render.
 */
describe("the operations brief, given what a model actually returns", () => {
  /** The response that shipped the bug: raw floats where a display string belongs. */
  const RAW_FLOATS = JSON.stringify({
    insights: [
      {
        title: "Revenue up sharply",
        detail: "Revenue is well ahead of the previous period.",
        severity: "positive",
        metric: 53.6015004126,
      },
      {
        title: "Idle capacity",
        detail: "The small segment is barely moving; utilisation is low.",
        severity: "warning",
        metric: "4.0000001",
      },
      {
        title: "Concierge is converting",
        detail: "Bookings attributed to the AI concierge.",
        severity: "neutral",
        metric: 31,
      },
    ],
  });

  it("renders a unit-bearing chip with at most one decimal place", () => {
    const insights = parseInsightsResponse(RAW_FLOATS);
    const chips = insights.map((i) => i.metric);

    assert.deepEqual(chips, ["+53.6% revenue", "4% utilisation", "31 bookings"]);
    for (const chip of chips) {
      assert.ok(chip.length <= 24, `"${chip}" is longer than a chip`);
      assert.ok(/[%a-z]/i.test(chip), `"${chip}" carries no unit`);
      assert.ok((chip.match(/\.(\d+)/)?.[1]?.length ?? 0) <= 1, `"${chip}" carries more than one decimal`);
    }
  });

  it("reads a fenced response, which is what a model sends when asked for JSON", () => {
    const fenced = "```json\n" + RAW_FLOATS + "\n```";
    assert.equal(parseInsightsResponse(fenced)[0].metric, "+53.6% revenue");
  });

  it("caps the brief at four insights however many the model sends", () => {
    const many = JSON.stringify({
      insights: Array.from({ length: 9 }, (_, i) => ({
        title: `Insight ${i}`,
        detail: "Something happened.",
        severity: "neutral",
        metric: `${i} bookings`,
      })),
    });
    assert.equal(parseInsightsResponse(many).length, 4);
  });

  it("throws on a malformed response, so the caller serves the rules engine", () => {
    const malformed = [
      "not json at all",
      "{}",
      JSON.stringify({ insights: [] }),
      // A severity the dashboard has no colour for.
      JSON.stringify({ insights: [{ title: "t", detail: "d", severity: "catastrophic", metric: "1%" }] }),
      // The whole payload as a string, which is a shape a cast would wave through.
      JSON.stringify({ insights: "revenue is up" }),
      JSON.stringify({ insights: [{ title: "t", detail: "d", severity: "positive" }] }),
      JSON.stringify({ insights: [{ title: "x".repeat(200), detail: "d", severity: "positive", metric: "1%" }] }),
    ];

    for (const text of malformed) {
      assert.throws(() => parseInsightsResponse(text), `"${text.slice(0, 40)}" should not have parsed`);
    }
  });
});
