/**
 * The automation engine's two pure functions.
 *
 * `evaluateConditions` decides whether a rule fires at all and `render` builds
 * what it sends, so between them they decide whether a customer gets an email
 * and what it says. Both were untested. The environment allowlist is covered
 * here too, because the failure it prevents — a rule interpolating
 * `{{env.SESSION_SECRET}}` into an outbound webhook — is silent.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateConditions, render } from "../src/automation/engine";

const lead = {
  lead: { name: "Rifat", tier: "hot", score: 82, email: "", company: "Chowdhury Group" },
  booking: { total: 62000, reference: "BA-ABC123" },
};

describe("evaluateConditions", () => {
  it("passes a rule with no conditions", () => {
    assert.equal(evaluateConditions([], lead), true);
  });

  it("requires every condition, not any", () => {
    assert.equal(
      evaluateConditions(
        [
          { field: "lead.tier", op: "eq", value: "hot" },
          { field: "lead.score", op: "gte", value: 80 },
        ],
        lead,
      ),
      true,
    );
    assert.equal(
      evaluateConditions(
        [
          { field: "lead.tier", op: "eq", value: "hot" },
          { field: "lead.score", op: "gte", value: 90 },
        ],
        lead,
      ),
      false,
    );
  });

  it("reads a nested path and treats a missing one as unmatched", () => {
    assert.equal(evaluateConditions([{ field: "booking.reference", op: "eq", value: "BA-ABC123" }], lead), true);
    assert.equal(evaluateConditions([{ field: "booking.nothing.here", op: "exists", value: null }], lead), false);
  });

  it("compares numbers numerically at the boundary", () => {
    // The high-value booking rule fires at exactly this figure.
    assert.equal(evaluateConditions([{ field: "booking.total", op: "gte", value: 50000 }], lead), true);
    assert.equal(evaluateConditions([{ field: "booking.total", op: "gt", value: 62000 }], lead), false);
    assert.equal(evaluateConditions([{ field: "booking.total", op: "gte", value: 62000 }], lead), true);
  });

  it("treats an empty string as absent for exists", () => {
    assert.equal(evaluateConditions([{ field: "lead.email", op: "exists", value: null }], lead), false);
    assert.equal(evaluateConditions([{ field: "lead.name", op: "exists", value: null }], lead), true);
  });

  it("matches contains case-insensitively and in on membership", () => {
    assert.equal(evaluateConditions([{ field: "lead.company", op: "contains", value: "chowdhury" }], lead), true);
    assert.equal(evaluateConditions([{ field: "lead.tier", op: "in", value: ["hot", "warm"] }], lead), true);
    assert.equal(evaluateConditions([{ field: "lead.tier", op: "in", value: ["cold"] }], lead), false);
  });
});

describe("render", () => {
  it("interpolates a nested value", () => {
    assert.equal(render("Hi {{lead.name}}, ref {{booking.reference}}", lead), "Hi Rifat, ref BA-ABC123");
  });

  it("blanks a missing key rather than printing undefined", () => {
    assert.equal(render("[{{lead.missing}}]", lead), "[]");
    assert.equal(render("[{{nothing.at.all}}]", lead), "[]");
  });

  it("tolerates whitespace inside the braces", () => {
    assert.equal(render("{{  lead.name  }}", lead), "Rifat");
  });

  it("leaves text with no placeholders untouched", () => {
    assert.equal(render("No placeholders here.", lead), "No placeholders here.");
  });

  it("reads only allowlisted environment variables", () => {
    process.env.OPS_WEBHOOK_URL = "https://ops.example.com/hook";
    process.env.SESSION_SECRET = "super-secret-signing-key";
    try {
      assert.equal(render("{{env.OPS_WEBHOOK_URL}}", lead), "https://ops.example.com/hook");
      // The whole point: an operator-editable rule must not be able to post
      // the signing key to a URL of its choosing.
      assert.equal(render("{{env.SESSION_SECRET}}", lead), "");
      assert.equal(render("{{env.DATABASE_URL}}", lead), "");
      assert.ok(!render("leak={{env.SESSION_SECRET}}", lead).includes("super-secret"));
    } finally {
      delete process.env.OPS_WEBHOOK_URL;
    }
  });
});
