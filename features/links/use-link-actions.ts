"use client";

import { useEffect, useState, type FormEvent } from "react";
import { request, errorMessage } from "../workspace/api";
import { shortPath, type LinkRecord } from "./model";

export function useLinkActions({
  demo,
  refresh,
  onCreated,
}: {
  demo: boolean;
  refresh: () => Promise<void>;
  onCreated: () => void;
}) {
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [remove, setRemove] = useState<LinkRecord | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function create(
    event: FormEvent<HTMLFormElement>,
    onSuccess: () => void,
  ) {
    event.preventDefault();
    if (demo) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setActionError("");
    try {
      const expires = values.get("expiresAt") as string | null;
      const data = await request<{ link: LinkRecord }>("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: values.get("url"),
          title: values.get("title") ?? undefined,
          alias: values.get("alias") ?? undefined,
          expiresAt: expires ? new Date(expires).toISOString() : null,
        }),
      });
      form.reset();
      onSuccess();
      onCreated();
      await refresh();
      setMessage("Your link is ready. " + shortPath(data.link.code));
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function change(link: LinkRecord) {
    if (demo) {
      setMessage(
        "Sample links are read-only. Switch to live to manage your links.",
      );
      return;
    }
    setBusy(link.code);
    setActionError("");
    try {
      await request("/api/links/" + encodeURIComponent(link.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !link.active }),
      });
      await refresh();
      setMessage(link.active ? "Link paused" : "Link resumed");
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  function confirmDelete(link: LinkRecord) {
    if (demo) return;
    setDeleteError("");
    setRemove(link);
  }

  async function deleteLink() {
    if (!remove || demo) return;
    setBusy(remove.code);
    setDeleteError("");
    try {
      await request("/api/links/" + encodeURIComponent(remove.code), {
        method: "DELETE",
      });
      setRemove(null);
      await refresh();
      setMessage("Link deleted");
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function copy(link: LinkRecord) {
    if (demo) {
      setMessage("Sample preview only. Create a link to copy it.");
      return;
    }
    setActionError("");
    try {
      await navigator.clipboard.writeText(
        location.origin + shortPath(link.code),
      );
      setCopied(link.code);
      setMessage("Copied. Ready to share.");
    } catch {
      setActionError(
        "Clipboard unavailable. Open the link and copy its address.",
      );
    }
  }

  return {
    create,
    change,
    confirmDelete,
    deleteLink,
    copy,
    closeDelete: () => setRemove(null),
    remove,
    saving,
    busy,
    copied,
    message,
    notify: setMessage,
    actionError,
    clearActionError: () => setActionError(""),
    deleteError,
  };
}
