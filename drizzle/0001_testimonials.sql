-- Testimonials move out of the component and into the database.
--
-- The home page carousel had six reviews hardcoded in
-- src/components/site/testimonials.tsx, so correcting a name — or taking down a
-- review a customer had asked to have removed — meant a code change and a
-- deploy. `active` is what takes one down; the row stays, because a testimonial
-- removed from the site is still something the business said in public.
--
-- Applied with `npm run db:push`; kept here so the change is reviewable.

CREATE TABLE IF NOT EXISTS "testimonials" (
  "id"           text PRIMARY KEY NOT NULL,
  "author"       text NOT NULL,
  "city"         text NOT NULL DEFAULT '',
  "rating"       real NOT NULL DEFAULT 5,
  "body"         text NOT NULL,
  "vehicle_slug" text,
  "active"       boolean NOT NULL DEFAULT true,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "testimonials_active_idx" ON "testimonials" ("active");
