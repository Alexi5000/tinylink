# Second review: 20 agents, three models

This review covers the working URL shortener and its delivery workflow. It was requested after the first release. Twenty distinct agents reviewed bounded areas across Sol, Terra and Astra; up to six ran alongside the coordinator. Reviews were batched, findings were reconciled, and fixes were assigned by file ownership. Agent count is an execution record, not a measure of correctness.

## Review roster

| ID  | Model | Scope                                                  |
| --- | ----- | ------------------------------------------------------ |
| 01  | Sol   | HTTP and input contracts                               |
| 02  | Terra | Storage, transactions and concurrency                  |
| 03  | Astra | Authentication, ownership and security boundaries      |
| 04  | Sol   | Frontend state and mutation races                      |
| 05  | Terra | Accessibility and mobile interaction                   |
| 06  | Astra | Requirement interpretation and SDLC evidence           |
| 07  | Terra | Redirects, aliases and route compatibility             |
| 08  | Sol   | Analytics semantics and attribution                    |
| 09  | Astra | Export, copying, filtering and draft behavior          |
| 10  | Terra | Client requests and failure recovery                   |
| 11  | Sol   | CI, reproducibility and process supervision            |
| 12  | Terra | README and setup accuracy                              |
| 13  | Sol   | Pragmatic product-maintainer perspective               |
| 14  | Astra | Integration and reliability perspective                |
| 15  | Terra | Conservative maintenance and compatibility perspective |
| 16  | Astra | Test assertions and evidence boundaries                |
| 17  | Sol   | Populated-database migration and old writers           |
| 18  | Terra | Operations and prototype readiness                     |
| 19  | Astra | Independent final backend review                       |
| 20  | Sol   | Independent final product and delivery review          |

Exact model identifiers, findings, checks and limitations are retained in [the review manifest](reviews/round-2.json). Reviews began against hosting source `8dff010a0b3d10c4f2b8dd7fe9c5e1de96764afb` and GitHub commit `bcaecf7fb807fdbed261d16b602e8fd7b49c9c02`. Later reviewers inspected the working fixes; these were not twenty identical reviews of a frozen revision.

The user requested the perspectives associated with Peter Steinberger, Harrison Chase and `github.com/orneryd`. Reviewers 13–15 used those as framing only and rechecked their original findings. None of those people participated or endorsed the project. The repository makes no claim of approval from external authors.

## Work ownership and requirement traceability

| Work                                     | Acceptance IDs                       | Owner                  | Output                                                                           |
| ---------------------------------------- | ------------------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| Confirm scope and preserve public access | AUTH-01, SDLC-02                     | Coordinator            | Specification, public hosting setting, signed-out browser check                  |
| Fix validation and analytics identity    | INPUT-01, DATA-01                    | 02                     | Calendar validation, immutable generation checks, additive migration             |
| Preserve draft and mutation behavior     | UI-01, UI-02                         | 04                     | Feature hooks, accessible components and frontend regressions                    |
| Bound verification and include lint      | SDLC-01                              | 11                     | Process-group supervisor, failure tests and common CI command                    |
| Strengthen independent test expectations | LINK-03, INPUT-01, DATA-01, LIMIT-01 | 16                     | Real route-adapter imports, literal byte limits, date and rate-window boundaries |
| Review integrated changes                | All                                  | 19, 20 and coordinator | Final bounded reviews, automated report, deployment observations                 |
| Publish the reviewed source              | SDLC-01, SDLC-02                     | Coordinator            | GitHub commit and CI artifact; separate Sites release                            |

The original schema and public routes are the greenfield baseline. This pass is a brownfield enhancement: preserve existing links, add a forward migration, repair failures, and extend tests. Ambiguous choices remain explicit: public viewing with authenticated management, read-only sample data, aggregate click counting, a small account quota, and inactive external providers.

## Findings and decisions

| Confirmed issue                                                                         | Resolution                                                                                             | Evidence                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Alias deletion and reuse could credit an earlier redirect to a replacement link         | A private immutable generation token guards both analytics writes                                      | Deterministic interleaving regression                 |
| New generation field could break older writers during rollout or rollback               | Backfill populated rows and assign tokens with an insert trigger when older code omits the field       | Populated migration and two legacy inserts regression |
| Impossible expiration dates rolled into another date; derived titles exceeded their cap | Require calendar-valid ISO timestamps with a timezone; truncate hostname-derived titles                | Validation regressions                                |
| Concurrent actions and dismissible pending deletion confused state                      | Serialize mutations with a synchronous guard and lock pending deletion dismissal                       | Deferred-response hook regressions                    |
| Collapsing options or switching views lost configured data                              | Keep draft controls mounted and preserve their values; block edits while creating                      | Hook checks plus browser smoke                        |
| Creation could remain hidden by filters                                                 | Reset filters and return to Links on successful creation                                               | Source and hook review                                |
| Health and analytics failures blocked otherwise usable links                            | Settle data sources independently and bound client requests                                            | Deferred-response hook regressions                    |
| Clipboard fallback pointed at the destination                                           | Show the actual short URL in a selectable field                                                        | Rejected-clipboard regression                         |
| Expired links could report misleading resume success                                    | Explain expiration and prevent ineffective UI actions                                                  | Expired-action regression                             |
| Control states, search focus, status labels and chart data were inaccessible            | Add pressed states, focus styling, text labels, adequate clear target and a daily-value alternative    | Source review and browser checks                      |
| Errors discarded support references                                                     | Preserve safe server request IDs in displayed errors                                                   | API regression                                        |
| A timed-out command could ignore TERM or leave descendants                              | Supervise a dedicated process group; escalate to KILL after two seconds                                | Real subprocess regressions                           |
| Tests overstated route and boundary coverage                                            | Import actual route adapters with a stubbed environment; assert independent byte/day/minute boundaries | Service regressions                                   |
| README setup could continue after failed migration                                      | Stop the migration subshell on error and start only on success                                         | Command inspection                                    |

The operations reviewer suggested richer internal error classification. That remains a low-priority follow-up: current logs deliberately contain event names and request IDs without destinations, identities or raw database errors. This does not block the prototype, and the visible request ID now reaches the user.

## Release checks and limits

`npm run verify` runs formatting, lint, tests, type checking and the production build. A failed step stops the sequence. Linux/macOS checks have a five-minute deadline, process-group cleanup and a two-second forced-shutdown grace period. CI adds a fifteen-minute job limit and uploads `verification.json`, identifying the exact GitHub revision.

Backend tests use real SQLite through a D1 adapter. Route tests import the actual adapters while stubbing the Cloudflare environment; they do not prove framework route discovery or edge behavior. Frontend tests exercise production hooks with a small state/ref adapter and controlled promises; they are not browser-rendering tests. Process supervision tests create real child processes. Browser observations and deployment results are recorded separately.

The live dashboard and redirects remain public. Sign-in protects owner-specific management; public access does not mean anonymous writes. Runtime Firecrawl and Apify connections remain unconfigured. No load, backup/restore, uptime, abuse-response or cross-browser certification is claimed.

## Integrated verification

The coordinator ran the full verification pipeline on 2026-11-04T03:46:31.885Z. All 40 tests passed, alongside formatting, ESLint, TypeScript and the production build. The report identifies a dirty working tree based on `8dff010a0b3d10c4f2b8dd7fe9c5e1de96764afb`; the final GitHub CI report identifies the committed snapshot. No unresolved blocker was found by final reviewers 19 and 20. Reviewers 13–15 also rechecked and closed their original findings within their stated scopes.

## Deployed browser observations

Sites version 6 deployed successfully on 2026-11-04 from hosting source `fc9482ce8a54f50525b92aaf4e1710fae1ae2f1f`. The existing `/github` record and its two clicks survived the migration. In the signed-in workspace, a draft retained its destination, title and custom alias across Activity/Links navigation. Creating it with advanced options collapsed produced `/readme` with the expected title and destination. Copy returned the complete short URL, and opening that URL reached the configured GitHub README.

At a 390 × 844 viewport, the document had no horizontal overflow and active status remained visible as text. The [live mobile capture](assets/release-proof.png) records the two retained links. Public hosting access was preserved; owner data and management still require sign-in. These are bounded smoke checks, not cross-browser or load certification. The final documentation-only publication preserves this verified runtime build.
