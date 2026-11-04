"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useClock } from "@/features/workspace/use-clock";
import {
  Link2,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  Activity,
  MousePointer2,
  BookOpen,
  Plug,
} from "lucide-react";
import { LinkComposer } from "@/features/links/components/link-composer";
import { LinkList } from "@/features/links/components/link-list";
import { sampleLinks } from "@/features/links/sample-links";
import { isActive } from "@/features/links/presentation";
import { useLinkActions } from "@/features/links/use-link-actions";
import { ActivityPanel } from "@/features/analytics/activity-panel";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { WorkspaceDialogs } from "@/features/workspace/components/workspace-dialogs";
import { Dialog } from "@/features/workspace/components/dialog";

export default function Home() {
  const [view, setView] = useState("Links");
  const [demo, setDemo] = useState(false);
  const [sheet, setSheet] = useState("");
  const [createdVersion, setCreatedVersion] = useState(0);
  const urlInput = useRef<HTMLInputElement>(null);
  const {
    links,
    days,
    loading,
    analyticsLoading,
    loadError,
    analyticsError,
    health,
    refresh,
  } = useWorkspace();
  const actions = useLinkActions({
    demo,
    refresh,
    onCreated: () => {
      setDemo(false);
      setView("Links");
      setCreatedVersion((version) => version + 1);
    },
  });
  const now = useClock();
  const rows = demo ? sampleLinks : links;
  const total = rows.reduce((sum, link) => sum + link.clicks, 0);
  const workspaceError = !demo
    ? [
        loadError && `Links: ${loadError}`,
        analyticsError && `Activity: ${analyticsError}`,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const error = [actions.actionError, workspaceError].filter(Boolean).join(" ");
  function createFocus() {
    setView("Links");
    setDemo(false);
    requestAnimationFrame(() => {
      urlInput.current?.focus();
      urlInput.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
    });
  }
  return (
    <div className="shell">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="TinyLink home">
            <span className="brand-mark">
              <Link2 size={23} strokeWidth={2.4} />
            </span>
            tinylink<span className="workspace-name">Workspace</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {["Links", "Activity"].map((name) => (
              <button
                className={view === name ? "selected" : ""}
                aria-pressed={view === name}
                key={name}
                onClick={() => setView(name)}
              >
                {name}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className={
                "sources-button " + (sheet === "Connections" ? "selected" : "")
              }
              aria-label="Open connections"
              onClick={() => setSheet("Connections")}
            >
              <Plug size={16} />
              <span>Connections</span>
            </button>
            <button
              className="icon-button help-button"
              aria-label="Open guide"
              onClick={() => setSheet("Guide")}
            >
              <BookOpen size={18} />
            </button>
            <button
              className="avatar"
              aria-label="Workspace details"
              onClick={() => setSheet("Workspace")}
            >
              <Link2 size={18} />
            </button>
          </div>
        </div>
      </header>
      <main>
        <div className="page-intro enter">
          <div>
            <div className="eyebrow">
              <span /> YOUR LINK WORKSPACE
            </div>
            <h1>
              {view === "Links" ? (
                <>
                  Short links.
                  <br className="mobile-break" />{" "}
                  <span>Lasting impressions.</span>
                </>
              ) : (
                "Every click tells a story."
              )}
            </h1>
            <p>
              {view === "Links"
                ? "A simpler way to create, share, and understand your links."
                : "A clear view of what happens after you share."}
            </p>
          </div>
          <div className="data-switch" aria-label="Data source">
            <button
              className={!demo ? "selected" : ""}
              aria-pressed={!demo}
              onClick={() => setDemo(false)}
            >
              Live
            </button>
            <button
              className={demo ? "selected" : ""}
              aria-pressed={demo}
              onClick={() => setDemo(true)}
            >
              Sample
            </button>
          </div>
        </div>
        {demo && (
          <div className="sample-banner">
            <span>
              <span className="sample-dot" />
              Sample preview · illustrative data
            </span>
            <button onClick={() => setDemo(false)}>
              Back to live <ArrowRight size={13} />
            </button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            <p>{error}</p>
            {error.includes("Sign in") ? (
              // Platform authentication requires a full top-level navigation.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/signin-with-chatgpt?return_to=%2F" target="_top">
                Sign in <ArrowRight size={14} />
              </a>
            ) : (
              <button
                onClick={() => {
                  actions.clearActionError();
                  void refresh();
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
        <div hidden={view !== "Links" || demo}>
          <LinkComposer
            onCreate={actions.create}
            saving={actions.saving}
            mutationBusy={!!actions.busy}
            urlInput={urlInput}
          />
        </div>
        <section className="metrics enter" aria-label="Workspace metrics">
          {[
            { icon: MousePointer2, label: "Total clicks", value: total },
            { icon: Link2, label: "Short links", value: rows.length },
            {
              icon: Activity,
              label: "Active links",
              value: rows.filter((link) => isActive(link, now)).length,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div className="metric" key={label}>
              <span className="metric-label">
                <Icon size={14} />
                {label}
              </span>
              <strong>
                {value.toLocaleString()}
                <span className="metric-unit">
                  {label === "Total clicks" ? "all time" : "in workspace"}
                </span>
              </strong>
            </div>
          ))}
        </section>
        {view === "Links" ? (
          <LinkList
            key={createdVersion}
            now={now}
            rows={rows}
            demo={demo}
            loading={loading}
            busy={!!actions.busy || actions.saving}
            copied={actions.copied}
            refresh={refresh}
            copy={actions.copy}
            change={actions.change}
            onDelete={actions.confirmDelete}
            onPreview={() => setDemo(true)}
            notify={actions.notify}
          />
        ) : (
          <ActivityPanel
            now={now}
            rows={rows}
            days={days}
            demo={demo}
            loading={analyticsLoading}
            unavailable={!!analyticsError}
          />
        )}
        <div className="bottom-note enter">
          <span>
            <span
              className={
                "service-dot " + (health === "Operational" ? "operational" : "")
              }
            />
            {health === "Operational"
              ? "Service reachable"
              : health === "Checking"
                ? "Checking service"
                : "Service unavailable"}
          </span>
          <button onClick={() => setSheet("Guide")}>
            A little guidance <ArrowUpRight size={13} />
          </button>
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          className={view === "Links" ? "selected" : ""}
          aria-pressed={view === "Links"}
          onClick={() => setView("Links")}
        >
          <Link2 size={19} />
          Links
        </button>
        <button
          className={view === "Activity" ? "selected" : ""}
          aria-pressed={view === "Activity"}
          onClick={() => setView("Activity")}
        >
          <Activity size={19} />
          Activity
        </button>
        <button
          className="mobile-create"
          onClick={createFocus}
          aria-label="Create a link"
        >
          <Plus size={23} />
        </button>
        <button
          aria-label="Open connections"
          onClick={() => setSheet("Connections")}
        >
          <Plug size={19} />
          Sources
        </button>
        <button onClick={() => setSheet("Guide")}>
          <BookOpen size={19} />
          Guide
        </button>
      </nav>
      {actions.message && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {actions.message}
        </div>
      )}
      {actions.remove && (
        <Dialog
          title="Delete link?"
          close={actions.closeDelete}
          dismissible={!actions.busy}
        >
          <div className="dialog-body">
            <p>
              <strong>{actions.remove.title}</strong> will stop redirecting. Its
              click history will be permanently removed.
            </p>
            {actions.deleteError && (
              <div className="error" role="alert">
                <p>{actions.deleteError}</p>
              </div>
            )}
            <div className="dialog-buttons">
              <button
                className="quiet-button"
                disabled={!!actions.busy}
                onClick={actions.closeDelete}
              >
                Keep link
              </button>
              <button
                className="danger"
                disabled={!!actions.busy}
                onClick={actions.deleteLink}
              >
                {actions.busy ? "Deleting…" : "Delete link"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {actions.manualCopy && (
        <Dialog title="Copy your short link" close={actions.closeManualCopy}>
          <div className="dialog-body manual-copy">
            <p>
              Clipboard access is unavailable. Select and copy this address.
            </p>
            <label htmlFor="manual-copy-url">Short URL</label>
            <input
              id="manual-copy-url"
              type="text"
              readOnly
              value={actions.manualCopy}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
            />
          </div>
        </Dialog>
      )}
      <WorkspaceDialogs
        sheet={sheet}
        close={() => setSheet("")}
        linkCount={links.length}
        demo={demo}
        onToggleSample={() => setDemo(!demo)}
      />
    </div>
  );
}
