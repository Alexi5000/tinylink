import { shortPath, type LinkRecord } from "./model";

export function isExpired(link: LinkRecord, now = Date.now()): boolean {
  return link.expires_at !== null && link.expires_at <= now;
}

export function isActive(link: LinkRecord, now = Date.now()): boolean {
  return (
    Boolean(link.active) && (link.expires_at === null || link.expires_at > now)
  );
}

export function exportLinksCsv(links: LinkRecord[], sample: boolean): void {
  const escapeCell = (value: string) => {
    const prefix = /^[=+@\-\t\r]/.test(value) ? "'" : "";
    return '"' + prefix + value.replace(/"/g, '""') + '"';
  };
  const rows = links.map((link) => [
    link.title,
    shortPath(link.code),
    link.url,
    String(link.clicks),
    isActive(link) ? "Active" : "Inactive",
  ]);
  const csv =
    "Title,Short path,Destination,Clicks,Status\n" +
    rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  anchor.download = sample ? "tinylink-sample.csv" : "tinylink-links.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
