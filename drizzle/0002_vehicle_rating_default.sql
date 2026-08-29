-- A new car stops arriving with 4.6 stars nobody gave it.
--
-- `rating` defaulted to 4.6, so a vehicle inserted directly — a future seed, a
-- one-off fix, a backfill — went onto the public fleet advertising a score for
-- reviews that did not exist. POST /api/vehicles already set 0 explicitly,
-- which made the API path safe and left the column wrong: the harder version of
-- the bug, because nothing in the code you read looks incorrect.
--
-- Public surfaces already show "New" while review_count is 0, so 0 is the
-- honest starting point rather than a gap.
--
-- Applied with `npm run db:push`; kept here so the change is reviewable.

ALTER TABLE "vehicles" ALTER COLUMN "rating" SET DEFAULT 0;
