/**
 * The concierge slot parser.
 *
 * Everything the concierge does downstream — the fleet query, the follow-up
 * question, the lead it captures — is built from these slots, and both engines
 * share them, so a parser mistake is a wrong answer in every mode at once.
 * Two real shipped bugs are pinned here: "budget" read as a size signal, and a
 * grouped amount read as zero.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SMALL_SEGMENT_MAX_SEATS, extractSlots, type Slots } from "../src/ai/agents/concierge";

/** One user turn through the parser. */
function slots(message: string, previous: Slots = {}): Slots {
  return extractSlots([{ role: "user", content: message }], previous);
}

describe("budget is a price signal, not a size one", () => {
  it('does not infer segment "small" from "budget 9000 taka"', () => {
    // The shipped bug: "budget" and "cheap" were treated as requests for the
    // small fleet, so "six of us, budget 9,000 taka" filtered down to
    // five-seat cars and returned nothing at all.
    assert.equal(slots("budget 9000 taka").segment, undefined);
    assert.equal(slots("I need something cheap").segment, undefined);
    assert.equal(slots("what is your most economical option").segment, "small"); // adjective, not price
  });

  it("parses a stated budget as budgetPerDay", () => {
    assert.equal(slots("budget 9000 taka").budgetPerDay, 9000);
    assert.equal(slots("9000 taka per day").budgetPerDay, 9000);
    assert.equal(slots("under 9000 a day").budgetPerDay, 9000);
    assert.equal(slots("tk 4500 a day").budgetPerDay, 4500);
    assert.equal(slots("৳9000 a day").budgetPerDay, 9000);
    assert.equal(slots("my budget is 9000").budgetPerDay, 9000);
  });

  it("reads a grouped amount as the whole number, not its last three digits", () => {
    // "9,000 taka per day" used to parse as 0, which sets priceMax to 0 and
    // returns an empty fleet — a stated budget turning into no cars at all.
    assert.equal(slots("9,000 taka per day").budgetPerDay, 9000);
    assert.equal(slots("under 12,000 a day").budgetPerDay, 12000);
    assert.equal(slots("tk 9,500 per day").budgetPerDay, 9500);
  });

  it("keeps budget and party size independent", () => {
    const parsed = slots("six of us, budget 9,000 taka");
    assert.equal(parsed.passengers, 6);
    assert.equal(parsed.budgetPerDay, 9000);
    assert.equal(parsed.segment, undefined, "a price never narrows the fleet by size");
  });
});

describe("party size overrides an inferred segment", () => {
  it("drops a small segment when the party will not fit in it", () => {
    for (const message of [
      `small car, ${SMALL_SEGMENT_MAX_SEATS + 2} people`,
      "compact car for 8 passengers",
      "a city car, seven of us",
    ]) {
      assert.equal(slots(message).segment, undefined, `"${message}" kept a segment it cannot seat`);
    }
  });

  it("keeps a small segment when the party does fit", () => {
    assert.equal(slots(`small car for ${SMALL_SEGMENT_MAX_SEATS} people`).segment, "small");
    assert.equal(slots("a small car for the city").segment, "small");
  });

  it("leaves a large segment alone — the constraint is about seats, not adjectives", () => {
    const parsed = slots("SUV for 7 people");
    assert.equal(parsed.segment, "large");
    assert.equal(parsed.passengers, 7);
  });

  it("carries the override across turns", () => {
    // The segment was inferred on an earlier turn; the count arrives later.
    const first = slots("looking for a small car");
    assert.equal(first.segment, "small");
    assert.equal(slots("actually there are 8 of us", first).segment, undefined);
  });
});

describe("segment inference", () => {
  it('reads size words as "large"', () => {
    for (const message of ["I want an SUV", "7 seater please", "microbus for the team", "we need a van", "a big car"]) {
      assert.equal(slots(message).segment, "large", `"${message}" did not read as large`);
    }
  });

  it('reads occasion and prestige words as "exclusive"', () => {
    for (const message of ["wedding car", "luxury car for the weekend", "something VIP", "a premium sedan"]) {
      assert.equal(slots(message).segment, "exclusive", `"${message}" did not read as exclusive`);
    }
  });

  it("leaves the segment unset when nothing was said about size", () => {
    assert.equal(slots("I need a car on Friday").segment, undefined);
  });
});
