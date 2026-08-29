/**
 * The outbox state machine.
 *
 * The outbox is what makes "a failing vendor never loses a message" true
 * rather than aspirational, and the whole guarantee rests on three numbers:
 * how long to wait, how long is too long, and how many attempts is enough.
 * All three used to be inline in a SQL UPDATE, so nothing could check them
 * without a database. `planOutboxRetry` is the same policy as a pure function.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_BACKOFF_MS, MAX_OUTBOX_ATTEMPTS, planOutboxRetry } from "../src/automation/outbox";

describe("outbox backoff", () => {
  it("grows exponentially", () => {
    // attempts-so-far → the wait before the next try.
    const waits = [0, 1, 2, 3].map((attempts) => planOutboxRetry(attempts, "boom").backoffMs);

    assert.deepEqual(waits, [60_000, 120_000, 240_000, 480_000]);
    for (let i = 1; i < waits.length; i++) {
      assert.equal(waits[i], waits[i - 1] * 2, "each wait doubles the previous one");
    }
  });

  it("is capped at one hour", () => {
    assert.equal(MAX_BACKOFF_MS, 60 * 60_000);
    // Far past the point where doubling would run away — a message left to
    // retry for a week must still come back within the hour once the vendor
    // recovers.
    for (const attempts of [6, 10, 40, 1000]) {
      const plan = planOutboxRetry(attempts, "boom", Number.MAX_SAFE_INTEGER);
      assert.equal(plan.backoffMs, MAX_BACKOFF_MS, `attempt ${attempts} exceeded the ceiling`);
    }
  });

  it("never schedules a retry in the past", () => {
    for (let attempts = 0; attempts < 12; attempts++) {
      assert.ok(planOutboxRetry(attempts, "boom").backoffMs > 0);
    }
  });
});

describe("outbox death", () => {
  it("flips to dead exactly at MAX_ATTEMPTS, not before", () => {
    // `attempts` is the count *before* this failure, so the message dies on
    // the failure that takes it to MAX_OUTBOX_ATTEMPTS — the sixth, not the
    // fifth and not the seventh.
    for (let attempts = 0; attempts < MAX_OUTBOX_ATTEMPTS - 1; attempts++) {
      const plan = planOutboxRetry(attempts, "boom");
      assert.equal(plan.dead, false, `died early at attempt ${plan.attempts}`);
      assert.equal(plan.status, "queued");
    }

    const fatal = planOutboxRetry(MAX_OUTBOX_ATTEMPTS - 1, "boom");
    assert.equal(fatal.attempts, MAX_OUTBOX_ATTEMPTS);
    assert.equal(fatal.dead, true);
    assert.equal(fatal.status, "dead");
  });

  it("stays dead once past the limit", () => {
    const plan = planOutboxRetry(MAX_OUTBOX_ATTEMPTS + 3, "boom");
    assert.equal(plan.dead, true);
    assert.equal(plan.status, "dead");
  });

  it("honours a caller-supplied limit", () => {
    assert.equal(planOutboxRetry(0, "boom", 2).dead, false);
    assert.equal(planOutboxRetry(1, "boom", 2).dead, true);
    // A limit of one means the first failure is terminal.
    assert.equal(planOutboxRetry(0, "boom", 1).dead, true);
  });

  it("counts each failure exactly once", () => {
    assert.equal(planOutboxRetry(0, "boom").attempts, 1);
    assert.equal(planOutboxRetry(4, "boom").attempts, 5);
  });
});

describe("outbox lastError", () => {
  it("keeps the vendor's own words, which is the point of the column", () => {
    const plan = planOutboxRetry(0, "Resend responded 422: sender domain not verified");
    assert.equal(plan.lastError, "Resend responded 422: sender domain not verified");
  });

  it("truncates to what the column holds", () => {
    const plan = planOutboxRetry(0, "x".repeat(5_000));
    assert.equal(plan.lastError.length, 500);
  });

  it("records an error on a dead message too, so the failure is legible", () => {
    const plan = planOutboxRetry(MAX_OUTBOX_ATTEMPTS - 1, "Resend responded 500");
    assert.equal(plan.dead, true);
    assert.equal(plan.lastError, "Resend responded 500");
  });
});
