/**
 * The money path.
 *
 * `quote` decides what a customer is charged and had no assertions at all.
 * That is how the airport-pickup bug survived: the tool registry documented it
 * as a one-off, the booking form billed it once, and the server billed it per
 * day, so a five-day hire previewed at BDT 1,500 and charged BDT 7,500. The
 * first test below is that bug, written down.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { durationDiscount, extraTotal } from "../src/lib/pricing";
import { refundFor } from "../src/server/repositories/sales";
import { dayCount, priceCoupon, quote } from "../src/server/services/bookings";

describe("extras", () => {
  it("bills a one-off extra once, however long the hire", () => {
    assert.equal(extraTotal("Airport pickup", 1), 1500);
    assert.equal(extraTotal("Airport pickup", 5), 1500);
    assert.equal(extraTotal("Airport pickup", 30), 1500);
  });

  it("bills every other extra per day", () => {
    assert.equal(extraTotal("Child seat", 1), 500);
    assert.equal(extraTotal("Child seat", 4), 2000);
  });

  it("ignores an extra it does not sell", () => {
    assert.equal(extraTotal("Helicopter transfer", 3), 0);
  });
});

describe("duration discount", () => {
  it("steps at the published thresholds and nowhere else", () => {
    assert.equal(durationDiscount(1), 0);
    assert.equal(durationDiscount(2), 0);
    assert.equal(durationDiscount(3), 0.05);
    assert.equal(durationDiscount(6), 0.05);
    assert.equal(durationDiscount(7), 0.12);
    assert.equal(durationDiscount(13), 0.12);
    assert.equal(durationDiscount(14), 0.18);
    assert.equal(durationDiscount(27), 0.18);
    assert.equal(durationDiscount(28), 0.25);
  });
});

describe("quote", () => {
  it("prices a plain hire with no discount", () => {
    const q = quote(4500, 2, []);
    assert.equal(q.base, 9000);
    assert.equal(q.discount, 0);
    assert.equal(q.total, 9000);
  });

  it("applies the multi-day discount to the base only", () => {
    const q = quote(4500, 5, []);
    assert.equal(q.base, 22500);
    assert.equal(q.discountRate, 0.05);
    assert.equal(q.discount, 1125);
    assert.equal(q.total, 21375);
  });

  it("adds a one-off extra once, not once a day", () => {
    const q = quote(4500, 5, ["Airport pickup"]);
    assert.equal(q.extrasTotal, 1500, "airport pickup is charged for the hire, not the day");
    assert.equal(q.total, 22875);
  });

  it("keeps per-day and one-off extras straight in the same booking", () => {
    const q = quote(4500, 5, ["Airport pickup", "Child seat"]);
    assert.equal(q.extrasTotal, 1500 + 500 * 5);
  });

  it("discards an extra that is not on the price list", () => {
    const q = quote(4500, 3, ["Child seat", "Private jet"]);
    assert.equal(q.extras.length, 1);
    assert.equal(q.extrasTotal, 1500);
  });

  it("never discounts the extras", () => {
    const q = quote(1000, 28, ["Child seat"]);
    assert.equal(q.discountRate, 0.25);
    assert.equal(q.extrasTotal, 500 * 28);
    assert.equal(q.total, 28000 - 7000 + 14000);
  });
});

describe("dayCount", () => {
  it("counts a part day as a whole one, and never returns zero", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    assert.equal(dayCount(at(9), at(10)), 1);
    assert.equal(dayCount(at(0), new Date(Date.UTC(2026, 0, 4))), 3);
    assert.equal(dayCount(at(9), at(9)), 1);
  });
});

describe("coupons", () => {
  const base = { id: "c1", code: "TEST", minDays: 1, usageLimit: 0, usedCount: 0, live: true };

  it("takes a percentage off the discounted subtotal", () => {
    const out = priceCoupon({ ...base, kind: "percent", value: 10 }, 20000, 3);
    assert.equal(out.ok && out.discount, 2000);
  });

  it("caps a flat code at the subtotal so a total cannot go negative", () => {
    const out = priceCoupon({ ...base, kind: "flat", value: 9000 }, 4000, 1);
    assert.equal(out.ok && out.discount, 4000);
  });

  it("refuses a code below its minimum stay", () => {
    const out = priceCoupon({ ...base, kind: "flat", value: 500, minDays: 3 }, 20000, 2);
    assert.equal(out.ok, false);
  });

  it("refuses an inactive code and one that is fully redeemed", () => {
    assert.equal(priceCoupon({ ...base, kind: "flat", value: 500, live: false }, 20000, 3).ok, false);
    assert.equal(
      priceCoupon({ ...base, kind: "flat", value: 500, usageLimit: 5, usedCount: 5 }, 20000, 3).ok,
      false,
    );
  });
});

describe("cancellation refunds", () => {
  const pickup = new Date(Date.UTC(2026, 0, 10, 12));

  it("refunds in full beyond 48 hours' notice", () => {
    const out = refundFor(10000, new Date(Date.UTC(2026, 0, 7, 12)), pickup);
    assert.equal(out.refund, 10000);
    assert.equal(out.band, "full refund");
  });

  it("retains half inside 48 hours", () => {
    const out = refundFor(10000, new Date(Date.UTC(2026, 0, 9, 12)), pickup);
    assert.equal(out.refund, 5000);
    assert.equal(out.retained, 5000);
  });

  it("retains everything on a no-show", () => {
    const out = refundFor(10000, new Date(Date.UTC(2026, 0, 11, 12)), pickup);
    assert.equal(out.refund, 0);
    assert.equal(out.band, "no-show");
  });
});
