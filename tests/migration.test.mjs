import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { recordClick } from "../features/analytics/server/repository.ts";

test("upgrade preserves existing data and assigns unique generations to legacy writers", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("PRAGMA foreign_keys=ON");
    sqlite.exec(readFileSync("drizzle/0000_pink_havok.sql", "utf8"));
    const legacyInsert = sqlite.prepare(
      "INSERT INTO links (code, owner, url, title, created_at) VALUES (?, ?, ?, ?, ?) RETURNING code, url",
    );
    legacyInsert.get("old1", "alice", "https://old.example/", "one", 1);
    legacyInsert.get("old2", "alice", "https://old2.example/", "two", 2);
    sqlite.exec(
      "UPDATE links SET clicks=3 WHERE code='old1'; INSERT INTO daily VALUES ('old1', '2099-01-01', 3)",
    );
    sqlite.exec(readFileSync("drizzle/0001_outgoing_lizard.sql", "utf8"));
    const old = sqlite
      .prepare("SELECT generation, clicks FROM links WHERE code='old1'")
      .get();
    assert.equal(old.clicks, 3);
    assert.equal(
      sqlite.prepare("SELECT clicks FROM daily WHERE code='old1'").get().clicks,
      3,
    );
    const first = legacyInsert.get(
      "legacy1",
      "bob",
      "https://one.example/",
      "one",
      3,
    );
    const second = legacyInsert.get(
      "legacy2",
      "bob",
      "https://two.example/",
      "two",
      4,
    );
    assert.equal(first.code, "legacy1");
    assert.equal(second.code, "legacy2");
    const generations = sqlite
      .prepare("SELECT generation FROM links")
      .all()
      .map((row) => row.generation);
    assert.equal(new Set(generations).size, 4);
    assert.ok(
      generations.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        ),
      ),
    );

    sqlite.prepare("DELETE FROM links WHERE code='old1'").run();
    legacyInsert.get(
      "old1",
      "bob",
      "https://replacement.example/",
      "replacement",
      5,
    );
    const adapter = {
      prepare(sql) {
        return {
          bind(...args) {
            return { execute: () => sqlite.prepare(sql).run(...args) };
          },
        };
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          statements.forEach((s) => s.execute());
          sqlite.exec("COMMIT");
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    };
    await recordClick(adapter, "old1", old.generation);
    assert.equal(
      sqlite.prepare("SELECT clicks FROM links WHERE code='old1'").get().clicks,
      0,
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS n FROM daily WHERE code='old1'").get()
        .n,
      0,
    );
    assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    sqlite.close();
  }
});
