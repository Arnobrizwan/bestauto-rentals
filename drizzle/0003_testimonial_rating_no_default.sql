-- A testimonial has to say what the customer actually gave.
--
-- `rating` defaulted to 5, which is the same mistake vehicles.rating made with
-- 4.6 — and a worse one. A vehicle with no reviews renders as "New", so a
-- fabricated aggregate never reaches a customer's eye. The testimonial
-- carousel prints the figure directly, so a row inserted without a rating
-- would have put a perfect five-star score on the home page next to a real
-- person's name.
--
-- Every writer already supplies it (the admin endpoint's zod schema requires
-- 1-5, the seed and the backfill carry the original figures), so dropping the
-- default costs nothing and makes a silent insert fail loudly instead.
--
-- Applied with `npm run db:push`; kept here so the change is reviewable.

ALTER TABLE "testimonials" ALTER COLUMN "rating" DROP DEFAULT;
