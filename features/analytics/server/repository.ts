export type DailyClicks = { day: string; clicks: number };

export async function recordClick(
  db: D1Database,
  code: string,
  generation: string,
) {
  await db.batch([
    db
      .prepare("UPDATE links SET clicks=clicks+1 WHERE code=? AND generation=?")
      .bind(code, generation),
    db
      .prepare(
        `
      INSERT INTO daily (code, day, clicks)
      SELECT code, ?, 1 FROM links WHERE code=? AND generation=?
      ON CONFLICT(code, day) DO UPDATE SET clicks=clicks+1
    `,
      )
      .bind(new Date().toISOString().slice(0, 10), code, generation),
  ]);
}

export async function listDailyClicks(
  db: D1Database,
  owner: string,
): Promise<DailyClicks[]> {
  const since = new Date(Date.now() - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const result = await db
    .prepare(
      `
    SELECT d.day, SUM(d.clicks) AS clicks FROM daily d
    JOIN links l ON l.code=d.code
    WHERE l.owner=? AND d.day>=? GROUP BY d.day ORDER BY d.day
  `,
    )
    .bind(owner, since)
    .all<DailyClicks>();
  return result.results;
}
