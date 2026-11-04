"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError, request, errorMessage } from "../workspace/api";
import { shortPath, type LinkRecord } from "./model";
import { isExpired } from "./presentation";

export function useLinkActions({
  demo,
  refresh,
  onCreated,
}: {
  demo: boolean;
  refresh: () => Promise<boolean | void>;
  onCreated: () => void;
}) {
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionAuthenticationRequired, setActionAuthenticationRequired] =
    useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [manualCopy, setManualCopy] = useState("");
  const mutationPending = useRef(false);
  const deleting = useRef(false);
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
    if (demo || mutationPending.current) return;
    mutationPending.current = true;
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setActionError("");
    setActionAuthenticationRequired(false);
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
      const refreshed = await refresh();
      setMessage(
        refreshed === false
          ? "Link saved, but the list could not be refreshed."
          : "Your link is ready. " + shortPath(data.link.code),
      );
    } catch (error) {
      setActionAuthenticationRequired(
        error instanceof ApiRequestError && error.status === 401,
      );
      setActionError(errorMessage(error));
    } finally {
      mutationPending.current = false;
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
    if (mutationPending.current) return;
    if (isExpired(link)) {
      setActionError(
        "This link has expired. Create a new link to share it again.",
      );
      return;
    }
    mutationPending.current = true;
    setBusy(link.code);
    setActionError("");
    setActionAuthenticationRequired(false);
    try {
      await request("/api/links/" + encodeURIComponent(link.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !link.active }),
      });
      const refreshed = await refresh();
      setMessage(
        (link.active ? "Link paused" : "Link resumed") +
          (refreshed === false ? ", but the list could not be refreshed." : ""),
      );
    } catch (error) {
      setActionAuthenticationRequired(
        error instanceof ApiRequestError && error.status === 401,
      );
      setActionError(errorMessage(error));
    } finally {
      mutationPending.current = false;
      setBusy("");
    }
  }

  function confirmDelete(link: LinkRecord) {
    if (demo || mutationPending.current) return;
    setDeleteError("");
    setRemove(link);
  }

  async function deleteLink() {
    if (!remove || demo || mutationPending.current) return;
    mutationPending.current = true;
    deleting.current = true;
    setBusy(remove.code);
    setDeleteError("");
    try {
      await request("/api/links/" + encodeURIComponent(remove.code), {
        method: "DELETE",
      });
      setRemove(null);
      const refreshed = await refresh();
      setMessage(
        refreshed === false
          ? "Link deleted, but the list could not be refreshed."
          : "Link deleted",
      );
    } catch (error) {
      setActionAuthenticationRequired(
        error instanceof ApiRequestError && error.status === 401,
      );
      setDeleteError(errorMessage(error));
    } finally {
      deleting.current = false;
      mutationPending.current = false;
      setBusy("");
    }
  }

  async function copy(link: LinkRecord) {
    if (demo) {
      setMessage("Sample preview only. Create a link to copy it.");
      return;
    }
    setActionError("");
    setActionAuthenticationRequired(false);
    const url = location.origin + shortPath(link.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(link.code);
      setMessage("Copied. Ready to share.");
    } catch {
      setManualCopy(url);
    }
  }

  return {
    create,
    change,
    confirmDelete,
    deleteLink,
    copy,
    closeDelete: () => {
      if (!deleting.current) setRemove(null);
    },
    manualCopy,
    closeManualCopy: () => setManualCopy(""),
    remove,
    saving,
    busy,
    copied,
    message,
    notify: setMessage,
    actionError,
    actionAuthenticationRequired,
    clearActionError: () => setActionError(""),
    deleteError,
  };
}
