"use client";
import { useState } from "react";
import {
  Flame,
  Box,
  ShieldCheck,
  ArrowRight,
  Link2,
  Code2,
} from "lucide-react";
import { Dialog } from "./dialog";
type Props = {
  sheet: string;
  close: () => void;
  linkCount: number;
  demo: boolean;
  onToggleSample: () => void;
};
export function WorkspaceDialogs({
  sheet,
  close,
  linkCount,
  demo,
  onToggleSample,
}: Props) {
  const [help, setHelp] = useState("Quick start");
  return (
    <>
      {sheet === "Connections" && (
        <Dialog title="A little more context." close={close}>
          <div className="dialog-body">
            <p className="dialog-description">
              Bring useful page details into your links. Your links work
              independently of these sources.
            </p>
            <div className="integration">
              <div className="integration-icon fire">
                <Flame size={23} />
              </div>
              <div>
                <h3>Firecrawl</h3>
                <span className="integration-state">
                  Not connected to this app
                </span>
              </div>
              <span className="pending-dot" />
            </div>
            <p className="integration-copy">
              Enrich links with page titles, descriptions, and preview images. A
              retrieval test succeeded; in-app access is still pending.
            </p>
            <div className="integration">
              <div className="integration-icon apify">
                <Box size={22} />
              </div>
              <div>
                <h3>Apify</h3>
                <span className="integration-state">Connection required</span>
              </div>
              <span className="pending-dot" />
            </div>
            <p className="integration-copy">
              Import structured website data from a selected actor or dataset
              once a connection is available.
            </p>
            <div className="connection-note">
              <ShieldCheck size={18} />
              <p>
                Neither source is active in TinyLink yet. No credentials are
                stored in the browser, and no page is scraped when you create a
                link.
              </p>
            </div>
          </div>
        </Dialog>
      )}
      {sheet === "Workspace" && (
        <Dialog title="Your workspace" close={close}>
          <div className="dialog-body">
            <div className="workspace-profile">
              <span className="avatar">
                <Link2 size={20} />
              </span>
              <div>
                <h3>Your link workspace</h3>
                <p>Personal workspace</p>
              </div>
            </div>
            <div className="workspace-row">
              <span>Link capacity</span>
              <strong>{linkCount} / 500</strong>
            </div>
            <div className="workspace-row">
              <span>Link management</span>
              <strong>Signed-in account only</strong>
            </div>
            <p className="integration-copy">
              The app and short-link redirects are public. Sign in to create
              links and view your own analytics.
            </p>
            <button
              className="quiet-button"
              onClick={() => {
                close();
                onToggleSample();
              }}
            >
              {demo ? "Return to live data" : "Explore sample workspace"}
              <ArrowRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {sheet === "Guide" && (
        <Dialog title="The essentials" close={close} wide>
          <div className="guide-tabs">
            {["Quick start", "API docs"].map((t) => (
              <button
                className={help === t ? "selected" : ""}
                aria-pressed={help === t}
                key={t}
                onClick={() => setHelp(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="dialog-body">
            {help === "Quick start" ? (
              <div className="quick-guide">
                {[
                  [
                    "01",
                    "Create",
                    "Paste a destination URL. Add a name, alias, or expiration under Link options.",
                  ],
                  [
                    "02",
                    "Share",
                    "Copy your short link. Anyone with the link can open its destination.",
                  ],
                  [
                    "03",
                    "Understand",
                    "Visit Activity for real click totals. Pause, resume, or delete from a link’s menu.",
                  ],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <section>
                      <h3>{t}</h3>
                      <p>{d}</p>
                    </section>
                  </div>
                ))}
                <div className="connection-note">
                  <ShieldCheck size={18} />
                  <p>
                    Sample mode uses illustrative data. It never adds records or
                    changes your real links.
                  </p>
                </div>
              </div>
            ) : (
              <ApiGuide />
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
function ApiGuide() {
  return (
    <div className="docs-grid">
      <section className="panel doc">
        <span className="doc-kicker">API REFERENCE · V1</span>
        <h2>
          Simple endpoints.
          <br />
          Predictable responses.
        </h2>
        <p>
          Management requests require your signed-in ChatGPT identity.
          Short-link redirects are public. Use same-origin requests from the
          app; API keys are outside the MVP scope.
        </p>
        {[
          [
            "POST",
            "/api/links",
            "Create a short link. Returns 201; duplicate aliases return 409.",
          ],
          ["GET", "/api/links", "List your latest links (maximum 500)."],
          [
            "PATCH",
            "/api/links/:code",
            'Pause or resume using { "active": false }.',
          ],
          ["DELETE", "/api/links/:code", "Delete a link and its analytics."],
          [
            "GET",
            "/api/analytics",
            "Daily click totals for the last 30 UTC days.",
          ],
          [
            "GET",
            "/:code",
            "302 redirect; missing links return 404, inactive links 410.",
          ],
          [
            "GET",
            "/api/health",
            "Check application and database availability.",
          ],
        ].map(([m, p, d]) => (
          <div className="endpoint" key={m + p}>
            <div>
              <span>{m}</span>
              <code>{p}</code>
            </div>
            <p>{d}</p>
          </div>
        ))}
      </section>
      <div>
        <section className="code-card">
          <div>
            <Code2 size={17} /> Create a link
          </div>
          <pre>{`fetch('/api/links', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    url: 'https://example.com/launch',\n    title: 'Product launch',\n    alias: 'launch'\n  })\n})`}</pre>
          <div>201 CREATED</div>
          <pre>{`{\n  "link": {\n    "code": "launch",\n    "active": 1,\n    "clicks": 0,\n    "...": "additional link fields"\n  },\n  "shortUrl": "<origin>/launch"\n}`}</pre>
        </section>
        <section className="panel doc">
          <h2>Designed to fail clearly.</h2>
          <p>
            400 validation · 401 authentication · 403 origin · 404 missing · 409
            conflict · 410 inactive · 429 rate limit · 503 unavailable
          </p>
          <p>
            30 management writes per user per minute. A 429 includes
            Retry-After. Redirects use no-store so pauses take effect without
            stale browser caching.
          </p>
          <p>
            Clicks count GET redirects, including bots. HEAD requests do not
            count. No IP addresses, user agents, or cookies are stored for
            analytics.
          </p>
        </section>
      </div>
    </div>
  );
}
