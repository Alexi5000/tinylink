# Delivery and review record

## Execution model

The URL shortener is the product. Its repository demonstrates the engineering workflow: an explicit specification, decomposed work, bounded agent tasks, implementation, independent review, fixes and executable verification.

| Phase      | Work                                                                       | Reviewable output                                             |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Understand | Identify actors, API behavior, trust boundaries and ambiguous requirements | [Specification](spec.md), acceptance IDs and explicit choices |
| Plan       | Separate core links, analytics, reliability, interface and release work    | Feature tasks and [architecture decisions](architecture.md)   |
| Build      | Implement a persistent greenfield baseline                                 | Source, schema, migrations and tests                          |
| Improve    | Review the baseline and repair behavioral and maintenance defects          | Focused changes and regression tests                          |
| Validate   | Run automated checks and exercise browser/deployed behavior                | Verification report and release observations                  |
| Release    | Push reviewed source, publish through Sites and check the live app         | Source revision, deployment record and smoke-test result      |

The suggested 2–3 day allocation is core behavior on day one, analytics/reliability and interface refinement on day two, and regression/release work on day three. This is a planning model, not a fabricated historical timeline.

## Controlled autonomy

The user authorized implementation, persona-based review, fixes, a live URL and a GitHub push. Work is divided among a coordinating implementation agent and independent review lenses. Reviewers identify concrete findings; file ownership limits conflicting edits. The coordinator checks integrated behavior and owns the release decision within that authorization.

Agents may inspect code, implement scoped fixes, run checks and prepare release artifacts. Verification stops at a failed check. Publishing follows a passing review and validation pass. The workflow does not purchase a domain, invent provider credentials, make unrelated account changes or contact the named reviewers. New costs, ownership decisions or unavailable credentials require a specific user decision.

The process produces inspectable source and command results rather than treating an agent's confidence as validation. Human inspection remains appropriate for trust boundaries, UX judgments and broader production adoption.

## Three simulated review lenses

These are independent AI-assisted review lenses requested by the user. Peter Steinberger, Harrison Chase and the maintainer of `github.com/orneryd` did not review or approve this project. Their names identify the requested framing only; findings below belong to this project's review process.

| Lens                                                                 | Substantive findings                                                                                                                                                                                                                  | Implemented resolution                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Practical product engineering, framed around Peter Steinberger       | Sample mode hides live creation errors; negative redirect responses lack cache protection; dense source, unused scaffolding and low-contrast text weaken maintainability and usability.                                               | Visible mutation errors, no-store negative responses, readable feature slices, scaffold cleanup and contrast fixes                                      |
| Reliability and integration boundaries, framed around Harrison Chase | Request reads are unbounded; PATCH null becomes 503; invalid optional fields are silently coerced; malformed encoded paths fail as server errors; count-then-insert races the account quota. Awaited analytics adds redirect latency. | Bounded object parsing, strict fields, client errors for malformed paths, atomic quota enforcement, regression tests and an explicit latency limitation |
| Independent maintainer, framed around orneryd                        | The clean URL adapter lacks a direct regression; source and tests are compressed; README reads as a development chronicle; acceptance criteria and reproducible SDLC evidence are missing.                                            | Clean-route coverage, formatting and small boundaries, product-first README, acceptance mapping and a machine-readable verifier                         |

The implementation was re-inspected against these findings. Bounded parsing, malformed-code errors, atomic quotas, cache-safe negative responses and clean/legacy redirects have regression coverage. Source formatting, feature boundaries, scaffolding cleanup and documentation were inspected. The sample/error and dialog changes were inspected in code; visual and hosted-session confirmation remain separate checks. Two deterministic tests also cover a generated-code collision followed by success, and exhaustion after exactly five collisions without overwriting an existing link. Awaited analytics latency remains an explicit operating limit, not a resolved performance claim.

## Automated evidence

Run `npm run verify`. The ordered pipeline is:

1. `npm run format:check`
2. `npm test`
3. `npm run typecheck`
4. `npm run build`

Each check has a five-minute timeout; the CI job has a fifteen-minute limit. The command fails fast and writes `outputs/verification.json`. The report records the revision, whether the working tree differs from that revision, start time, overall status and each check's command, timing, exit code and status. Reports are generated artifacts and are excluded from source control. GitHub Actions uploads the report so a CI result can be inspected alongside its revision.

A dirty working tree report identifies a verification of local edits, not proof that the recorded commit alone passed. For a release, pair the report with the final source snapshot and inspect CI for the pushed revision. Checks not executed after a failure must not be described as passing.

## Release evidence

### Local validation

`npm run verify` passed on 4 November 2026 at 03:26 UTC using Node.js v24.22.1. Formatting, all 19 backend tests, TypeScript checking and the production build completed with exit code 0. The generated report ran from 03:26:34Z to 03:26:43Z and recorded `workingTreeDirty: true` against base revision `733739f07e16f00baa20fd35cfa0aca89fa86021`. This validates the local implementation snapshot at that point, not that base commit alone. Two additional deterministic collision tests were then added without changing production code; the backend test run passed all 21 tests. Documentation evidence was updated afterward and checked for formatting separately.

The test suite includes actual SQLite behavior, public clean/legacy paths, owner isolation, JSON byte limits and stream cancellation, malformed inputs, concurrent quota attempts, analytics batch rollback and rate limits. It does not establish real Cloudflare throughput or gateway authentication behavior.

### Publication and browser checks

The reviewed implementation was published as Sites version 4 on 4 November 2026. Source revision: `c05580852d9706c42b1833e7f9d650f0556646ad`; deployment: `appgdep_6aeaa6748fc08191ac52e1cf1f116f34`. Later documentation and screenshot changes do not change runtime behavior. GitHub and hosting commit identifiers differ because they are separate repositories; the GitHub Actions report identifies the exact pushed revision it verifies.

| Check                              | Observed result                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted authentication and creation | Signed in through ChatGPT and created `/github`, pointing to the private source repository.                                                                            |
| Pause and resume                   | Paused through the dashboard; a separate signed-out browser saw the inactive message. Resume restored the redirect.                                                    |
| Public route compatibility         | Both `/github` and `/r/github` reached the expected GitHub destination without a TinyLink session. GitHub itself requires repository access.                           |
| Analytics                          | The two public GET redirects appeared as two clicks after refreshing the workspace.                                                                                    |
| Mutation error                     | Reusing `github` displayed the duplicate-alias error; no extra record was created.                                                                                     |
| Mobile and desktop                 | Deployed UI inspected at the desktop default and 390×844. Mobile document width equaled viewport width (390px), with no horizontal overflow.                           |
| Sample and chart                   | Sample hid the live create form, displayed its illustrative-data notice, and switched between 7- and 30-day activity. Returning to Live restored the real workspace.   |
| Keyboard dialog                    | Tab focused Close; Shift+Tab wrapped to API docs; Escape closed the guide and restored focus to Guide.                                                                 |
| Delete and expiration              | Covered by SQLite regression tests; not exercised destructively against the retained live link.                                                                        |
| Header assertions                  | No-store and status assertions pass in service tests. Direct command-line production probes returned an edge403, so deployed headers were not independently confirmed. |
| Provider integrations              | Firecrawl and Apify remain inactive at runtime.                                                                                                                        |

The local managed preview served stale source and reported missing modules after restart. It was stopped; the browser observations above use the deployed application. Reduced-motion behavior and inline delete-error rendering were inspected in source, not exercised by fault injection in the live browser. No load, restore, abuse-response or uptime assessment was performed.

[Mobile sample preview](assets/mobile-preview.png) records the deployed visual check. The retained `/github` link is useful workspace data, not a fabricated analytics fixture. The CI workflow attaches `verification.json` to each pushed revision; consult that run for the current automated result.
