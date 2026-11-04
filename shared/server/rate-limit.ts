import { ApiError } from "./http.ts";

export async function checkMutationLimit(db: D1Database, owner: string) {
  const now = Date.now();
  const key = `${owner}:${Math.floor(now / 60_000)}`;
  const rate = await db
    .prepare(
      `
    INSERT INTO limits (key, count, until) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count
  `,
    )
    .bind(key, now + 120_000)
    .first<{ count: number }>();
  if (!rate) throw new Error("Rate limit write failed");
  if (rate.count > 30) {
    throw new ApiError(429, "Too many changes. Try again in a minute.", {
      "Retry-After": "60",
    });
  }
  await db.prepare("DELETE FROM limits WHERE until<?").bind(now).run();
}
