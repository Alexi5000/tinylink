"use client";
import { useState, type FormEvent, type RefObject } from "react";
import {
  Link2,
  ShieldCheck,
  LoaderCircle,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";
type Props = {
  onCreate: (
    event: FormEvent<HTMLFormElement>,
    onSuccess: () => void,
  ) => Promise<void>;
  saving: boolean;
  urlInput: RefObject<HTMLInputElement | null>;
};
export function LinkComposer({ onCreate, saving, urlInput }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const create = (event: FormEvent<HTMLFormElement>) =>
    onCreate(event, () => setAdvanced(false));
  return (
    <section className="composer enter" aria-label="Create a short link">
      <div className="composer-top">
        <span className="composer-icon">
          <Link2 size={18} />
        </span>
        <h2>Make your next connection.</h2>
        <span className="private-tag">
          <ShieldCheck size={13} /> Your workspace
        </span>
      </div>
      <form onSubmit={create}>
        <div className="input-row">
          <label className="destination">
            <Link2 size={19} />
            <input
              ref={urlInput}
              name="url"
              type="url"
              required
              maxLength={4096}
              placeholder="Paste a long URL…"
              aria-label="Destination URL"
              autoComplete="url"
            />
          </label>
          <button className="primary" disabled={saving}>
            {saving ? <LoaderCircle size={17} className="spin" /> : null}
            {saving ? "Creating" : "Create link"}
            {!saving && <ArrowUpRight size={18} />}
          </button>
        </div>
        <div className="composer-bottom">
          <span>Good links take you places.</span>
          <button
            type="button"
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal size={13} />
            {advanced ? "Fewer options" : "Link options"}
          </button>
        </div>
        <div className={"options-wrap " + (advanced ? "expanded" : "")}>
          <div className="options-inner">
            <label>
              Title
              <input
                name="title"
                placeholder="e.g. Spring campaign"
                maxLength={100}
                disabled={!advanced}
              />
            </label>
            <label>
              Custom alias
              <input
                name="alias"
                placeholder="spring-campaign"
                pattern="[a-zA-Z0-9_-]{3,40}"
                disabled={!advanced}
              />
            </label>
            <label>
              Expires
              <input
                name="expiresAt"
                type="datetime-local"
                disabled={!advanced}
              />
            </label>
          </div>
        </div>
      </form>
      <div className="composer-glow" aria-hidden="true" />
    </section>
  );
}
