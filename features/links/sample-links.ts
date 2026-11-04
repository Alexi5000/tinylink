import type { LinkRecord } from "./model";
export const sampleLinks: LinkRecord[] = [
  {
    code: "launch",
    title: "Product launch",
    url: "https://example.com/new-product",
    active: 1,
    clicks: 1248,
    created_at: Date.now() - 86400000,
    expires_at: null,
  },
  {
    code: "newsletter",
    title: "The weekly read",
    url: "https://example.com/newsletter",
    active: 1,
    clicks: 862,
    created_at: Date.now() - 2 * 86400000,
    expires_at: null,
  },
  {
    code: "portfolio",
    title: "Design portfolio",
    url: "https://example.com/portfolio",
    active: 1,
    clicks: 436,
    created_at: Date.now() - 3 * 86400000,
    expires_at: null,
  },
  {
    code: "early-access",
    title: "Early access",
    url: "https://example.com/waitlist",
    active: 0,
    clicks: 218,
    created_at: Date.now() - 5 * 86400000,
    expires_at: null,
  },
];
