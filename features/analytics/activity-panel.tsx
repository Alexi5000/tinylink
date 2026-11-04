"use client";
import { useState } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import type { LinkRecord } from "../links/model";
export type DailyClicks = { day: string; clicks: number };
export function ActivityPanel({
  now,
  rows,
  days,
  demo,
  loading,
  unavailable,
}: {
  now: number;
  rows: LinkRecord[];
  days: DailyClicks[];
  demo: boolean;
  loading: boolean;
  unavailable: boolean;
}) {
  const [range, setRange] = useState(7);
  const series = Array.from({ length: range }, (_, i) => {
    const date = new Date(now - (range - 1 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return {
      day: key,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      clicks: demo
        ? Math.round(25 + ((i * 17) % 53) + Math.sin(i) * 12 + i * 0.5)
        : Number(days.find((d) => d.day === key)?.clicks || 0),
    };
  });
  const hasData = demo || days.length > 0 || (!loading && !unavailable);
  const max = Math.max(10, ...series.map((d) => d.clicks)),
    sum = series.reduce((a, b) => a + b.clicks, 0),
    coords = series
      .map(
        (d, i) =>
          `${(i / (series.length - 1)) * 800},${180 - (d.clicks / max) * 150}`,
      )
      .join(" ");
  return (
    <section className="activity-layout enter">
      <div className="chart-card">
        <div className="section-head">
          <div>
            <h2>Click activity</h2>
            <p>{demo ? "Illustrative activity" : "Recorded redirects"} · UTC</p>
          </div>
          <select
            aria-label="Analytics date range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <div className="chart-number">
          {!demo && loading && !days.length
            ? "Loading…"
            : !demo && unavailable && !days.length
              ? "Unavailable"
              : sum.toLocaleString()}
          <span>clicks this period</span>
        </div>
        <div className="chart" hidden={!hasData}>
          <div className="axis">
            <span>{max}</span>
            <span>{Math.round(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="plot">
            <svg
              viewBox="0 0 800 190"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${sum} clicks over ${range} days`}
            >
              <defs>
                <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6862db" stopOpacity=".17" />
                  <stop offset="100%" stopColor="#6862db" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 105, 180].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="800"
                  y1={y}
                  y2={y}
                  stroke="#eaeaf0"
                  strokeDasharray="4 6"
                />
              ))}
              <polygon
                points={"0,180 " + coords + " 800,180"}
                fill="url(#area)"
              />
              <polyline
                className="chart-line"
                points={coords}
                fill="none"
                stroke="#6862db"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="x-axis">
              {series
                .filter(
                  (_, i) =>
                    i === 0 || i === Math.floor(range / 2) || i === range - 1,
                )
                .map((d) => (
                  <span key={d.day}>{d.label}</span>
                ))}
            </div>
          </div>
        </div>
        <details className="daily-data" hidden={!hasData}>
          <summary>Daily click data · UTC</summary>
          <table>
            <caption>
              {range}-day click activity{demo ? " · illustrative data" : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {series.map((day) => (
                <tr key={day.day}>
                  <th scope="row">{day.day}</th>
                  <td>{day.clicks.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <p className="chart-note">
          {!demo && loading
            ? "Refreshing recorded activity…"
            : !demo && unavailable
              ? "Activity could not refresh. Any displayed values are the last loaded snapshot."
              : sum
                ? "Each successful redirect counts as one click, including repeat visits and bots."
                : "Share a short link. Your first click will appear here."}
        </p>
      </div>
      <div className="performers">
        <div className="section-head">
          <div>
            <h2>Top links</h2>
            <p>All-time clicks</p>
          </div>
          <ArrowUpRight size={17} />
        </div>
        {rows.length ? (
          [...rows]
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 4)
            .map((l, i) => (
              <div className="rank" key={l.code}>
                <span>0{i + 1}</span>
                <div>
                  <strong>{l.title}</strong>
                  <div className="track">
                    <i
                      style={{
                        width:
                          Math.max(
                            2,
                            (l.clicks /
                              Math.max(1, ...rows.map((r) => r.clicks))) *
                              100,
                          ) + "%",
                      }}
                    />
                  </div>
                </div>
                <b>{l.clicks.toLocaleString()}</b>
              </div>
            ))
        ) : (
          <div className="rank-empty">
            <Activity size={25} />
            <p>
              Your best-performing links
              <br />
              will find their place here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
