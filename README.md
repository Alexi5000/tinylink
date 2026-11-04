# TinyLink

**Live app:** https://tinylink.techtideai.chatgpt.site

**GitHub:** https://github.com/Alexi5000/tinylink (private repository)

Short links use `https://tinylink.techtideai.chatgpt.site/<alias>`. Legacy `/r/<alias>` links remain supported on this host. The previous host name is not guaranteed to redirect.

A full-stack URL shortener MVP for a 2–3 day engineering exercise. React/Vinext on a Cloudflare Worker, with durable D1 (SQLite) storage. See the in-app **Guide → API docs** and **Guide → Build plan**.

## What works

- Create, list, copy, pause/resume and delete links; custom aliases and optional expiration.
- 302 redirects with no-store; 404 for unknown and 410 for inactive/expired links.
- Actual all-time and daily click totals; 7- and 30-day charts, ranked links, search, status filters, CSV export.
- Authenticated owner-scoped management, URL validation, unique code constraints and collision retries, 30 management writes per user per minute, health endpoint, structured failure logs.
- Explicitly labeled sample preview; no sample records are inserted in the database.

## Setup and validation

Use Node 24 and the project's pnpm lockfile. `pnpm install --frozen-lockfile`, `pnpm run dev`. The Sites workflow provisions DB and applies the tracked Drizzle migration during deployment. For standalone local setup: build, then apply the SQL migration using Wrangler to the local DB (see commands below). The hosting gateway injects authenticated identity headers. Local direct requests to management APIs without identity return 401; do not expose a direct origin that trusts arbitrary client-supplied identity headers.

```sh
node --test tests/service.test.mjs
node node_modules/typescript/bin/tsc --noEmit
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_havok.sql
```

The nine Node test groups use actual SQLite and the production service function via a small D1 adapter. They cover create/list/redirect, daily counts, HEAD exclusion, duplicate aliases, random codes, ownership, authentication, origin checks, pause/resume, expiry, cascade deletion, malformed inputs, rate limiting, analytics failure and DB health. They do not prove Cloudflare throughput or uptime. Browser QA validates the dashboard separately.

## API

| Method | Path | Behavior |
|---|---|---|
| POST | /api/links | `{url,title?,alias?,expiresAt?}` → 201 `{link,shortUrl}` |
| GET | /api/links | Your links, latest first, maximum 500 |
| PATCH | /api/links/:code | `{active:boolean}` |
| DELETE | /api/links/:code | Delete link and analytics |
| GET | /api/analytics | Last 30 UTC days with nonzero counts |
| GET/HEAD | /:code | 302 redirect; HEAD does not count |
| GET | /api/health | DB probe; 200 operational or 503 |

No bearer API keys in this MVP. Management uses gateway-authenticated browser identity. The live app and redirects are public. Management uses gateway-authenticated identity and enforces per-account ownership.

## Decisions and limitations

- Single service and database: low operational overhead for a short exercise. Avoid queues/caches before measurements justify them.
- Global case-sensitive aliases and 8-character cryptographically generated codes. A primary key enforces uniqueness; generated collisions retry up to five times. Codes are identifiers, not access secrets.
- Visits are GET redirects including bots and repeat visitors. No unique visitor, geographic or device claims; no IP/user-agent collection.
- Click counter and daily aggregate update in one DB batch. On analytics failure the redirect proceeds and logs a request ID; undercounting is possible. Writes are awaited, so latency testing is still needed before public launch.
- 500 links/account is an MVP bound; the pre-insert count is not a strict concurrent quota. Pagination and robust quotas are next steps.
- HTTP/HTTPS destinations are accepted without fetching them. This is not malware/phishing detection. Public release needs abuse reporting, destination policy, load testing and retention policy.
- Deleting a link permanently deletes its analytics. The UI confirms this action.
- No uptime SLA, load benchmark, backups/restore drill or public production readiness claim.

## 2–3 day exercise and AI judgment

1. **Day 1 — Greenfield:** clarify actors and API contract; create schema, create/list/redirect; record baseline.
2. **Day 2 — Brownfield:** improve the baseline with pause, expiration, analytics, rate limiting and regression tests. To demonstrate a true brownfield exercise, retain a day-one commit and review the enhancement diff; this generated project is a single initial implementation, not a fabricated development history.
3. **Day 3 — Verify:** run tests, review ownership and URL validation, exercise UI, document assumptions and publish a review build.

AI assistance generated the initial implementation and tests. Reviewer priorities: inspect migration semantics, gateway trust boundary, rate-limit behavior, analytics failure handling and actual assertion quality. Do not accept generated tests as independent proof. Ambiguous requirements were resolved with explicit MVP choices above; a human reviewer owns public release decisions.

## Design refresh

The main product now has two views: Links and Activity. Mobile uses cards, bottom navigation and bottom-sheet dialogs; desktop uses compact rows and top navigation. Link options progressively disclose custom fields. Guide, API docs, delivery plan and workspace details are secondary dialogs. Focus is trapped and restored for dialogs, Escape closes them, and reduced-motion preferences disable animations. A 390px iframe preview was visually checked alongside desktop; the temporary preview route is excluded from release.

### External source status

A native Firecrawl retrieval of https://www.figma.com/ successfully returned page title, description, canonical metadata, and Open Graph image metadata. The response was cached by Firecrawl. This was a retrieval feasibility test, not a hosted integration or live snapshot embedded in the app. No scraped content was written into the site's database or source.

Apify plugin discovery returned no available plugin. Sites plugin eligibility discovery is unavailable in this environment, so neither provider was declared or invoked by the hosted app. The Connections dialog accurately reports both as inactive. No provider keys are collected or exposed. Activation requires a supported eligible connector and per-visitor consent; Firecrawl would enrich individual URLs, and a selected Apify actor/dataset could supply bulk records. Existing shortener functionality remains independent.

## Clone and run

```sh
git clone https://github.com/Alexi5000/tinylink.git
cd tinylink
npx --yes pnpm@11.25.0 install --frozen-lockfile
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_havok.sql
npm run dev
```

The portable local development server emulates sign-in only on loopback. Visit `/signin-with-chatgpt?return_to=/` on its reported localhost URL to sign in. Hosted identity is supplied by Sites; deploying elsewhere requires an equivalent trusted authentication boundary. Never expose a server that trusts identity headers directly from the public internet.

## Release and source synchronization

GitHub contains the complete source snapshot, database migration, lockfile and CI workflow. GitHub pushes run tests, type checking and build; **they do not automatically deploy** to Sites. The hosting repository is managed separately by the Sites publishing workflow. Apply reviewed GitHub changes to that checkout before publishing a new release. Do not change the project ID in `.openai/hosting.json` when updating this existing Site. A new deployment needs its own registered Site identity and database.

The generated hostname is shortened to `tinylink.techtideai.chatgpt.site`. Attaching a custom domain requires a hostname you control plus DNS configuration; no custom domain has been purchased or configured.
