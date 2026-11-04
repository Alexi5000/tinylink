"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({
  title,
  close,
  children,
  wide = false,
  dismissible = true,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    closeRef.current = close;
    dismissibleRef.current = dismissible;
  }, [close, dismissible]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      node?.querySelector<HTMLElement>(
        "button:not(:disabled),input:not(:disabled)",
      ) ?? node
    )?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissibleRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const controls = Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === node)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      className="overlay"
      onClick={() => {
        if (dismissible) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={"dialog " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
            disabled={!dismissible}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
