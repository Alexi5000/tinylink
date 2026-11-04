# TinyLink

A focused URL shortener with a mobile-first workspace, custom aliases and click analytics. Built with React, Vinext and Cloudflare D1.

[Open the public app](https://tinylink.techtideai.chatgpt.site) · [Private source repository](https://github.com/Alexi5000/tinylink) · [Product specification](docs/spec.md)

Create links such as `https://tinylink.techtideai.chatgpt.site/launch`. The dashboard and redirects are public; sign-in is required to manage your own links. Repository access requires an invitation.

## Features

- Create, copy, search, pause, resume and delete links.
- Optional custom aliases, titles and expiration dates.
- All-time click totals, 7- and 30-day activity views and CSV export.
- Owner-scoped management, input validation, rate limits and durable storage.
- Labeled sample preview with no sample records written to the database.
- Responsive layouts, keyboard-accessible dialogs and reduced-motion support.

[View the mobile preview](docs/assets/mobile-preview.png). Sample data is clearly labeled in the interface.

## Run locally

Use Linux or macOS with **Node.js 24 or later** and the pinned **pnpm 11.25.0** lockfile.

```sh
git clone https://github.com/Alexi5000/tinylink.git
cd tinylink
npx --yes pnpm@11.25.0 install --frozen-lockfile
npm run verify
```

Initialize a fresh local database after the build completes. Run this loop once for a new database; on an existing database, apply only migrations that have not already been applied.

```sh
(
  set -e
  for migration in drizzle/[0-9]*.sql; do
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration"
  done
) && npm run dev
```

Open the reported localhost URL and use `/signin-with-chatgpt?return_to=/` to sign in through the loopback-only development emulator. Hosted identity comes from the Sites gateway. A deployment elsewhere must supply an equivalent trusted authentication boundary; client-supplied identity headers must never be trusted at a public origin.

## Verify changes

`npm run verify` runs formatting checks, lint, regression tests, TypeScript checking and the production build in order, stopping at the first failure. It writes revision, working-tree state, command outcomes and timings to `outputs/verification.json`. GitHub Actions runs the same pipeline for main-branch pushes and pull requests, and uploads its report.

The backend tests use actual SQLite with a D1 adapter. They validate application behavior, not Cloudflare performance or availability. Browser and deployed-route checks are separate release checks; a passing build does not establish production readiness.

For individual checks, use `npm run format:check`, `npm run lint`, `npm test`, `npm run typecheck` or `npm run build`. See the [delivery and review record](docs/delivery.md) for acceptance traceability and release evidence.

## API

Management endpoints use gateway-authenticated browser sessions; this version does not issue bearer API keys.

| Method   | Path               | Result                                                                          |
| -------- | ------------------ | ------------------------------------------------------------------------------- |
| POST     | `/api/links`       | Create from `{url, title?, alias?, expiresAt?}`; returns `201 {link, shortUrl}` |
| GET      | `/api/links`       | List the current owner's links, newest first                                    |
| PATCH    | `/api/links/:code` | Pause or resume with `{active: boolean}`                                        |
| DELETE   | `/api/links/:code` | Permanently delete a link and its analytics                                     |
| GET      | `/api/analytics`   | Nonzero daily click totals for the last 30 UTC days                             |
| GET/HEAD | `/:code`           | Public `302` redirect; HEAD does not increment clicks                           |
| GET      | `/api/health`      | Database probe; `200` when available, otherwise `503`                           |

Legacy `/r/:code` links remain supported. Missing links return `404`; paused or expired links return `410`. Full validation and status contracts are in the [specification](docs/spec.md).

## Operating limits

This is a publicly accessible prototype, suitable for evaluating the complete workflow. It has no availability SLA or completed load/restore testing.

- Up to 500 links per account and 30 management write attempts per account per fixed minute.
- Clicks count GET redirects, including bots and repeat visits. They are not unique visitors. The app does not collect IP addresses or user agents for analytics.
- Redirects continue if analytics recording fails, so counts can be lower than actual visits. Recording is awaited and adds database latency.
- Destinations are validated HTTP/HTTPS URLs but are not scanned for phishing or malware. Public self-service operation needs an abuse process and destination policy.
- Deleting a link deletes its analytics. Historical daily rows otherwise have no automated retention policy.
- Firecrawl and Apify are **not connected at runtime**. See [integration feasibility](docs/integrations.md).

The [second review record](docs/swarm-review.md) lists the 20 reviewers, their model assignments, confirmed findings and validation limits.

## Deployment and support

**Main-branch pushes and pull requests run verification; they do not deploy the app.** The Sites publishing workflow manages a separate hosting checkout. Apply the reviewed source there, run verification, publish through Sites, and smoke-test the deployed URL. Preserve the existing Site identity when updating this app. Sites provisions its database and applies tracked migrations.

The provided address uses the hosted `chatgpt.site` domain. No custom domain has been purchased or configured. A custom short domain requires a hostname you control and DNS setup.

Report reproducible defects in the private repository's issue tracker, including the affected action and any request ID. Do not include private destination URLs or credentials. Architecture, trust boundaries and operational follow-ups are documented in [architecture and decisions](docs/architecture.md).
