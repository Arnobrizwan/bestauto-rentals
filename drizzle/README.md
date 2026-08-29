# Schema changes

`src/server/db/schema.ts` is the source of truth and the database is kept in
step with `npm run db:push`, which is how every table in this project was
created. This folder is the written record of the changes push applied, so a
schema change is reviewable in a diff and replayable by hand on an environment
that is not being pushed to.

The files here are additive and safe to run against a database that already has
the change (`if not exists`, and a default that is set rather than toggled).
They are **not** a `drizzle-kit migrate` chain — there is no `meta/_journal.json`
and no baseline, because the schema predates them. Do not run `drizzle-kit
migrate`; run `npm run db:push`.

| File | Applied |
| --- | --- |
| `0001_testimonials.sql` | 2026-08-29 |
| `0002_vehicle_rating_default.sql` | 2026-08-29 |
| `0003_testimonial_rating_no_default.sql` | 2026-08-29 |
