/**
 * Intercity route pricing and the geo branch default.
 *
 * The policy corpus promised customers a fixed round-trip rate to Chattogram,
 * Sylhet and Cox's Bazar for as long as it has existed, and nothing could
 * quote one. These pin the arithmetic that finally can — and pin it to the
 * two numbers the business already publishes, so a rate cannot drift away from
 * the day rate printed beside it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BRANCH_COORDS, DEFAULT_BRANCH, branchForRequest, nearestBranch } from "../src/lib/geo";
import {
  DAILY_KM_ALLOWANCE,
  DRIVER_NIGHT_ALLOWANCE,
  PLACES,
  cityOfBranch,
  intercityQuote,
  intercityQuotesFrom,
  roadKm,
  routeBetween,
} from "../src/lib/intercity";

describe("estimated road distance", () => {
  it("uses the published road distance where there is one", () => {
    // Not the straight line: Dhaka to Khulna is 136km as the crow flies and
    // 270km by road, because the road goes where the bridges are. Quoting the
    // estimate would have under-charged that route by a third.
    const published: [string, string, number][] = [
      ["Dhaka", "Sylhet", 240],
      ["Dhaka", "Chattogram", 264],
      ["Chattogram", "Cox's Bazar", 152],
      ["Dhaka", "Khulna", 270],
    ];
    for (const [from, to, actual] of published) {
      const d = roadKm(from, to)!;
      assert.equal(d.km, actual, `${from}-${to}`);
      assert.equal(d.estimated, false, `${from}-${to} should not be an estimate`);
    }
  });

  it("says so when a distance is only an estimate", () => {
    const d = roadKm("Khulna", "Rajshahi")!;
    assert.equal(d.estimated, true);
    assert.ok(d.km > 0);
  });

  it("is symmetric, and nothing to itself", () => {
    assert.deepEqual(roadKm("Dhaka", "Khulna"), roadKm("Khulna", "Dhaka"));
    assert.deepEqual(roadKm("Chattogram", "Sylhet"), roadKm("Sylhet", "Chattogram"));
    assert.equal(roadKm("Dhaka", "Dhaka"), null);
    assert.equal(roadKm("Dhaka", "Atlantis"), null);
  });

  it("rounds an estimate to 10km rather than claiming precision it lacks", () => {
    for (const to of Object.keys(PLACES).filter((c) => c !== "Dhaka")) {
      const d = roadKm("Dhaka", to)!;
      if (d.estimated) assert.equal(d.km % 10, 0, `${to} was not rounded`);
    }
  });
});

describe("intercity round trips", () => {
  it("prices Dhaka to Chattogram off the published allowance", () => {
    const q = intercityQuote(5_500, "Dhaka", "Chattogram")!;

    assert.equal(q.roundTripKm, q.oneWayKm * 2);
    assert.equal(q.billableDays, Math.ceil(q.roundTripKm / DAILY_KM_ALLOWANCE));
    assert.equal(q.nights, q.billableDays - 1);
    assert.equal(q.base, q.billableDays * 5_500);
    assert.equal(q.driverAllowance, q.nights * DRIVER_NIGHT_ALLOWANCE);
    assert.equal(q.total, q.base + q.driverAllowance);
  });

  it("prices every pair of cities, not only routes out of Dhaka", () => {
    const cities = Object.keys(PLACES);
    for (const from of cities) {
      for (const to of cities) {
        const q = intercityQuote(5_000, from, to);
        if (from === to) {
          assert.equal(q, null, `${from} to itself is not an intercity trip`);
        } else {
          assert.ok(q, `${from} to ${to} could not be priced`);
          assert.ok(q.total > 0);
        }
      }
    }
  });

  it("quotes the same fare in either direction", () => {
    const there = intercityQuote(6_000, "Chattogram", "Sylhet")!;
    const back = intercityQuote(6_000, "Sylhet", "Chattogram")!;
    assert.equal(there.total, back.total);
  });

  it("moves with the vehicle's day rate, so the two cannot drift apart", () => {
    const cheap = intercityQuote(3_500, "Dhaka", "Chattogram")!;
    const dear = intercityQuote(20_000, "Dhaka", "Chattogram")!;

    assert.equal(dear.total - cheap.total, cheap.billableDays * (20_000 - 3_500));
    // The driver is paid the same whichever car he is driving.
    assert.equal(cheap.driverAllowance, dear.driverAllowance);
  });

  it("charges nights, not days, for the driver", () => {
    for (const q of intercityQuotesFrom(4_000, "Dhaka")) {
      assert.equal(q.nights, q.billableDays - 1, `${q.to} paid the wrong number of nights`);
      assert.ok(q.billableDays >= 1);
    }
  });

  it("charges more for a longer road", () => {
    const quotes = intercityQuotesFrom(5_000, "Dhaka");
    for (let i = 1; i < quotes.length; i++) {
      assert.ok(
        quotes[i].total >= quotes[i - 1].total,
        `${quotes[i].to} is farther than ${quotes[i - 1].to} but cheaper`,
      );
    }
  });

  it("uses the allowance the policy publishes", () => {
    // If this constant ever changes, the policy text has to change with it.
    assert.equal(DAILY_KM_ALLOWANCE, 120);
  });

  it("keeps the 4WD restriction attached to the hill route", () => {
    const bandarban = intercityQuotesFrom(9_000, "Dhaka").find((q) => q.to === "Bandarban");
    assert.ok(bandarban?.note?.includes("4WD"), "Bandarban must still say it needs a 4WD");
  });
});

describe("which city a branch is in", () => {
  it("reads the city out of the branch name", () => {
    assert.equal(cityOfBranch("Dhaka Banani"), "Dhaka");
    assert.equal(cityOfBranch("Chattogram Agrabad"), "Chattogram");
    assert.equal(cityOfBranch("Cox's Bazar"), "Cox's Bazar");
  });

  it("knows the airport is in Dhaka, though its name does not say so", () => {
    assert.equal(cityOfBranch("Hazrat Shahjalal Airport"), "Dhaka");
  });
});

describe("is this hire intercity", () => {
  it("is not, when both ends are the same city", () => {
    assert.equal(routeBetween("Dhaka Banani", "Dhaka Uttara"), null);
    assert.equal(routeBetween("Dhaka Gulshan", "Hazrat Shahjalal Airport"), null);
  });

  it("finds the route in either direction, between any two cities", () => {
    assert.deepEqual(routeBetween("Dhaka Banani", "Chattogram Agrabad"), { from: "Dhaka", to: "Chattogram" });
    assert.deepEqual(routeBetween("Chattogram Agrabad", "Sylhet City"), { from: "Chattogram", to: "Sylhet" });
    assert.deepEqual(routeBetween("Khulna City", "Rajshahi City"), { from: "Khulna", to: "Rajshahi" });
  });
});

describe("branch for the request's city", () => {
  it("opens on the branch that serves the visitor", () => {
    assert.equal(branchForRequest("Chittagong", "BD"), "Chattogram Agrabad");
    assert.equal(branchForRequest("Sylhet", "BD"), "Sylhet City");
    assert.equal(branchForRequest("Dhaka", "BD"), "Dhaka Gulshan");
  });

  it("handles the spellings the header actually sends", () => {
    assert.equal(branchForRequest("chittagong", "BD"), "Chattogram Agrabad");
    assert.equal(branchForRequest("Chattogram", "BD"), "Chattogram Agrabad");
    assert.equal(branchForRequest("Cox%27s%20Bazar", "BD"), "Cox's Bazar");
    assert.equal(branchForRequest("  Khulna  ", "BD"), "Khulna City");
  });

  it("falls back rather than guessing", () => {
    assert.equal(branchForRequest(undefined, undefined), DEFAULT_BRANCH);
    assert.equal(branchForRequest(null, "BD"), DEFAULT_BRANCH);
    assert.equal(branchForRequest("Barisal", "BD"), DEFAULT_BRANCH, "no branch there yet");
    assert.equal(branchForRequest("%E2%82%AC%%", "BD"), DEFAULT_BRANCH, "a malformed header is just unknown");
  });

  it("does not guess a branch for an overseas visitor", () => {
    // Someone booking from London wants a car in Dhaka, not a branch near them.
    assert.equal(branchForRequest("London", "GB"), DEFAULT_BRANCH);
    assert.equal(branchForRequest("Dubai", "AE"), DEFAULT_BRANCH);
  });
});

describe("nearest branch to a precise position", () => {
  it("picks the right side of Dhaka, which the IP city never could", () => {
    // Standing in Uttara. City-level geo says "Dhaka" and opens on Gulshan,
    // 11km south; a real fix picks the branch you can actually walk to.
    assert.equal(nearestBranch(23.8759, 90.3795), "Dhaka Uttara");
    assert.equal(nearestBranch(23.7461, 90.3742), "Dhaka Dhanmondi");
    assert.equal(nearestBranch(23.7331, 90.4172), "Dhaka Motijheel");
  });

  it("picks the right city from far away", () => {
    assert.equal(nearestBranch(22.3269, 91.8123), "Chattogram Agrabad");
    assert.equal(nearestBranch(24.8949, 91.8687), "Sylhet City");
    assert.equal(nearestBranch(21.4272, 92.0058), "Cox's Bazar");
  });

  it("never offers a branch the page is not showing", () => {
    const shown = ["Dhaka Gulshan", "Sylhet City"];
    // Physically nearest is Chattogram Agrabad, which is not on the list.
    assert.equal(nearestBranch(22.3269, 91.8123, shown), "Dhaka Gulshan");
    assert.ok(shown.includes(nearestBranch(24.3745, 88.6042, shown)));
  });

  it("falls back rather than throwing when nothing is available", () => {
    assert.equal(nearestBranch(23.8, 90.4, []), DEFAULT_BRANCH);
  });

  it("has coordinates for every branch the fleet uses", () => {
    // A branch without a position would silently never be chosen.
    for (const branch of Object.keys(BRANCH_COORDS)) {
      const { lat, lon } = BRANCH_COORDS[branch];
      assert.ok(lat > 20 && lat < 27, `${branch} latitude is not in Bangladesh`);
      assert.ok(lon > 88 && lon < 93, `${branch} longitude is not in Bangladesh`);
    }
  });
});
