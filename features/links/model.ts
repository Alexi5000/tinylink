export type LinkRecord = {
  code: string;
  title: string;
  url: string;
  active: number;
  clicks: number;
  created_at: number;
  expires_at: number | null;
};

export const RESERVED_CODES = new Set([
  "api",
  "r",
  "signin-with-chatgpt",
  "signout-with-chatgpt",
  "callback",
  "favicon.svg",
  "_next",
  "assets",
]);

export function shortPath(code: string): string {
  const prefix = RESERVED_CODES.has(code.toLowerCase()) ? "/r/" : "/";
  return prefix + encodeURIComponent(code);
}
