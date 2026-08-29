/**
 * Hard constraints on the AI matcher.
 *
 * The public matcher posts `{ brief: "six of us, a week in Sylhet" }` and
 * nothing else — every structured field on the request is optional and the UI
 * fills none of them. The shipped bug followed from that: the hosted path
 * filtered on `brief.passengers` and `brief.transmission`, which are always
 * undefined in production, so party size, gearbox and fuel were enforced only
 * on the no-model fallback. It was intermittent in the way a missing filter
 * always is — the model usually got it right unaided, and when it did not,
 * nothing caught it. Live, that recommended a five-seat Premio to six people
 * and two automatics to someone who asked for a manual.
 *
 * The evaluation suite could not have caught it: CI runs with no vendor key,
 * so it grades the deterministic engine, which was the one path that worked.
 * These are pure functions, so they run on every `npm test`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { meetsHardConstraints, resolveBrief, rulesRecommend } from "../src/ai/agents/recommender";

const car = (seats: number, transmission: string, fuel: string) => ({ seats, transmission, fuel });

describe("the brief is resolved from free text, not read off the request", () => {
  it("reads the party size out of the sentence", () => {
    assert.equal(resolveBrief({ brief: "Six of us, a week in Sylhet, under 9000 taka a day" }).passengers, 6);
    assert.equal(resolveBrief({ brief: "Family of 6 driving to Sylhet" }).passengers, 6);
    assert.equal(resolveBrief({ brief: "ten of us going to Cox's Bazar" }).passengers, 10);
  });

  it("reads the gearbox out of the sentence", () => {
    assert.equal(resolveBrief({ brief: "I want a manual car for city driving" }).transmission, "Manual");
    assert.equal(resolveBrief({ brief: "something cheap and automatic for office runs" }).transmission, "Automatic");
    assert.equal(resolveBrief({ brief: "a car for the weekend" }).transmission, undefined);
  });

  it("reads the fuel out of the sentence", () => {
    assert.equal(resolveBrief({ brief: "a hybrid, I do a lot of miles" }).fuel, "Hybrid");
    assert.equal(resolveBrief({ brief: "diesel please" }).fuel, "Diesel");
  });

  it("lets an explicit field win over the text, so a caller can override", () => {
    const resolved = resolveBrief({ brief: "six of us", passengers: 4, transmission: "Manual" });
    assert.equal(resolved.passengers, 4);
    assert.equal(resolved.transmission, "Manual");
  });

  it("carries the budget and the occasion through as well", () => {
    const resolved = resolveBrief({ brief: "Wedding car, up to 30000 taka" });
    assert.equal(resolved.budgetPerDay, 30000);
    assert.equal(resolved.occasion, "special");
  });
});

describe("a car that fails a hard constraint is not a worse answer, it is the wrong one", () => {
  it("rejects a car that cannot seat the party", () => {
    // The live failure: a five-seat Premio recommended for six people.
    const brief = resolveBrief({ brief: "Six of us, a week in Sylhet, under 9000 taka a day" });
    assert.equal(meetsHardConstraints(car(5, "Automatic", "Octane"), brief), false);
    assert.equal(meetsHardConstraints(car(7, "Automatic", "Diesel"), brief), true);
    assert.equal(meetsHardConstraints(car(11, "Manual", "Diesel"), brief), true);
  });

  it("rejects the wrong gearbox", () => {
    // The live failure: a Swift and a Corolla, both automatic, offered to
    // someone who asked for a manual.
    const brief = resolveBrief({ brief: "I want a manual car for city driving" });
    assert.equal(meetsHardConstraints(car(5, "Automatic", "Petrol"), brief), false);
    assert.equal(meetsHardConstraints(car(5, "Manual", "Petrol"), brief), true);
  });

  it("rejects the wrong fuel", () => {
    const brief = resolveBrief({ brief: "a hybrid for the commute" });
    assert.equal(meetsHardConstraints(car(5, "Automatic", "Petrol"), brief), false);
    assert.equal(meetsHardConstraints(car(5, "Automatic", "Hybrid"), brief), true);
  });

  it("constrains nothing when the brief says nothing", () => {
    const brief = resolveBrief({ brief: "a car for the weekend" });
    assert.equal(meetsHardConstraints(car(2, "Manual", "Petrol"), brief), true);
  });
});

/**
 * When the fleet cannot satisfy the party, the answer still has to be the best
 * one available — and it has to say so.
 *
 * The hard filter falls back to the unfiltered pool when nothing qualifies,
 * which is right: answering "12 of us" with nothing is worse than answering it
 * with a caveat. But the seat penalty was flat, so an eleven-seater one seat
 * short scored the same as a five-seater seven short and price broke the tie —
 * live, "12 of us need transport" returned three five-seaters under the summary
 * "Matched on 12 people", which is the answer contradicting itself.
 */
describe("when nothing fits, the closest still leads and the summary admits it", () => {
  const fleet = [
    { slug: "hiace", name: "Toyota Hiace Microbus", seats: 11, bags: 8, transmission: "Manual", fuel: "Diesel", pricePerDay: "8000", costPerDay: "3100", rating: 4.5, segment: "large", bodyType: "Microbus", location: "Dhaka Motijheel", imageUrl: "", features: [], year: 2023, bookingCount: 3, revenue: 0, unitsFree: 4 },
    { slug: "corolla", name: "Toyota Corolla", seats: 5, bags: 3, transmission: "Automatic", fuel: "Octane", pricePerDay: "4000", costPerDay: "1600", rating: 4.7, segment: "small", bodyType: "Sedan", location: "Dhaka Gulshan", imageUrl: "", features: [], year: 2023, bookingCount: 9, revenue: 0, unitsFree: 6 },
    { slug: "vezel", name: "Honda Vezel", seats: 5, bags: 4, transmission: "Automatic", fuel: "Hybrid", pricePerDay: "6500", costPerDay: "2500", rating: 4.8, segment: "small", bodyType: "SUV", location: "Dhaka Gulshan", imageUrl: "", features: [], year: 2022, bookingCount: 7, revenue: 0, unitsFree: 3 },
  ] as never;

  it("leads with the largest vehicle when the party exceeds every car", async () => {
    const { picks } = await rulesRecommend({ brief: "12 of us need transport" }, fleet);
    assert.equal(picks[0]?.slug, "hiace", "the eleven-seater is one seat short; the others are seven");
  });

  it("does not claim a match it did not make", async () => {
    const { summary } = await rulesRecommend({ brief: "12 of us need transport" }, fleet);
    assert.ok(!/^Matched on/.test(summary), `summary should not claim a match, got: ${summary}`);
    assert.match(summary, /seats 12 on its own/);
  });

  it("still claims the match when one is genuinely made", async () => {
    const { summary, picks } = await rulesRecommend({ brief: "four of us going to Sylhet" }, fleet);
    assert.match(summary, /^Matched on/);
    assert.ok((picks[0]?.seats ?? 0) >= 4);
  });
});
