import type { LinkRecord } from "../model.ts";
import { ApiError } from "../../../shared/server/http.ts";
import { randomCode, type NewLink } from "./validation.ts";

export const ACCOUNT_LINK_LIMIT = 500;
const columns = "code, title, url, active, clicks, created_at, expires_at";

export async function listLinks(
  db: D1Database,
  owner: string,
): Promise<LinkRecord[]> {
  const result = await db
    .prepare(
      `
    SELECT ${columns} FROM links WHERE owner=? ORDER BY created_at DESC LIMIT ?
  `,
    )
    .bind(owner, ACCOUNT_LINK_LIMIT)
    .all<LinkRecord>();
  return result.results;
}

export function findLink(
  db: D1Database,
  code: string,
): Promise<LinkRecord | null> {
  return db
    .prepare(`SELECT ${columns} FROM links WHERE code=?`)
    .bind(code)
    .first<LinkRecord>();
}

export async function createLink(
  db: D1Database,
  owner: string,
  item: NewLink,
): Promise<LinkRecord> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = item.code || randomCode();
    // One statement keeps the quota check atomic with the insertion.
    const inserted = await db
      .prepare(
        `
      INSERT INTO links (code, owner, url, title, created_at, expires_at, active, clicks)
      SELECT ?, ?, ?, ?, ?, ?, 1, 0
      WHERE (SELECT COUNT(*) FROM links WHERE owner=?) < ?
      ON CONFLICT(code) DO NOTHING
      RETURNING ${columns}
    `,
      )
      .bind(
        code,
        owner,
        item.url,
        item.title,
        Date.now(),
        item.expires,
        owner,
        ACCOUNT_LINK_LIMIT,
      )
      .first<LinkRecord>();
    if (inserted) return inserted;
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM links WHERE owner=?")
      .bind(owner)
      .first<{ count: number }>();
    if (count && count.count >= ACCOUNT_LINK_LIMIT) {
      throw new ApiError(
        409,
        "This workspace supports up to 500 links per account.",
      );
    }
    if (item.code) throw new ApiError(409, "That alias is taken. Try another.");
  }
  throw new ApiError(503, "Could not reserve a code. Please retry.");
}

export async function requireOwnedLink(
  db: D1Database,
  owner: string,
  code: string,
) {
  const row = await db
    .prepare("SELECT code FROM links WHERE code=? AND owner=?")
    .bind(code, owner)
    .first<{ code: string }>();
  if (!row) throw new ApiError(404, "Link not found.");
}

export async function setLinkActive(
  db: D1Database,
  owner: string,
  code: string,
  active: boolean,
) {
  const result = await db
    .prepare("UPDATE links SET active=? WHERE code=? AND owner=?")
    .bind(active ? 1 : 0, code, owner)
    .run();
  if (!result.meta.changes) throw new ApiError(404, "Link not found.");
}

export async function deleteLink(db: D1Database, owner: string, code: string) {
  const result = await db
    .prepare("DELETE FROM links WHERE code=? AND owner=?")
    .bind(code, owner)
    .run();
  if (!result.meta.changes) throw new ApiError(404, "Link not found.");
}
