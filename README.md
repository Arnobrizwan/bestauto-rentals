# Best Auto — car rental platform

A production-shaped car rental product built for the Digital Pylot technical assessment. It contains
two halves of one system: a **customer-facing rental site** and a **functional admin dashboard**, both
driven by the same Postgres database and the same HTTP API, with an **AI layer** and an **event-driven
automation engine** wired through the middle.

| | |
|---|---|
| **Live site** | _(see Submission section)_ |
| **Admin dashboard** | `/admin` |
| **API reference** | `/api/openapi` |
| **Health check** | `/api/health` |
| **Figma source** | [Task file](https://www.figma.com/design/YZVObhEegXBdtzHYA2u0fk/Task?node-id=0-1) |

---

## What was asked, and where it is

| Requirement | Where |
|---|---|
| Recreate the dashboard design accurately | `/admin` — greeting bar, three stat cards, Best Seller, Recent Transactions, Sales Analytics area chart, Sales by Countries choropleth, grouped sidebar |
| Dynamic data, not hard-coded UI | Every figure is a SQL aggregate over `bookings`. There is not one hard-coded number in the dashboard |
| Functional charts, statistics, tables, filters | Date-range filter (4 presets + custom range), fleet/booking/lead/customer tables with search, filter, sort and pagination — all URL-driven |
| Responsive on mobile | Verified at 390px, 768px and 1440px+ |
| Clean, reusable code | Repository → service → route → component layering; one design-token file; one `ui/` primitive set |
| Wireframe → polished website | `/` — every wireframe section is present and redesigned |
| Vehicle cards + rental search | `/cars` with faceted filtering, `/cars/[slug]` with a live booking form |
| Interactions and functionality | Real bookings that persist, reveal-on-scroll, testimonial carousel, favourites, AI matcher, chat concierge |
| **AI feature** | Four agents — see [AI layer](#ai-layer) |
| **API / backend** | 16 REST endpoints, Zod-validated, rate limited — see [API](#api) |
| **Automation workflow** | 8-rule event-driven engine with an audit trail — see [Automation](#automation) |

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
git clone <repo-url> && cd bestauto
npm install

# Point at any Postgres instance (Neon, Supabase, local)
echo 'DATABASE_URL="postgresql://..."' > .env.local

npm run db:push     # create the schema
npm run db:seed     # 14 vehicles, 140 customers, ~530 bookings, 42 scored leads, 8 rules
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint incl. the React Compiler rules |
| `npm run db:push` / `db:seed` / `db:reset` | Schema and data |
| `npm run eval` | **AI evaluation suite** — 50 assertions, exits non-zero below 85% |
| `npm run build:map` | Regenerates the world-map paths from the TopoJSON atlas |

### Environment

| Variable | Required | Effect |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string |
| `ANTHROPIC_API_KEY` | no | Switches all four AI agents to Claude |
| `OPENAI_API_KEY` | no | Same, for OpenAI-compatible endpoints |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | no | Override the default model id |
| `SLACK_WEBHOOK_URL` | no | Makes `notify_slack` actions deliver for real |
| `RESEND_API_KEY` | no | Marks queued email as sent |
| `CRON_SECRET` | no | Required as `Bearer` on the scheduled endpoint when set |
| `WEBHOOK_SECRET_<SOURCE>` | no | Enables HMAC-SHA256 verification for that webhook source |

**The app runs fully with only `DATABASE_URL`.** See the next section for why.

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

Adding `ANTHROPIC_API_KEY` upgrades all four in place. If a hosted call fails, times out or returns
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

`npm run eval` runs 50 assertions across 18 golden cases. They assert *behaviour*, not wording, so
the same suite grades the rules engine and any hosted model.

```
  50/50 checks passed (100.0%) across 3 suites
```

The suite found four real defects during development, all fixed and now regression-covered:
age questions routing to vehicle search instead of policy; `"next month"` being double-counted as
both a firm date and a timeframe; the matcher padding a shortlist with cars too small for the party;
and `"family of 6"` not parsing as a party size at all.

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

**Shipped rules:** hot-lead escalation, warm-lead nurture, cold-lead digest, booking confirmation,
high-value booking review (>£1,000 opens a risk task), cancellation recovery, concierge handoff,
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

16 endpoints. Full machine-readable spec at **`/api/openapi`**.

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
│   ├── admin/           dashboard            — 7 pages
│   └── api/             HTTP surface
├── ai/
│   ├── provider/        vendor adapters behind one interface
│   ├── prompts/         versioned prompt constants
│   ├── tools/           tool registry + executors + knowledge base
│   ├── agents/          concierge, recommender, lead-qualifier, ops-analyst
│   └── evaluation/      golden cases + scored harness
├── automation/          engine, rule catalogue, types
├── server/
│   ├── db/              Drizzle schema, client, deterministic seed
│   ├── repositories/    all SQL lives here
│   └── services/        booking, lead intake, insight snapshot
├── components/          ui primitives, site sections, admin, charts
└── lib/
    ├── security/        rate limiting, validation, sanitisation, cron auth
    └── observability/   structured logger with credential redaction
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
- **URL as state.** Every filter, sort and page writes to the query string, so results are
  shareable, back-button-correct and server-rendered.
- **React Compiler clean.** `eslint` passes with the React Compiler rules on. Getting there meant
  replacing the `localStorage`-in-`useEffect` pattern with `useSyncExternalStore`, hoisting a
  component out of a render body, and server-rendering the AI brief instead of fetching it on mount.

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

- **No authentication.** `/admin` is open so it can be reviewed without credentials. In production
  this sits behind auth and the admin routes get role checks.
- **Rate limiting is in-process.** Fine for a single region; multi-region needs Redis behind the same
  interface (`src/lib/security/rate-limit.ts`).
- **Payments are represented, not processed.** Bookings record a payment method; no card is taken.
- **Email and SMS queue to an outbox.** Delivery is a config change, not a code change.
- **The concierge is not streamed.** Responses arrive whole. Streaming is a route change; the
  provider interface already isolates it.

---

## Submission

- **Live site:** _see the deployment URL_
- **Repository:** _see the repository URL_
- **Admin dashboard:** `/admin`
- **AI demonstration:** the concierge widget (bottom-right, every page), the matcher on the home
  page, the sandbox at `/admin/ai`, and the brief at the top of `/admin`
- **Automation:** `/admin/automations` — make a booking on the site, then watch the run appear
