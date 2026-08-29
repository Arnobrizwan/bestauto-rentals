/**
 * What a model hands back is not trusted.
 *
 * The bug these guard: the operations brief rendered `53.6015004126` as a
 * metric chip because the hosted path cast the model's JSON instead of
 * checking it, and passed the raw string to the dashboard.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
