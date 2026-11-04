"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const storageKey = "tinylink-theme";
const changeEvent = "tinylink:theme-change";
const getTheme = () => document.documentElement.dataset.theme === "dark";
const serverTheme = () => false;

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#090909" : "#f7f9fa");
}

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    applyTheme(event.newValue === "dark");
    notify();
  };
  window.addEventListener("storage", sync);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(changeEvent, notify);
  };
}

export function ThemePicker() {
  const dark = useSyncExternalStore(subscribe, getTheme, serverTheme);
  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !getTheme();
        applyTheme(next);
        window.dispatchEvent(new Event(changeEvent));
        try {
          localStorage.setItem(storageKey, next ? "dark" : "light");
        } catch {
          // Keep the current-page choice when storage is unavailable.
        }
      }}
    >
      <Sun className="theme-sun" size={18} aria-hidden="true" />
      <Moon className="theme-moon" size={18} aria-hidden="true" />
    </button>
  );
}
