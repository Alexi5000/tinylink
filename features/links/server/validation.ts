import { RESERVED_CODES } from "../model.ts";
import { ApiError, jsonObject } from "../../../shared/server/http.ts";

export type NewLink = {
  url: string;
  code: string;
  title: string;
  expires: number | null;
};

function optionalString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string")
    throw new ApiError(400, `${field} must be a string.`);
  return value.trim();
}

export function validateLink(value: unknown, origin: string): NewLink {
  const data = jsonObject(value);
  if (typeof data.url !== "string" || data.url.length > 4096) {
    throw new ApiError(400, "Enter a valid URL (up to 4,096 characters).");
  }
  let url: URL;
  try {
    url = new URL(data.url);
  } catch {
    throw new ApiError(
      400,
      "Enter a complete URL starting with https:// or http://.",
    );
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new ApiError(
      400,
      "Use an HTTP or HTTPS URL without embedded credentials.",
    );
  }
  if (
    url.origin === origin &&
    (url.pathname.startsWith("/r/") || /^\/[^/]+\/?$/.test(url.pathname))
  ) {
    throw new ApiError(
      400,
      "Use the original destination, not another TinyLink.",
    );
  }
  const code = optionalString(data, "alias");
  if (RESERVED_CODES.has(code.toLowerCase())) {
    throw new ApiError(400, "That alias is reserved. Choose another.");
  }
  if (code && !/^[a-zA-Z0-9_-]{3,40}$/.test(code)) {
    throw new ApiError(
      400,
      "Aliases need 3–40 letters, numbers, hyphens, or underscores.",
    );
  }
  const title = optionalString(data, "title");
  if (title.length > 100)
    throw new ApiError(400, "Title must not exceed 100 characters.");
  const expiration = optionalString(data, "expiresAt");
  const match = expiration.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (expiration) {
    if (!match)
      throw new ApiError(400, "Use an ISO timestamp with a timezone.");
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
      match;
    const year = Number(yearText),
      month = Number(monthText),
      day = Number(dayText);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > days[month - 1] ||
      Number(hourText) > 23 ||
      Number(minuteText) > 59 ||
      Number(secondText || 0) > 59
    )
      throw new ApiError(400, "Choose a valid calendar timestamp.");
  }
  const expires = expiration ? Date.parse(expiration) : null;
  if (
    expires !== null &&
    (!Number.isFinite(expires) || expires <= Date.now())
  ) {
    throw new ApiError(400, "Choose an expiration in the future.");
  }
  return {
    url: url.href,
    code,
    title: title || url.hostname.slice(0, 100),
    expires,
  };
}

export function randomCode(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}
