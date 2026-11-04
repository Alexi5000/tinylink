# Product specification

## Goal

Deliver a working URL shortener prototype that demonstrates a reviewable engineering lifecycle: requirement interpretation, task decomposition, implementation, independent review, regression fixes and reproducible validation. The product remains a small link-management tool; execution evidence lives alongside its source.

The intended delivery window is 2–3 days. The phases below describe an implementation plan, not a claim that work occurred on separate calendar days.

## Actors and boundaries

A visitor can open the dashboard, inspect labeled sample data and follow public short links. A signed-in owner can manage only their own links and view only their own analytics. The trusted hosting gateway establishes identity. Short codes are public identifiers, not secrets or access controls.

The initial implementation is the greenfield baseline. Review-driven fixes to that baseline demonstrate brownfield changes: preserve existing links and schema compatibility while improving behavior and tests.

## Acceptance criteria

| ID       | Required behavior                                                                                                                                                                                                                                                                        | Validation                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| LINK-01  | Create an HTTP/HTTPS destination with optional title, alias and future expiration; return a durable record and a clean `/<code>` URL.                                                                                                                                                    | SQLite service tests; deployed creation check                                  |
| LINK-02  | Aliases are globally unique and case-sensitive, 3–40 letters, numbers, hyphens or underscores. Reserved application routes are rejected. Generated codes contain eight random alphanumeric characters and retry collisions up to five times.                                             | Validation, duplicate-alias and deterministic collision retry/exhaustion tests |
| LINK-03  | Public clean and legacy `/r/` routes redirect with 302 and no-store. Missing codes return 404; paused or expired codes return 410. Negative responses must also avoid caching.                                                                                                           | Clean/legacy route regression tests; deployed route check                      |
| LINK-04  | An owner can list, pause, resume and permanently delete their links. Deletion cascades to daily analytics. Ownership mismatches return 404.                                                                                                                                              | Ownership and lifecycle tests                                                  |
| AUTH-01  | Management requires gateway identity. A missing identity returns 401; a supplied foreign Origin on a write returns 403. Public redirects do not require sign-in.                                                                                                                         | Authentication and origin tests; hosted session check                          |
| INPUT-01 | Malformed JSON, null/array bodies, invalid field types, unsafe URL schemes and malformed encoded paths produce client errors rather than 503. POST and PATCH bodies are limited to 16,384 bytes (16 KiB).                                                                                | Input and bounded-body regression tests                                        |
| LIMIT-01 | A single owner has at most 500 links. Management writes are limited to 30 attempts per fixed minute; excess attempts receive 429 and Retry-After.                                                                                                                                        | Quota and rate-limit boundary tests                                            |
| DATA-01  | A GET redirect increments the all-time and UTC daily counters together. HEAD does not count. The analytics API returns the owner's last 30 UTC days; the UI fills missing dates with zero.                                                                                               | SQLite aggregation and HEAD tests; chart UI check                              |
| REL-01   | Analytics write failure is logged with a request ID and does not prevent a valid redirect. Other storage failures return a generic 503. Health probes the database.                                                                                                                      | Failure-injection and health tests                                             |
| UI-01    | Links and Activity views work at mobile and desktop widths. Link options are optional; copy, filters, search and CSV export give clear feedback.                                                                                                                                         | Browser interaction and viewport checks                                        |
| UI-02    | Sample data is visibly labeled, never persisted and read-only; the composer is hidden and mutation handlers reject sample actions. Errors from live mutations remain visible. Dialog errors remain visible. Dialogs support keyboard focus and Escape; motion respects user preferences. | Browser sample/error, keyboard and reduced-motion checks                       |
| INT-01   | The UI and documentation identify Firecrawl and Apify as inactive until supported runtime integration is configured and verified.                                                                                                                                                        | Source/UI inspection; integration record                                       |
| SDLC-01  | One command runs ordered checks, fails on any check failure and produces machine-readable evidence identifying the source and results. CI uses the same command.                                                                                                                         | `npm run verify`; report and workflow inspection                               |
| SDLC-02  | Requirements, decisions, simulated review findings, resolutions and remaining limits are available in the repository. No simulated review is represented as a named person's endorsement.                                                                                                | Documentation review                                                           |

Validation entries describe the required checks; they do not assert that every check has already passed. The [delivery record](delivery.md) tracks available evidence and unresolved release checks.

## Implementation map

- LINK-01, LINK-02 and LIMIT-01: `features/links/server/validation.ts`, `features/links/server/repository.ts` and `shared/server/rate-limit.ts`.
- LINK-03 and REL-01: `features/links/server/redirect.ts`, `lib/service.ts` and the thin `app/[code]` / `app/r/[code]` adapters.
- LINK-04, AUTH-01 and INPUT-01: `lib/service.ts`, `features/links/server/repository.ts` and `shared/server/http.ts`.
- DATA-01: `features/analytics/server/repository.ts` and `features/analytics/activity-panel.tsx`.
- UI-01 and UI-02: `app/page.tsx`, `features/links/components/`, `features/links/use-link-actions.ts` and `features/workspace/`.
- INT-01: `features/workspace/components/workspace-dialogs.tsx` and `docs/integrations.md`.
- SDLC-01 and SDLC-02: `scripts/verify.mjs`, `.github/workflows/ci.yml`, this specification and `docs/delivery.md`.

Backend behavior and regression assertions are in `tests/service.test.mjs`; the browser observations are recorded separately in the delivery record.

## Explicit choices

- A title defaults to the destination hostname. URLs are at most 4,096 characters and titles at most 100 characters.
- Expiration is a timestamp; API callers should send an ISO 8601 timestamp with a timezone. The browser converts its local date/time input to an absolute timestamp.
- Known same-origin short-link destinations are rejected to avoid redirect chains. Arbitrary external URLs are not fetched during creation.
- Visitors, devices, regions and conversion attribution are outside scope. A click is a GET redirect attempt, including bots and repeats.
- The service has no public API-key issuance, team workspaces, billing, custom-domain provisioning or background crawler.
- Firecrawl enrichment and Apify dataset import are future feature slices, not prerequisites for reliable shortening.

## Release criteria

Before publishing a revised prototype, automated checks must pass for the reviewed source, input/ownership/redirect regressions must be covered, database changes must have a migration path, and documentation must identify remaining limits.

After publishing, check the public app and redirect routes. Exercise authenticated creation and management when a hosted session is available. Record unavailable checks as unverified; they do not become passing checks by assumption. A release with those gaps remains an evaluation prototype. Broader public adoption additionally requires abuse handling, measured capacity, backup/restore validation and a retention decision.
