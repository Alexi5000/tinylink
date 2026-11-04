import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { service } from "../../lib/service.ts";

export function setup(testContext) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle")
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  testContext.after(() => sqlite.close());

  const db = {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) {
          args = values;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          return statement.execute();
        },
        execute() {
          const result = sqlite.prepare(sql).run(...args);
          return { meta: { changes: result.changes } };
        },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const req = (path, method = "GET", body, owner = "alice", headers = {}) =>
    service(
      new Request(`https://tiny.test${path}`, {
        method,
        headers: {
          ...(owner ? { "oai-authenticated-user-id": owner } : {}),
          ...headers,
        },
        body:
          body === undefined
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
      }),
      db,
    );
  const seedLink = (code, owner = "alice") =>
    sqlite
      .prepare(
        "INSERT INTO links (code,owner,url,title,created_at,generation) VALUES (?,?,?,?,?,?)",
      )
      .run(
        code,
        owner,
        "https://example.com/",
        code,
        Date.now(),
        crypto.randomUUID(),
      );
  return { db, req, sqlite, seedLink };
}
