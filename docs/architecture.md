# Architecture and decisions

## Request flow

The React workspace calls same-origin management APIs. Thin route adapters pass requests to the service with a Cloudflare D1 binding. The service owns validation, owner checks, link operations and analytics behavior. D1 stores links, daily aggregates and rate-limit counters.

The clean `/<code>` route and the legacy `/r/<code>` route share redirect behavior. Keeping the compatibility route prevents existing shared links from breaking when clean URLs are introduced.

## Storage

| Table    | Responsibility                                          | Invariant                                                                   |
| -------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `links`  | Destination, owner, status, expiration and total clicks | Global code primary key; private unique generation; owner-scoped management |
| `daily`  | Click count per code and UTC date                       | Composite key; cascade deletion with its link                               |
| `limits` | Per-owner fixed-minute write counter                    | Atomic counter update; expired entries are removed                          |

`db/schema.ts` describes the schema. Ordered SQL migrations in `drizzle/` are the deployment artifacts. Apply new migrations forward; do not edit an already applied migration to change an existing installation.

## Design decisions

**One service and one database.** A small deployment is enough for the exercise and keeps ownership and data changes easy to inspect. A queue, cache or separate analytics service would add operational work before there is evidence it helps.

**Feature slices with small boundaries.** Link management, analytics display and supporting dialogs are separate concerns. Route adapters remain thin. Validation and shared link contracts are reused where useful. Additional abstractions should remove duplication or isolate a real dependency, not merely satisfy a pattern checklist.

**Durability before caching.** D1 is the source of truth. Redirects and their missing/paused/expired responses avoid caching so pause, resume and deletion take effect on subsequent requests. Caching would need an explicit invalidation policy.

**Stable analytics identity.** Each link has a private immutable generation token. Click writes check the generation read with the redirect, so deleting and reusing an alias cannot credit the replacement link. The additive migration backfills existing links and includes an insert trigger for older writers that omit the token.

**Availability before exact analytics.** Total and daily counts are updated in one database batch. Recording failures are logged and the redirect continues. This permits undercounting. The write is currently awaited, so a slow database still delays the redirect; a background queue would require delivery and duplication semantics before adoption.

**Bounded management.** Account capacity is 500 links. Write throttling uses a fixed one-minute window shared across mutations; failed attempts can consume capacity. This is basic application protection, not a global abuse or denial-of-service defense.

## Trust and privacy

The Sites gateway supplies authenticated identity. Management queries always include the owner, and cross-origin writes are rejected when an Origin header is present. These controls assume an origin that cannot be accessed with attacker-supplied trusted identity headers. Local sign-in emulation is restricted to loopback development.

Short links intentionally redirect to caller-selected HTTP/HTTPS destinations. Validation rejects unsafe schemes and embedded credentials but does not determine whether a site is trustworthy. The application does not fetch a destination when shortening it.

Analytics store only counts per code and UTC date. They do not store visitor IPs, user agents or unique visitor identifiers. Application failure logs use request IDs; they do not need destination URLs or identity values. Hosting infrastructure may have its own logging policies.

## Source layout

- `app/`: thin route adapters, workspace composition and application styles.
- `features/links/`: shared link model, creation/list components and mutation actions; `server/` contains validation, persistence and redirect handling.
- `features/analytics/`: activity visualization; `server/repository.ts` records and reads daily counts.
- `features/workspace/`: data loading, API client and supporting dialogs.
- `shared/server/`: bounded JSON parsing, HTTP responses, path decoding and write rate limiting.
- `lib/service.ts`: service routing, authentication and error boundary; other `lib/` modules support hosting connectors.
- `db/` and `drizzle/`: schema and versioned migrations.
- `tests/`: backend behavior and regression tests using SQLite.
- `scripts/`: local runtime support and reproducible validation.
- `docs/`: specification, decisions, integration feasibility and delivery evidence.

## Operational follow-ups

The public prototype has no measured throughput or availability objective. Before expanding use, measure redirect latency and write contention, exercise backup/restore, define daily-data retention, establish destination abuse handling and assess pagination. A database health probe is a point-in-time connectivity check, not an uptime measurement.

GitHub and Sites are separate release surfaces. A passing GitHub commit does not establish which source is live. Record the reviewed source revision, verification report, deployment identifier and smoke-test outcome together when releasing.
