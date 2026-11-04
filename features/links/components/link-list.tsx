"use client";
import { useState } from "react";
import {
  Link2,
  RefreshCw,
  Download,
  Search,
  X,
  Copy,
  CheckCheck,
  MoreHorizontal,
  ArrowUpRight,
  Pause,
  Play,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { shortPath, type LinkRecord } from "../model";
import { isActive as isLinkActive, exportLinksCsv } from "../presentation";
type Props = {
  now: number;
  rows: LinkRecord[];
  demo: boolean;
  loading: boolean;
  busy: string;
  copied: string;
  refresh: () => Promise<void>;
  copy: (link: LinkRecord) => Promise<void>;
  change: (link: LinkRecord) => Promise<void>;
  onDelete: (link: LinkRecord) => void;
  onPreview: () => void;
  notify: (message: string) => void;
};
export function LinkList({
  now,
  rows,
  demo,
  loading,
  busy,
  copied,
  refresh,
  copy,
  change,
  onDelete,
  onPreview,
  notify,
}: Props) {
  const isActive = (link: LinkRecord) => isLinkActive(link, now);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const shown = rows.filter(
    (link) =>
      (link.title + " " + link.url + " " + link.code)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All" ||
        (filter === "Active" ? isActive(link) : !isActive(link))),
  );
  const exportCsv = () => exportLinksCsv(rows, demo);
  return (
    <section className="links-section enter">
      <div className="list-heading">
        <div>
          <h2>
            Your links <span>{rows.length}</span>
          </h2>
          <p>Every destination, one place.</p>
        </div>
        <button
          className="icon-button"
          onClick={refresh}
          aria-label="Refresh links"
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
        <button
          className="quiet-button export-button"
          aria-label="Export links as CSV"
          onClick={exportCsv}
        >
          <Download size={15} />
          <span>Export</span>
        </button>
      </div>
      <div className="list-toolbar">
        <div className="filters">
          {["All", "Active", "Inactive"].map((t) => (
            <button
              key={t}
              className={filter === t ? "selected" : ""}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a link"
            aria-label="Search links"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      <div className="link-list">
        {shown.map((l, i) => (
          <article
            className="link-card"
            key={l.code}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div className={"domain-icon tone-" + (i % 4)}>
              <Link2 size={22} />
            </div>
            <div className="link-content">
              <div className="link-title">
                <h3>{l.title}</h3>
                <span
                  className={
                    "status-dot " + (isActive(l) ? "active" : "paused")
                  }
                  title={isActive(l) ? "Active" : "Inactive"}
                />
                {!isActive(l) && (
                  <span className="mobile-status">
                    {l.expires_at && l.expires_at <= now ? "Expired" : "Paused"}
                  </span>
                )}
              </div>
              <p className="link-destination" title={l.url}>
                {l.url.replace(/^https?:\/\//, "")}
              </p>
              <button className="short-link" onClick={() => copy(l)}>
                {shortPath(l.code)}
                <Copy size={12} />
              </button>
            </div>
            <div className="link-meta">
              <strong>{l.clicks.toLocaleString()}</strong>
              <span>clicks</span>
            </div>
            <span
              className={"status-badge " + (isActive(l) ? "active" : "paused")}
            >
              <i />
              {isActive(l)
                ? "Active"
                : l.expires_at && l.expires_at <= now
                  ? "Expired"
                  : "Paused"}
            </span>
            <div className="link-actions">
              <button
                className={"copy-button " + (copied === l.code ? "copied" : "")}
                onClick={() => copy(l)}
                aria-label={"Copy " + l.title}
              >
                {copied === l.code ? (
                  <CheckCheck size={16} />
                ) : (
                  <Copy size={16} />
                )}
                <span>{copied === l.code ? "Copied" : "Copy"}</span>
              </button>
              <details className="more-menu">
                <summary aria-label={"Actions for " + l.title}>
                  <MoreHorizontal size={19} />
                </summary>
                <div>
                  <button
                    onClick={() =>
                      demo
                        ? notify(
                            "Sample preview only. Create a real link first.",
                          )
                        : window.open(
                            shortPath(l.code),
                            "_blank",
                            "noopener,noreferrer",
                          )
                    }
                  >
                    <ArrowUpRight size={15} />
                    Open link
                  </button>
                  <button disabled={busy === l.code} onClick={() => change(l)}>
                    {l.active ? <Pause size={14} /> : <Play size={14} />}{" "}
                    {l.active ? "Pause link" : "Resume link"}
                  </button>
                  <button
                    className="delete-action"
                    onClick={() =>
                      demo ? notify("Sample links are read-only.") : onDelete(l)
                    }
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
      {!shown.length && (
        <div className="empty-state">
          <div className="empty-art" aria-hidden="true">
            <span />
            <span />
            <div>
              <Link2 size={28} />
            </div>
            <i className="spark-one" />
            <i className="spark-two" />
          </div>
          <h3>
            {loading && !demo
              ? "Getting things ready…"
              : rows.length
                ? "Nothing here just yet."
                : "Your next big thing starts small."}
          </h3>
          <p>
            {rows.length
              ? "Try another search or filter."
              : "Create your first short link. We’ll take care of the clicks."}
          </p>
          {!rows.length && (
            <button onClick={() => onPreview()}>
              Take a look around <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
      <div className="list-footer">
        <span>
          {demo ? "Sample data" : shown.length + " links"}
          <i /> {demo ? "Nothing here is live" : "Only visible to you"}
        </span>
        <span className="foot-tip">
          <ShieldCheck size={13} />
          Built for peace of mind
        </span>
      </div>
    </section>
  );
}
