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

  const load = useCallback(async () => {
    const current = ++generation.current;
    const healthCheck = request("/api/health").then(
      () => "Operational",
      () => "Unavailable",
    );
    try {
      const [linkData, analytics] = await Promise.all([
        request<{ links: LinkRecord[] }>("/api/links"),
        request<{ days: DailyClicks[] }>("/api/analytics"),
      ]);
      if (current === generation.current) {
        setLinks(linkData.links);
        setDays(analytics.days);
      }
    } catch (error) {
      if (current === generation.current) setLoadError(errorMessage(error));
    } finally {
      if (current === generation.current) setLoading(false);
    }
    const status = await healthCheck;
    if (current === generation.current) setHealth(status);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
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

  return { links, days, loading, loadError, health, refresh };
}
