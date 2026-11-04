"use client";

import { useEffect, useRef } from "react";
import { SunMoon } from "lucide-react";

const storageKey = "tinylink-theme";
const validTheme = (value: string | null): string =>
  value === "light" || value === "dark" ? value : "system";

export function ThemePicker() {
  const select = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (select.current)
      select.current.value = validTheme(
        document.documentElement.dataset.theme ?? null,
      );
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      const theme = validTheme(event.newValue);
      document.documentElement.dataset.theme = theme;
      if (select.current) select.current.value = theme;
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <label className="theme-picker" title="Color theme">
      <SunMoon size={16} aria-hidden="true" />
      <select
        ref={select}
        aria-label="Color theme"
        defaultValue="system"
        onChange={(event) => {
          const theme = validTheme(event.target.value);
          document.documentElement.dataset.theme = theme;
          try {
            localStorage.setItem(storageKey, theme);
          } catch {
            // The current-page choice still works when storage is unavailable.
          }
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
