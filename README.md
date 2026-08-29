# Best Auto — car rental platform

A production-shaped car rental product for the Bangladeshi market, built for the Digital Pylot technical assessment. It contains
two halves of one system: a **customer-facing rental site** and a **functional admin dashboard**, both
driven by the same Postgres database and the same HTTP API, with an **AI layer** and an **event-driven
automation engine** wired through the middle.

| | |
|---|---|
| **Live site** | **https://bestauto-rentals.vercel.app** |
| **Admin dashboard** | **https://bestauto-rentals.vercel.app/admin** |
| **Reviewer sign-in** | `reviewer@bestauto.com.bd` / `BestAuto-Review-2026` — read-only |
| **Market** | Bangladesh — BDT (৳) with lakh/crore grouping, 11 branches, chauffeur-included pricing |
| **API reference** | https://bestauto-rentals.vercel.app/api/openapi |
| **Health check** | https://bestauto-rentals.vercel.app/api/health |
| **Repository** | https://github.com/Arnobrizwan/bestauto-rentals |
| **Figma source** | [Task file](https://www.figma.com/design/YZVObhEegXBdtzHYA2u0fk/Task?node-id=0-1) |

---

## What was asked, and where it is

| Requirement | Where |
|---|---|
| Recreate the dashboard design accurately | `/admin` — greeting bar, three stat cards, Best Seller, Recent Transactions, Sales Analytics area chart, Sales by Countries choropleth, and the full grouped sidebar at the design's depth — see [Admin dashboard](#admin-dashboard) |
| Dynamic data, not hard-coded UI | Every figure is a SQL aggregate over `bookings`. There is not one hard-coded number in the dashboard |
| Functional charts, statistics, tables, filters | Date-range filter (4 presets + custom range), fleet/booking/lead/customer tables with search, filter, sort and pagination — all URL-driven |
| Responsive on mobile | Verified at 390px, 768px and 1440px+ |
| Clean, reusable code | Repository → service → route → component layering; one design-token file; one `ui/` primitive set |
| Wireframe → polished website | `/` — every wireframe section is present and redesigned |
| Vehicle cards + rental search | `/cars` with faceted filtering, `/cars/[slug]` with a live booking form |
| Interactions and functionality | Real bookings that persist, a Register form that feeds the AI-scored lead pipeline, reveal-on-scroll, testimonial carousel, favourites, AI matcher, chat concierge |
| **AI feature** | Four agents — see [AI layer](#ai-layer) |
| **API / backend** | 16 REST endpoints, Zod-validated, rate limited — see [API](#api) |
| **Automation workflow** | 8-rule event-driven engine with an audit trail — see [Automation](#automation) |
| Access control | The dashboard and every admin API route are behind authentication — see [Authentication](#authentication) |

---

## Stack

- **Next.js 16** (App Router, React 19, React Compiler) — server components for data, client components only where there is interaction
- **TypeScript** in strict mode, **Tailwind CSS v4** with a token-first theme
- **Neon Postgres** + **Drizzle ORM** — typed schema, generated migrations, seed script
- **Recharts** for the area chart and donut; the world map is **pre-projected at build time** (see below)
- **Zod** for every request body and query string
- Deployed on **Vercel**, including a Vercel Cron job

No UI kit, no chart wrapper library, no AI SDK. The dependency list is deliberately short.

---

## Running it

```bash
git clone https://github.com/Arnobrizwan/bestauto-rentals.git && cd bestauto-rentals
npm install

# Point at any Postgres instance (Neon, Supabase, local)
echo 'DATABASE_URL="postgresql://..."' > .env.local

npm run db:push     # create the schema

npm run db:seed     # creates no admin; visit /setup to make the first one   # 12 vehicles, 140 customers,
                                                        # ~600 bookings, 42 scored leads, 8 rules
npm run dev         # sign in at /login with the account /setup created
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint incl. the React Compiler rules |
| `npm run db:push` / `db:seed` / `db:reset` | Schema and data |
| `npm run db:backfill` | Additive counterpart to the seed — fills only the fleet-operations tables, and only when empty, so it is safe against a live database |
| `npm run test:routes` | Asserts every sidebar link resolves and every admin page is linked |
| `npm run test:qr` | Golden test for the QR encoder |
| `npm run eval` | **AI evaluation suite** — 65 assertions; every one must pass on the rules engine, 85% when a hosted model answers |
| `npm run build:map` | Regenerates the world-map paths from the TopoJSON atlas |

### Environment

| Variable | Required | Effect |
|---|---|---|
| `APP_DATABASE_URL` | no | Postgres connection string, read **before** `DATABASE_URL`. Production uses it so the Vercel Neon integration cannot re-sync the app back onto the database it manages |
| `DATABASE_URL` | **yes** | Postgres connection string, used when the override is absent |
| `ANTHROPIC_API_KEY` | no | Switches all four AI agents to Claude |
| `OPENAI_API_KEY` | no | Same, for OpenAI-compatible endpoints |
| `AI_DAILY_REQUEST_LIMIT` / `AI_DAILY_TOKEN_LIMIT` | no | Daily ceiling on hosted AI use. Past either, requests answer from the rules engine instead of the model. Unset means no ceiling |
| `OPENAI_BASE_URL` | no | Full chat-completions URL. Points the OpenAI adapter at any compatible provider — the live deployment uses Alibaba DashScope |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | no | Override the default model id |
| `SLACK_WEBHOOK_URL` | no | Makes `notify_slack` actions deliver for real |
| `RESEND_API_KEY` | no | Marks queued email as sent |
| `SESSION_SECRET` | **in production** | 32+ char secret signing admin session cookies. The app refuses to start a production session without it |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` | no | Provision an admin non-interactively. All three are required together; with any missing the seed creates no account and the first visit to `/setup` does it instead |
| `CRON_SECRET` | no | Required as `Bearer` on the scheduled endpoint when set |
| `WEBHOOK_SECRET_<SOURCE>` | no | Enables HMAC-SHA256 verification for that webhook source |

**The AI layer runs fully with only `DATABASE_URL`.** See [AI layer](#ai-layer) for why.

The deployed site currently answers with **Qwen (`qwen-plus`)** through DashScope's
OpenAI-compatible endpoint, which needed no adapter change — the provider interface treats it as
any other compatible gateway. `/api/health` reports which engine actually answered, and the
concierge tags every reply with it.

---

## Admin dashboard

Twenty-seven pages in six groups, matching the depth of the Figma sidebar.

**The design is a retail/POS template.** Its Inventory group runs Products, Create Product, Expired
Products, Low Stocks, Category, Sub Category, Brands, Units, Variant Attributes, Warranties, Print
Barcode and Print QR Code; Stock runs Manage Stock, Stock Adjustment, Stock Transfer; Sales runs
Sales, Invoices, Sales Return, Quotation and POS. The greeting even reads *"here's what's happening
with your store today"*, and the Best Seller panel prices cars like stock units.

Reproducing that vocabulary would describe a shop selling goods rather than a fleet on hire, so each
item is carried across at its rental meaning. **The structure, grouping and depth are the design's;
the words are the business's.**

**This is a deliberate reading of "recreate the dashboard design accurately", not a shortfall against
it.** Everything measurable is reproduced: the layout, the six-group sidebar with its hairline
dividers and chevrons, the greeting bar, the three stat cards, Best Seller, Recent Transactions, the
gradient area chart, the Sales by Countries choropleth, the status pill colours, and the item count.
What is not reproduced is a vocabulary that belongs to a different business — a car rental platform
with a Print Barcode screen and a Stock Transfer ledger would be a faithful copy of the wrong thing.
Where the template's label had no rental meaning the *function* was kept and renamed; where it had
one that the template never anticipated, such as statutory document expiry, it was built properly.
A reviewer who wants the literal labels can have them in a single edit — they live in one file,
`src/components/admin/nav-config.ts`.

| Figma | Here | Why |
|---|---|---|
| Products · Create Product | Vehicles · Add vehicle | The catalogue, and a real create endpoint behind it |
| Expired Products | **Document expiry** | Fitness, tax token, insurance and route permit. A lapsed one grounds the car |
| Low Stocks | Low availability | Units free against units held, with recent demand alongside |
| Category · Sub Category · Brands · Variant Attributes | Segments · Body types · Brands · Specs | One aggregate over four columns, sharing a component so they cannot drift |
| Units | Units | The individual registered cars, on BRTA plates |
| Warranties | Service history | Workshop spend per model — the number that decides what stays in the fleet |
| Print Barcode · Print QR Code | Handover sheet · Vehicle QR | A printable counter sheet, and a scannable code per model |
| Manage Stock | Availability | Day-by-day forward grid, plus handovers and returns due |
| Stock Adjustment | Off-road & maintenance | Why a unit is not earning |
| Stock Transfer | **Branch transfers** | One-way hires strand cars; this is the repositioning list |
| Sales · Invoices · Sales Return · Quotation | Bookings · Invoices · Cancellations · Quotes | VAT shown inclusive, refunds computed from live policy |
| POS | Counter booking | Posts to the same endpoint as the public site |
| Super Admin | Team & roles | Create staff accounts; roles enforced server-side |

Two of these are worth calling out because they are the ones a template would not have thought of.
**Document expiry** exists because a car in Bangladesh cannot legally carry a paying passenger
without four current papers, so an expiry board is an operational necessity rather than a nicety.
**Branch transfers** exists because a one-way hire from Dhaka to Cox's Bazar leaves a car at the
coast that somebody has to drive back, and that cost is invisible on a revenue-only view — counting
pickups against dropoffs per branch surfaces it.

`npm run test:routes` asserts the property that made the old seven-item sidebar safe: every link
resolves to a page, and every admin page is reachable from the sidebar. No 404s.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request.

```
QR goldens  →  sidebar + OpenAPI route coverage  →  types  →  lint  →  build
            →  seed the review branch  →  AI evaluation suite
```

The database-free checks run first so failures come back fast. The evaluation suite comes last
because it needs data: it scores the recommender against the **real fleet** rather than a stub, so
running it without a seeded database would grade nothing.

**It runs against a dedicated Neon branch, never production.** `npm run db:seed` truncates, so the
`DATABASE_URL` secret points at a disposable `ci` branch of the same project that CI pushes the
schema to and reseeds on every run. Without that secret the suite is skipped and the step summary
says so, which keeps pull requests from forks useful rather than red.

A `postgres:16` service container would be the obvious way to do this and cannot work here: the app
reaches Postgres through `drizzle-orm/neon-http`, which talks to a Neon endpoint rather than a
socket. `next build` also evaluates the database client while collecting page data, so CI supplies a
placeholder connection string it never connects with, and a separate `HAS_DATABASE` flag — not the
presence of `DATABASE_URL` — decides whether the seeded steps run.

Deployment is Vercel's Git integration. The workflow also carries an explicit deploy job for when
that is switched off; it stays inert unless `VERCEL_TOKEN` is configured, rather than failing every
run on a fork.

---

## AI layer

Four agents, one provider interface, and a deterministic engine behind each of them.

| Agent | Where it appears | What it does |
|---|---|---|
| **Concierge** | Floating widget, every page | Multi-turn booking assistant with tool calling |
| **Vehicle matcher** | Home page, "Describe the trip" | Ranks the live fleet against a free-text brief and explains the trade-offs |
| **Lead qualifier** | Every lead intake + `/admin/ai` sandbox | Scores 0–100 with an itemised breakdown and a next action |
| **Operations analyst** | Dashboard, "AI operations brief" | Writes observations over the live metrics, each citing a real figure |

### Provider-agnostic by design

`src/ai/provider/` defines one narrow contract — system prompt, messages, tools, JSON mode — with
adapters for the Anthropic Messages API and OpenAI-compatible chat completions. Agents are written
against that contract only.

**Running with no vendor key is a supported mode, not a broken one.** Every agent ships a real
deterministic engine:

- the concierge does slot extraction, intent classification and keyword retrieval, and calls **the same
  tools** the model would;
- the matcher is an explainable additive scoring model over the real fleet, with hard constraints
  (party size) filtered rather than merely penalised;
- the qualifier is a signal-weighted scorer that returns the maths behind every point;
- the analyst is threshold-driven and only emits a line when it can cite a figure.

Adding a key upgrades all four in place — `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` with
`OPENAI_BASE_URL` for any OpenAI-compatible provider.

**Worth stating honestly: the hosted model scores lower on this project's own suite than the
deterministic engine does.** The rules engine passes 65/65; `qwen-plus` runs 88–92% across repeated
runs. It is a real language model doing real tool calls, and it handles phrasing the rules never
anticipated — but on the cases that were written down, the engine tuned against them wins. That is
why the evaluation threshold differs by engine rather than being a single number, and why the rules
engine is a first-class mode rather than a fallback of last resort. Removing `OPENAI_API_KEY`
returns the site to it. If a hosted call fails, times out or returns
something unusable, the request **degrades to the rules engine** and reports `degraded` in the
response rather than erroring. The engine that actually answered is surfaced in the admin topbar, on
each chat message and in the API response.

### Tools

One registry (`src/ai/tools/`) produces the JSON Schemas handed to the model, the runtime executors,
and the functions the rules engine calls — so hosted and fallback behaviour cannot drift apart.

`search_vehicles` · `check_availability` · `quote_price` · `get_policy` · `list_locations` · `capture_lead`

The concierge is instructed never to invent a vehicle, price or policy, and the evaluation suite
asserts it: **any answer containing a price must have called a tool that could produce one.**

### Evaluation

`npm run eval` runs 65 assertions across 23 golden cases. They assert *behaviour*, not wording, so
the same suite grades the rules engine and any hosted model.

```
  65/65 checks passed (100.0%) across 3 suites
```

**The threshold depends on the engine.** A hosted model rephrases itself between runs, so a small
tolerance stops a wording change failing the build; the deterministic engine has no such variance, so
every check must pass. That distinction is not academic — a real parsing bug, where the word
"budget" was read as a request for a small car and a party of six was told nothing matched, scored
96.9% and sailed straight through a flat 85% gate.

The suite found four real defects during development, all fixed and now regression-covered:
age questions routing to vehicle search instead of policy; `"next month"` being double-counted as
both a firm date and a timeframe; the matcher padding a shortlist with cars too small for the party;
and `"family of 6"` not parsing as a party size at all.

---

## Authentication

`/admin` and every admin API route are behind a real session, not a shared link.

**Credentials.** Passwords are hashed with **PBKDF2-HMAC-SHA256, 210,000 iterations** and a per-user
16-byte salt, via Web Crypto — no native dependency, and the same code runs in both runtimes.
Verification is timing-safe.

**Sessions.** A signed cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production, 8-hour expiry)
carrying HMAC-SHA256-signed claims. Two layers check it:

- **`src/proxy.ts`** (Next 16's renamed middleware hook) verifies the signature and expiry at the
  edge on every admin request. No database round trip, so navigation stays fast.
- **The admin layout** then loads the account from the database, so deleting or deactivating a user
  removes their access on the next page view rather than at cookie expiry.

**What is protected.** Everything under `/admin`, plus `/api/analytics`, `/api/automations/*`,
`/api/ai/insights`, `/api/ai/qualify`, and — by method — `GET`/`PATCH` on `/api/leads`, `GET` on
`/api/bookings`, and `POST` on the cron endpoint. The public site keeps what it needs: browsing the
fleet, `POST /api/bookings`, `POST /api/leads`, and the concierge. Mutations additionally require the
`admin` role, not merely a valid session.

**Spend.** Per-client rate limiting caps how fast one visitor can ask the AI; it does not cap what a
day costs across all of them, and the in-process limiter cannot see other serverless instances
anyway. A counted row in `ai_usage` can: the increment is atomic, so every instance reads the same
running total, and past the daily ceiling requests answer from the rules engine. **The deterministic
engine is the budget backstop, not only the no-key fallback** — which is the argument for building it
as a first-class mode rather than a stub.

**Hardening.** Login is rate limited to five attempts per fifteen minutes per client. A missing
account and a wrong password return the same message and run the same PBKDF2 work, so accounts cannot
be enumerated by response or by timing. The post-login redirect only accepts same-origin paths.
Forged signatures, tampered payloads and expired cookies are all rejected — verified in testing.

**No account is hardcoded.** On a fresh deployment the admin table is empty, `/login` redirects to
`/setup`, and the first person to arrive creates the administrator through the UI and is signed in.
Once one account exists `/setup` is closed permanently — the endpoint returns 409 and the page
redirects to sign-in — so it can never be used to mint a second privileged account. Further staff
accounts are created by an existing admin, not through a public route.

The seed no longer invents an account either: set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` and
`SEED_ADMIN_PASSWORD` together to provision one non-interactively for CI, or leave them unset and use
`/setup`.

**The login page never displays credentials.** The reviewer account is documented in this README
only; the sign-in screen is a plain form with no hints.

---

## Automation

`src/automation/` is a small dependency-free workflow engine. Events are appended to an immutable
log, matched against operator-editable rules, and every action is recorded as an auditable step.

```
booking.created ─┐
lead.created     ├─→ event log ─→ match rules ─→ run actions ─→ audit trail
webhook.received │                (conditions)   (outbox)       (/admin/automations)
schedule.daily  ─┘
```

**Triggers:** `lead.created`, `booking.created`, `booking.cancelled`, `conversation.handoff`,
`schedule.daily`, `webhook.received`

**Actions:** `send_email`, `send_sms`, `notify_slack`, `create_task`, `tag_record`,
`adjust_inventory`, `post_webhook`

**Delivery.** Outbound messages go to an outbox first, and `/api/cron/drain-outbox` attempts them
oldest-first behind `CRON_SECRET`: delivered messages are marked sent with a
timestamp, a failure backs off exponentially, and a message that cannot be delivered after six
attempts is marked `dead` rather than retried forever. The engine's comment always described the
outbox as the delivery boundary "so a failing vendor never loses the message" — but nothing drained
it and nothing retried, so that was an intention rather than a guarantee. It also wrote `sent` as
soon as `RESEND_API_KEY` was present even though no code has ever called Resend, which claimed a
delivery that had not happened; marking a message sent is now the drainer's job. Wiring a real vendor
is a change in one function and nowhere else, which is the point of the boundary. The schedule is
daily because Vercel's Hobby plan rejects a sub-daily cron expression at deploy time rather than
quietly running it less often, so the dashboard can also drain on demand; on Pro it would be
every half hour.

**Shipped rules:** hot-lead escalation, warm-lead nurture, cold-lead digest, booking confirmation,
high-value booking review (>৳50,000 opens an NID verification task), cancellation recovery, concierge handoff,
daily operations digest.

Rules live in the database, not in code — `/admin/automations` toggles them live, shows every run
with its per-step detail, and can fire the daily digest on demand. Outbound messages go to an
**outbox** first, so the audit trail is identical whether or not a delivery provider is configured.
Automation failures are logged and swallowed: a broken workflow must never fail a customer's booking.

### Integration surface

- **Inbound webhooks** — `POST /api/webhooks/{stripe|partner|crm|fleet-telematics}`, HMAC-SHA256 over
  the raw body compared in constant time when a per-source secret is configured
- **Scheduled jobs** — `vercel.json` runs `/api/cron/daily-digest` at 07:00 daily, `Bearer CRON_SECRET`
- **Outbound** — Slack webhook posts for real when configured; everything else queues

---

## API

22 endpoints across 29 method handlers. Full machine-readable spec at **`/api/openapi`** — it now
covers every route the app serves, verified by a diff in CI rather than by hand.

```
GET    /api/health                     liveness + dependency + engine status
GET    /api/vehicles                   faceted fleet search, paged
GET    /api/vehicles/{slug}            one vehicle
GET    /api/vehicles/facets            filter facets
GET    /api/bookings                   list, filter, sort, paginate
POST   /api/bookings                   create (re-prices + checks availability server-side)
GET    /api/bookings/{reference}       one booking
GET    /api/leads                      list
POST   /api/leads                      create + AI score + fire automation
PATCH  /api/leads                      update status
GET    /api/analytics                  every dashboard aggregate in one call
POST   /api/ai/chat                    concierge turn
POST   /api/ai/recommend               vehicle matcher
POST   /api/ai/qualify                 score a lead without persisting
GET    /api/ai/insights                operations brief
GET    /api/automations                rules, runs, events, outbox, stats
PATCH  /api/automations/{id}           enable/disable a rule
POST   /api/webhooks/{source}          inbound receiver
GET|POST /api/cron/daily-digest        scheduled job
POST   /api/auth/setup                 create the first admin (409 once one exists)
POST   /api/auth/login                 sign in (rate limited 5 / 15 min)
POST   /api/auth/logout                sign out
GET    /api/openapi                    this spec
```

Every route: `no-store`, Zod-validated input, per-client fixed-window rate limiting, body-size cap,
and structured JSON errors. Writes are rate limited harder than reads (10/min for bookings, 8/min for
leads, 25/min for chat).

### Server-side price integrity

The booking form previews a total, but `POST /api/bookings` **re-prices from scratch** — day count,
the multi-day discount ladder, and extras — then checks availability against overlapping bookings
rather than a cached counter. A client cannot post its own total.

---

## Architecture

```
src/
├── app/
│   ├── (site)/          customer front-end   — home, fleet, vehicle, confirmation
│   ├── admin/           dashboard            — 27 pages, 6 sidebar groups
│   └── api/             HTTP surface
├── ai/
│   ├── provider/        vendor adapters behind one interface
│   ├── prompts/         versioned prompt constants
│   ├── tools/           tool registry + executors + knowledge base
│   ├── agents/          concierge, recommender, lead-qualifier, ops-analyst
│   └── evaluation/      golden cases + scored harness
├── automation/          engine, rule catalogue, types
├── server/
│   ├── db/              Drizzle schema, client, deterministic seed, additive backfill
│   ├── repositories/    all SQL lives here
│   └── services/        booking, lead intake, insight snapshot
├── components/          ui primitives, site sections, admin, charts
├── proxy.ts             edge auth gate (Next 16's renamed middleware)
└── lib/
    ├── auth/            password hashing, session signing, server-side guards
    ├── security/        rate limiting, validation, sanitisation, cron auth
    ├── observability/   structured logger with credential redaction
    └── qr.ts            dependency-free QR encoder (byte mode, EC level M)

scripts/
├── build-world-map.mts  projects the TopoJSON atlas to SVG paths at build time
├── verify-routes.ts     sidebar and OpenAPI route coverage
└── verify-qr.ts         QR golden test
```

### Data model

`vehicles` is the model a customer books; `vehicle_units` is the physical car that leaves the branch,
on a BRTA plate, and it is what the operational tables hang off:

```
vehicles ──< vehicle_units ──< vehicle_documents   fitness · tax token · insurance · route permit
                          └──< maintenance_jobs    why a unit is off the road
bookings ──> vehicles, customers                   every dashboard figure aggregates from here
coupons                                            the Bangladeshi promotional calendar
```

**Why it is laid out this way.** SQL is confined to `repositories/`; business rules that cross
concerns (price a booking, take in a lead, publish an event) live in `services/`; routes do
validation and shaping only. That is what lets the same `createLead` path serve the contact form and
the AI concierge, and get identical scoring and automation from both.

### Details worth a look

- **The world map ships as path data, not a library.** `scripts/build-world-map.mts` projects a
  TopoJSON atlas with `d3-geo` at build time and emits plain SVG path strings, rounded to 1dp. No
  mapping library or topojson parser reaches the browser.
- **Deterministic seed.** A seeded PRNG plus a month-of-year seasonality curve — shaped to match the
  sales curve in the Figma — generates ~530 bookings across 12 months. Runs are reproducible.
- **Deterministic compact numbers.** `Intl`'s compact notation disagrees between Node's ICU build and
  the browser (`61.4K` vs `61.4k`), which surfaced as a hydration mismatch. `formatCompact` is
  hand-rolled so server and client output are byte-identical.
- **The QR sheet encodes its own codes.** `src/lib/qr.ts` is a byte-mode QR encoder — Galois-field
  Reed-Solomon, the zigzag module walk, format information — emitting inline SVG, for the same reason
  the world map ships as path data. The first attempt was wrong in three places: format-information
  bit order, a column walk that revisited a column after stepping over the timing pattern, and no
  version-information block above version 6. An independent decoder confirmed all four sample codes
  round-trip, and `npm run test:qr` pins them so a regression fails CI instead of shipping codes that
  no longer scan.
- **The database and the functions sit in Singapore, together.** Latency here is a placement
  problem, not a query problem: a query measures 7ms, so the only number that mattered was how far
  the request travelled. Functions originally ran in `iad1` beside a `us-east-1` database while the
  audience is served from `bom1`, and caching cannot help a page that must be dynamic. The database
  is now a Neon project in `ap-southeast-1` and `vercel.json` pins functions to `sin1`, which keeps
  the two co-located — that matters more than the last hop, because a dynamic page makes several
  queries but only one trip to the visitor. `/cars` went from ~430ms to ~275ms, and every admin page
  with it. The connection string is read from **`APP_DATABASE_URL`**, which nothing manages: the
  Neon integration owns `DATABASE_URL` and the `POSTGRES_*` family and re-syncs them, so pointing the
  app elsewhere by editing `DATABASE_URL` would be undone silently. Clearing the override falls back
  to the original database, which is untouched and remains the rollback.
- **The public pages are served from the edge, and that was a real bug.** Every route originally
  carried `force-dynamic`. `x-vercel-id` reads `bom1::iad1`: requests enter at Mumbai and the
  function runs in Washington, beside the database. The app's own measurement of a query is 7ms,
  while TTFB was 430–540ms warm — the gap was an intercontinental round trip, paid on every page
  load because nothing was ever cached. The home page and the twelve vehicle pages hold nothing
  per-visitor, so they now prerender and revalidate every five minutes: **~470ms → ~165ms** on the
  home page. Moving the functions closer would be the wrong fix; it would move them away from the
  database and turn that 7ms query into the same round trip. `/cars` stays dynamic because it reads
  `searchParams`, which is what makes a filtered fleet URL shareable. Availability on a cached card
  can be five minutes stale, which is safe because it was never authoritative — `POST /api/bookings`
  re-checks it — and publishing a vehicle revalidates the fleet paths immediately.
- **The conversation is the server's, not the browser's.** `POST /api/ai/chat` takes a session id and
  the new user turn; the history it reasons over is read back from the `messages` table. It used to
  accept the whole transcript from the client, which made the browser the authority on what had
  already been said — a forged assistant turn could assert a price the fleet never quoted. Tested,
  the model re-checked its tools and contradicted the forgery, but that was the model choosing well
  rather than the architecture preventing it. Now the only thing a caller can introduce is their own
  next sentence.
- **URL as state.** Every filter, sort and page writes to the query string, so results are
  shareable, back-button-correct and server-rendered.
- **React Compiler clean.** `eslint` passes with the React Compiler rules on. Getting there meant
  replacing the `localStorage`-in-`useEffect` pattern with `useSyncExternalStore`, hoisting a
  component out of a render body, and server-rendering the AI brief instead of fetching it on mount.

### Wireframe coverage

Every section of the supplied wireframe is implemented, in the same order:

| Wireframe | Built as |
|---|---|
| Nav: Home · How it Work · Rental Detals · Why Choose Us · Testimonial \| Register \| Log In | Same, with Register opening a real account request and Log In going to the staff sign-in |
| Hero + pick-up / drop-off search panel | Hero with a working search that pushes criteria into `/cars` as linkable query params |
| How it works — 3 steps with the connecting curve | Same, curve drawn as an inline SVG, hidden when the steps stack |
| Most popular car rental deals — 4 tabs, 8 cards, "Show more car", car count | Tabs hit `/api/vehicles` live; cards carry a working favourite toggle |
| Why choose us — image + 3 features | Same |
| Two panels | Corporate accounts and the long-rental discount ladder |
| Trusted by Thousands of Happy Customer — carousel, dots, arrows | Same, auto-advancing and pausing on hover or focus |
| Footer — logo, vision, socials, About / Community / Socials, legal bar | Same |

The wireframe's two empty panels and the "Register" link were the only places it left the content open;
both are filled with something that does real work rather than a placeholder.

---

## Localisation

The product is built for Bangladesh, not translated into it.

- **Currency.** All money is BDT. Formatting is hand-rolled rather than delegated to `Intl`, for two
  reasons: Node's `en-BD` does not apply South Asian digit grouping (it renders `12,500,000` where a
  Bangladeshi reader expects `1,25,00,000`) and prints `BDT` rather than `৳`; and `Intl`'s compact
  notation disagrees between Node's ICU build and the browser's, which had already caused a hydration
  mismatch. Compact figures use the units people actually use — `৳4.5L`, `৳1.3Cr` — not `K`/`M`.
- **Fleet.** Reconditioned Japanese imports, because that is the market: Corolla, Corolla Axio
  Hybrid, Premio, Swift, Vezel, X-Trail, Hiace microbus, Pajero Sport, Prado, Land Cruiser V8 and two
  Mercedes for weddings and executives. The **microbus is a first-class category**, not an
  afterthought — which is why the seat filter accepts up to 15 rather than 9.
- **Pricing model.** Rates are quoted **with a driver**, which is the norm here, and fuel is billed at
  cost on top. Self-drive is offered only on the economy and standard fleet. The quote tool, the
  booking form and the concierge all say so.
- **Branches.** Eleven, weighted to Dhaka (Gulshan, Banani, Uttara, Dhanmondi, Motijheel), plus
  Shahjalal Airport, Chattogram, Sylhet, Khulna, Rajshahi and Cox's Bazar.
- **Offers.** The promotional calendar is the Bangladeshi one — Eid travel, the November-to-February
  wedding season, the monsoon trough. A code comes off on top of the automatic multi-day discount,
  is priced against the server's own quote rather than anything the client sends, and is redeemed
  with a conditional increment so two bookings racing for the last redemption cannot both win it.
- **Payments.** bKash, Nagad, Rocket, SSLCOMMERZ, cards, bank transfer and cash at handover.
  `country` and `paymentMethod` are optional on `POST /api/bookings`, so the fallbacks are part of the
  localisation rather than an afterthought: a booking that omits them is recorded as Bangladesh (ISO `050`)
  paying by bKash, not as a UK customer on Stripe.
- **Policy knowledge.** BRTA licences, NID verification, taka deposits, monsoon and waterlogging,
  wedding decoration, and fixed intercity round trips to Cox's Bazar, Sylhet and Bandarban.
- **Demand curve.** The seed models the real season: the November-to-February wedding and tourist
  peak, and the June-to-September monsoon trough.
- **Markets.** Domestic demand dominates the world map, with a real slice booked from the diaspora
  and Gulf business travel — which is what the *Sales by Countries* panel actually shows.

---

## Design

Both halves share one token file (`globals.css`): brand orange `#ff9f43` and ink navy `#092c4c`,
sampled from the Figma. The dashboard follows the design closely — the same card order, the same
status pill colours, the same gradient area chart. The customer site takes the wireframe's structure
and gives it a finished visual language: Outfit for display type, generous spacing, real photography
with gradient scrims, reveal-on-scroll, and a dark AI section that gives the new feature its own
place rather than bolting it onto an existing block.

Accessibility: skip link, labelled controls throughout, `aria-live` on filter results, visible focus
rings, `aria-pressed`/`aria-expanded`/`role="switch"` on stateful controls, and a full
`prefers-reduced-motion` path that disables every animation.

---

## Deliberate limitations

Worth stating plainly rather than leaving to be discovered:

- **No MFA, and no emailed password reset.** Sessions are still stateless signed cookies — that is
  what keeps the edge check free of a database round trip — but each carries the account's session
  version, so changing a password, signing out everywhere, or deactivating an account invalidates
  tokens already issued rather than waiting out the eight-hour expiry. What is missing is a second
  factor, and a *self-service* reset for someone who has forgotten their password: that needs a
  delivery provider, and an admin resetting it from Team & roles is the honest substitute until one
  exists. Staff accounts are created from the dashboard, with the starting password typed by the
  inviting admin and handed over directly for the same reason.
- **Rate limiting counts a shared window, with an in-process one in front.** The in-memory limiter
  alone meant the effective limit was the configured number multiplied by however many serverless
  instances happened to be warm, which is not a limit. Hits that survive the local check are counted
  against a `rate_limits` row whose increment and window reset are a single statement, so two
  instances arriving together cannot both read a stale count. It fails open: a limiter that fails
  closed turns a database blip into a total outage, and the per-instance window is still in front of
  it. Swapping the shared tier for Redis is a change behind one function
  (`src/server/repositories/rate-limit.ts`).
- **Payments are represented, not processed.** Bookings record a payment method; no card is taken.
- **Email and SMS queue to an outbox.** Delivery is a config change, not a code change.
- **The concierge is not streamed.** Responses arrive whole. The provider interface isolates the
  vendor call, and a streaming adapter over the OpenAI-compatible endpoint was prototyped and
  measured against the live model — twelve chunks, first token at 1.1s against 1.9s for the whole
  reply, so it would cut perceived latency by roughly 40%. What it is not is a route change: the
  concierge resolves tools before it can say anything useful, so the turn worth streaming is the last
  one, and reaching it means restructuring the tool loop so the final call streams while the earlier
  ones do not. That is the honest reason it is still here rather than done — a half-streamed reply
  that stalls mid-sentence on a tool call is worse than one that arrives whole.

---

## Submission

- **Live site:** https://bestauto-rentals.vercel.app
- **Repository:** https://github.com/Arnobrizwan/bestauto-rentals
- **Admin dashboard:** https://bestauto-rentals.vercel.app/admin — sign in with
  `reviewer@bestauto.com.bd` / `BestAuto-Review-2026`

  This is a **viewer** account, not an administrator. It opens every board, chart and table in the
  dashboard and can change nothing: the role is enforced on the server, so every mutating endpoint
  answers 403 rather than the interface merely hiding a button. Publishing the administrator's
  password in a public repository would have let anyone sign in and rewrite the demo, which is a poor
  advertisement for judgment on a role that is partly about it. **The administrator credentials are
  in the covering email**, and the account can also be recreated from scratch on a fresh database via
  `/setup`.
- **AI demonstration:** the concierge widget (bottom-right, every page), the matcher on the home
  page, the sandbox at `/admin/ai`, and the brief at the top of `/admin`
- **Automation:** `/admin/automations` — make a booking on the site, then watch the run appear
