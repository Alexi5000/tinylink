"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkRecord } from "../links/model";
import type { DailyClicks } from "../analytics/activity-panel";
import { errorMessage, request } from "./api";

export function useWorkspace() {
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [days, setDays] = useState<DailyClicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [health, setHealth] = useState("Checking");
  const generation = useRef(0);

  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

  const load = useCallback(async () => {
    const current = ++generation.current;
    // Health and analytics settle independently; neither delays usable links.
    void request("/api/health").then(
      () => {
        if (current === generation.current) setHealth("Operational");
      },
      () => {
        if (current === generation.current) setHealth("Unavailable");
      },
    );
    void request<{ days: DailyClicks[] }>("/api/analytics")
      .then(
        (data) => {
          if (current === generation.current) setDays(data.days);
        },
        (error) => {
          if (current === generation.current)
            setAnalyticsError(errorMessage(error));
        },
      )
      .finally(() => {
        if (current === generation.current) setAnalyticsLoading(false);
      });
    try {
      const data = await request<{ links: LinkRecord[] }>("/api/links");
      if (current === generation.current) setLinks(data.links);
    } catch (error) {
      if (current === generation.current) setLoadError(errorMessage(error));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setAnalyticsLoading(true);
    setLoadError("");
    setAnalyticsError("");
    await load();
  }, [load]);

  useEffect(() => {
    // All state updates in load follow awaited I/O; this effect starts the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  return {
    links,
    days,
    loading,
    analyticsLoading,
    loadError,
    analyticsError,
    health,
    refresh,
  };
}
