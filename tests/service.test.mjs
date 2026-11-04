import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { service, validateLink, ApiError } from "../lib/service.ts";
import { shortPath } from "../features/links/model.ts";
import { setup } from "./helpers/database.mjs";

test("generated code collisions retry without overwriting the existing link", async (t) => {
  const { req, seedLink } = setup(t);
  seedLink("AAAAAAAA", "bob");
  let attempts = 0;
  t.mock.method(crypto, "getRandomValues", (bytes) => {
    bytes.fill(attempts++ === 0 ? 0 : 1);
    return bytes;
  });
  const response = await req("/api/links", "POST", {
    url: "https://new.example.com",
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).link.code, "BBBBBBBB");
  assert.equal(attempts, 2);
  assert.equal(
    (await req("/AAAAAAAA")).headers.get("location"),
    "https://example.com/",
  );
});

test("generated collisions stop after five attempts with a retryable 503", async (t) => {
  const { req, seedLink, sqlite } = setup(t);
  seedLink("AAAAAAAA");
  let attempts = 0;
  t.mock.method(crypto, "getRandomValues", (bytes) => {
    attempts++;
    bytes.fill(0);
    return bytes;
  });
  const response = await req("/api/links", "POST", {
    url: "https://example.com",
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /reserve a code/);
  assert.equal(attempts, 5);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM links").get().count,
    1,
  );
});

test("create and list expose the public link record and canonical short URL", async (t) => {
  const { req } = setup(t);
  const response = await req("/api/links", "POST", {
    url: "https://example.com/a",
    alias: "hello",
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.shortUrl, "https://tiny.test/hello");
  assert.equal(created.link.url, "https://example.com/a");
  assert.equal(created.link.owner, undefined);
  assert.equal(created.link.generation, undefined);
  const list = await (await req("/api/links")).json();
  assert.deepEqual(list.links, [created.link]);
});

test("clean and legacy redirects are public; only GET increments both counters", async (t) => {
  const { req } = setup(t);
  await req("/api/links", "POST", {
    url: "https://example.com/a",
    alias: "hello",
  });
  for (const path of ["/hello", "/r/hello"]) {
    const redirect = await req(path, "GET", undefined, null);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "https://example.com/a");
    assert.equal(redirect.headers.get("cache-control"), "no-store");
    assert.equal(redirect.headers.get("referrer-policy"), "no-referrer");
    const head = await req(path, "HEAD", undefined, null);
    assert.equal(head.status, 302);
    assert.equal(await head.text(), "");
  }
  assert.equal((await (await req("/api/links")).json()).links[0].clicks, 2);
  assert.equal((await (await req("/api/analytics")).json()).days[0].clicks, 2);
});

test("route adapters forward exported handlers to the service with the bound database", async (t) => {
  const { db, seedLink, sqlite } = setup(t);
  seedLink("adapter");
  // Replace only the unavailable runtime binding. The real route modules and
  // service execute; framework route discovery and hosted auth remain separate.
  const bindingUrl = "data:text/javascript,export const env = {}";
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "cloudflare:workers") {
        return { url: bindingUrl, shortCircuit: true };
      }
      if (specifier.endsWith("/lib/service")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      return nextResolve(specifier, context);
    },
  });
  t.after(() => hooks.deregister());
  const { env } = await import("cloudflare:workers");
  env.DB = db;
  t.after(() => delete env.DB);

  for (const [modulePath, path] of [
    ["../app/[code]/route.ts", "/adapter"],
    ["../app/r/[code]/route.ts", "/r/adapter"],
  ]) {
    const adapter = await import(modulePath);
    for (const method of ["GET", "HEAD"]) {
      const response = await adapter[method](
        new Request(`https://tiny.test${path}`, { method }),
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "https://example.com/");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), "");
    }
  }
  assert.equal(
    sqlite.prepare("SELECT clicks FROM links WHERE code='adapter'").get()
      .clicks,
    2,
  );
  const api = await import("../app/api/[...path]/route.ts");
  const request = (path, method, body) =>
    new Request(`https://tiny.test${path}`, {
      method,
      headers: { "oai-authenticated-user-id": "alice" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const created = await api.POST(
    request("/api/links", "POST", {
      url: "https://created.example/",
      alias: "adapter-created",
    }),
  );
  assert.equal(created.status, 201);
  const listed = await api.GET(request("/api/links", "GET"));
  assert.equal((await listed.json()).links.length, 2);
  assert.equal(
    (
      await api.PATCH(
        request("/api/links/adapter-created", "PATCH", { active: false }),
      )
    ).status,
    200,
  );
  assert.equal(
    sqlite
      .prepare("SELECT active FROM links WHERE code='adapter-created'")
      .get().active,
    0,
  );
  assert.equal(
    (await api.DELETE(request("/api/links/adapter-created", "DELETE"))).status,
    200,
  );
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM links").get().n, 1);
});

test("duplicate aliases return 409 and generated codes differ", async (t) => {
  const { req } = setup(t);
  const item = { url: "https://example.com", alias: "same" };
  assert.equal((await req("/api/links", "POST", item)).status, 201);
  assert.equal((await req("/api/links", "POST", item, "bob")).status, 409);
  const first = await (
    await req("/api/links", "POST", { url: item.url })
  ).json();
  const second = await (
    await req("/api/links", "POST", { url: item.url })
  ).json();
  assert.notEqual(first.link.code, second.link.code);
});

test("management requires authentication and isolates owners", async (t) => {
  const { req } = setup(t);
  await req("/api/links", "POST", {
    url: "https://example.com",
    alias: "private",
  });
  await req("/private");
  assert.equal((await req("/api/links", "GET", undefined, null)).status, 401);
  assert.equal(
    (await req("/api/analytics", "GET", undefined, null)).status,
    401,
  );
  assert.deepEqual(
    (await (await req("/api/links", "GET", undefined, "bob")).json()).links,
    [],
  );
  assert.deepEqual(
    (await (await req("/api/analytics", "GET", undefined, "bob")).json()).days,
    [],
  );
  assert.equal(
    (await req("/api/links/private", "DELETE", undefined, "bob")).status,
    404,
  );
  assert.equal(
    (await req("/api/links/private", "PATCH", { active: false }, "bob")).status,
    404,
  );
});

test("cross-origin writes are rejected and same-origin writes succeed", async (t) => {
  const { req } = setup(t);
  const item = { url: "https://example.com" };
  assert.equal(
    (
      await req("/api/links", "POST", item, "alice", {
        Origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/links", "POST", item, "alice", {
        Origin: "https://tiny.test",
      })
    ).status,
    201,
  );
});

test("pause, resume, expire and delete cannot leave cacheable negative redirects", async (t) => {
  const { req, sqlite } = setup(t);
  await req("/api/links", "POST", {
    url: "https://example.com",
    alias: "lifecycle",
  });
  await req("/lifecycle");
  await req("/api/links/lifecycle", "PATCH", { active: false });
  for (const path of ["/lifecycle", "/r/lifecycle"]) {
    const paused = await req(path);
    assert.equal(paused.status, 410);
    assert.equal(paused.headers.get("cache-control"), "no-store");
    const head = await req(path, "HEAD");
    assert.equal(head.status, 410);
    assert.equal(await head.text(), "");
  }
  await req("/api/links/lifecycle", "PATCH", { active: true });
  assert.equal((await req("/lifecycle")).status, 302);
  sqlite.exec("UPDATE links SET expires_at=1 WHERE code='lifecycle'");
  assert.equal((await req("/lifecycle")).status, 410);
  await req("/api/links/lifecycle", "DELETE");
  for (const path of ["/lifecycle", "/r/lifecycle"]) {
    const missing = await req(path);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
  }
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM daily").get().count,
    0,
  );
});

test("unsafe URLs, invalid aliases, expired timestamps and oversized fields are rejected", async (t) => {
  const { req } = setup(t);
  for (const url of [
    "javascript:alert(1)",
    "ftp://example.com",
    "https://a:b@example.com",
    "not a url",
    "https://tiny.test/r/loop",
    "https://tiny.test/loop",
  ]) {
    assert.equal((await req("/api/links", "POST", { url })).status, 400);
  }
  for (const fields of [
    { expiresAt: "yesterday" },
    { expiresAt: "2000-01-01" },
    { alias: "bad alias" },
    { alias: "a" },
    { alias: "x".repeat(41) },
    { title: "x".repeat(101) },
    { url: `https://example.com/${"x".repeat(4096)}` },
  ]) {
    assert.equal(
      (
        await req("/api/links", "POST", {
          url: "https://example.com",
          ...fields,
        })
      ).status,
      400,
    );
  }
});

test("POST and PATCH reject malformed JSON and non-object bodies as 400", async (t) => {
  const { req, seedLink } = setup(t);
  seedLink("valid");
  for (const body of ["not json", "null", "[]", "true", "42", '"string"', ""]) {
    for (const [path, method] of [
      ["/api/links", "POST"],
      ["/api/links/valid", "PATCH"],
    ]) {
      const response = await req(path, method, body);
      assert.equal(response.status, 400, `${method} ${body}`);
      assert.equal(typeof (await response.json()).requestId, "string");
    }
  }
});

test("optional create fields and PATCH active reject invalid types without coercion", async (t) => {
  const { req, seedLink } = setup(t);
  seedLink("valid");
  for (const fields of [
    { alias: 123 },
    { alias: [] },
    { title: false },
    { title: {} },
    { expiresAt: ["2099-01-01"] },
    { expiresAt: 123 },
  ]) {
    assert.equal(
      (
        await req("/api/links", "POST", {
          url: "https://example.com",
          ...fields,
        })
      ).status,
      400,
    );
  }
  for (const active of [null, "false", 0, {}, []]) {
    assert.equal(
      (await req("/api/links/valid", "PATCH", { active })).status,
      400,
    );
  }
  const nullable = await req("/api/links", "POST", {
    url: "https://example.com",
    alias: null,
    title: null,
    expiresAt: null,
  });
  assert.equal(nullable.status, 201);
  assert.equal((await nullable.json()).link.expires_at, null);
  assert.throws(() => validateLink(null, "https://tiny.test"), ApiError);
});

test("POST and PATCH enforce a 16 KiB byte limit even with a false Content-Length", async (t) => {
  const { req, seedLink } = setup(t);
  seedLink("valid");
  for (const [path, method] of [
    ["/api/links", "POST"],
    ["/api/links/valid", "PATCH"],
  ]) {
    const oversized = JSON.stringify({
      url: "https://example.com",
      active: true,
      padding: "é".repeat(8192),
    });
    const response = await req(path, method, oversized, "alice", {
      "Content-Length": "1",
    });
    assert.equal(response.status, 413);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = JSON.stringify({ url: "https://example.com", active: true });
    assert.equal(
      (await req(path, method, body.padEnd(16384))).status,
      method === "POST" ? 201 : 200,
    );
    assert.equal((await req(path, method, body.padEnd(16385))).status, 413);
  }
});

test("oversized streaming JSON is cancelled before the remainder is consumed", async (t) => {
  const { db } = setup(t);
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(4096).fill(32));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request("https://tiny.test/api/links", {
    method: "POST",
    headers: { "oai-authenticated-user-id": "alice" },
    body: stream,
    duplex: "half",
  });
  assert.equal((await service(request, db)).status, 413);
  assert.equal(reads, 5);
  assert.equal(cancelled, true);
});

test("malformed and encoded separator codes return 400 instead of 503", async (t) => {
  const { req } = setup(t);
  for (const path of ["/r/%", "/%", "/r/%2F", "/r/%00"]) {
    assert.equal((await req(path, "GET", undefined, null)).status, 400);
  }
  assert.equal(
    (await req("/api/links/%", "PATCH", { active: false })).status,
    400,
  );
});

test("concurrent creates cannot exceed the per-account quota", async (t) => {
  const { req, seedLink, sqlite } = setup(t);
  for (let i = 0; i < 499; i++) seedLink(`seed-${i}`);
  const results = await Promise.all(
    ["last-one", "last-two"].map((alias) =>
      req("/api/links", "POST", { url: "https://example.com", alias }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM links WHERE owner='alice'")
      .get().count,
    500,
  );
  assert.equal(
    (await req("/api/links", "POST", { url: "https://example.com" }, "bob"))
      .status,
    201,
  );
  await req("/api/links/seed-0", "DELETE");
  assert.equal(
    (await req("/api/links", "POST", { url: "https://example.com" })).status,
    201,
  );
});

test("rate limiting returns 429 with Retry-After and does not affect reads", async (t) => {
  let now = Date.parse("2026-11-04T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  const { req } = setup(t);
  for (let i = 0; i < 30; i++) {
    assert.equal(
      (await req("/api/links", "POST", { url: "https://example.com" })).status,
      201,
    );
  }
  const limited = await req("/api/links", "POST", {
    url: "https://example.com",
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal((await req("/api/links")).status, 200);
  now += 60_000;
  assert.equal(
    (await req("/api/links", "POST", { url: "https://example.com" })).status,
    201,
  );
});

test("analytics batch failure rolls back lifetime counts and preserves redirects", async (t) => {
  const { req, seedLink, sqlite } = setup(t);
  seedLink("resilient");
  sqlite.exec(
    "CREATE TRIGGER fail_daily BEFORE INSERT ON daily BEGIN SELECT RAISE(ABORT, 'storage failed'); END",
  );
  assert.equal((await req("/resilient")).status, 302);
  assert.equal(
    sqlite.prepare("SELECT clicks FROM links WHERE code='resilient'").get()
      .clicks,
    0,
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM daily").get().count,
    0,
  );
});

test("analytics returns the most recent 30 UTC calendar days for the owner", async (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-11-04T00:30:00Z"));
  const { req, seedLink, sqlite } = setup(t);
  seedLink("alice-link");
  seedLink("alice-second");
  seedLink("bob-link", "bob");
  const insert = sqlite.prepare(
    "INSERT INTO daily (code,day,clicks) VALUES (?,?,?)",
  );
  insert.run("alice-link", "2026-11-04", 5);
  insert.run("alice-second", "2026-11-04", 7);
  insert.run("alice-link", "2026-11-03", 3);
  insert.run("alice-link", "2026-10-06", 2);
  insert.run("alice-link", "2026-10-05", 9);
  insert.run("bob-link", "2026-11-04", 99);
  insert.run("bob-link", "2026-10-06", 99);
  assert.deepEqual((await (await req("/api/analytics")).json()).days, [
    { day: "2026-10-06", clicks: 2 },
    { day: "2026-11-03", clicks: 3 },
    { day: "2026-11-04", clicks: 12 },
  ]);
});

test("health detects database failure and errors include a request ID", async (t) => {
  const { req, db } = setup(t);
  assert.equal((await req("/api/health", "GET", undefined, null)).status, 200);
  db.prepare = () => {
    throw new Error("unavailable");
  };
  const response = await req("/api/health");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(typeof (await response.json()).requestId, "string");
});

test("unsupported methods return 405 with Allow and do not consume mutation budget", async (t) => {
  const { req, sqlite, seedLink } = setup(t);
  seedLink("valid");
  for (const [path, method, allow] of [
    ["/api/links", "PUT", "GET, POST"],
    ["/api/analytics", "POST", "GET"],
    ["/api/links/valid", "GET", "PATCH, DELETE"],
    ["/api/health", "POST", "GET"],
    ["/valid", "POST", "GET, HEAD"],
  ]) {
    const response = await req(path, method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), allow);
  }
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM limits").get().count,
    0,
  );
  assert.equal((await req("/api/unknown")).status, 404);
});

test("reserved aliases cannot shadow routes and legacy reserved links remain resolvable", async (t) => {
  const { req, seedLink } = setup(t);
  for (const alias of [
    "api",
    "r",
    "callback",
    "signin-with-chatgpt",
    "assets",
    "API",
  ]) {
    assert.equal(
      (await req("/api/links", "POST", { url: "https://example.com", alias }))
        .status,
      400,
    );
  }
  seedLink("api");
  assert.equal(shortPath("api"), "/r/api");
  assert.equal(shortPath("hello"), "/hello");
  assert.equal((await req("/r/api", "GET", undefined, null)).status, 302);
});

test("a deleted and reused alias does not transfer an in-flight click", async (t) => {
  const { req, db, sqlite, seedLink } = setup(t);
  seedLink("reused", "alice");
  const batch = db.batch;
  db.batch = async (statements) => {
    sqlite.prepare("DELETE FROM links WHERE code=?").run("reused");
    seedLink("reused", "bob");
    sqlite
      .prepare("UPDATE links SET url=? WHERE code=?")
      .run("https://new.example/", "reused");
    return batch(statements);
  };
  const response = await req("/reused");
  assert.equal(response.headers.get("location"), "https://example.com/");
  assert.equal(
    sqlite.prepare("SELECT clicks FROM links WHERE code=?").get("reused")
      .clicks,
    0,
  );
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM daily").get().n, 0);
  db.batch = batch;
  assert.equal(
    (await req("/reused")).headers.get("location"),
    "https://new.example/",
  );
  assert.equal(
    sqlite.prepare("SELECT clicks FROM links WHERE code=?").get("reused")
      .clicks,
    1,
  );
});

test("expiration requires a real calendar date and explicit timezone", async (t) => {
  const { req } = setup(t);
  for (const expiresAt of [
    "2099-02-31T12:00:00Z",
    "2099-04-31T12:00:00Z",
    "2099-01-01T12:00:00",
    "2100-02-29T12:00:00Z",
    "2099-01-01T24:00:00Z",
  ]) {
    assert.equal(
      (
        await req("/api/links", "POST", {
          url: "https://example.com",
          expiresAt,
        })
      ).status,
      400,
      expiresAt,
    );
  }
  for (const expiresAt of [
    "2096-02-29T12:00:00Z",
    "2099-01-01T12:00:00+05:30",
  ]) {
    assert.equal(
      (
        await req("/api/links", "POST", {
          url: "https://example.com",
          expiresAt,
        })
      ).status,
      201,
      expiresAt,
    );
  }
});

test("hostname-derived titles obey the 100 character limit", async (t) => {
  const { req } = setup(t);
  const hostname = Array(5).fill("a".repeat(30)).join(".") + ".com";
  const response = await req("/api/links", "POST", {
    url: `https://${hostname}`,
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).link.title, hostname.slice(0, 100));
});

test("generation migration backfills existing links while preserving analytics", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(readFileSync("drizzle/0000_pink_havok.sql", "utf8"));
    db.exec(`INSERT INTO links (code, owner, url, title, created_at) VALUES
      ('old1', 'alice', 'https://one.example/', 'one', 1),
      ('old2', 'alice', 'https://two.example/', 'two', 2);
      INSERT INTO daily (code, day, clicks) VALUES ('old1', '2099-01-01', 3);`);
    db.exec(readFileSync("drizzle/0001_outgoing_lizard.sql", "utf8"));
    const rows = db
      .prepare("SELECT code, generation FROM links ORDER BY code")
      .all();
    assert.equal(rows.length, 2);
    assert.match(rows[0].generation, /^[0-9a-f-]{36}$/);
    assert.notEqual(rows[0].generation, rows[1].generation);
    assert.equal(
      db.prepare("SELECT clicks FROM daily WHERE code='old1'").get().clicks,
      3,
    );
    db.prepare("DELETE FROM links WHERE code='old1'").run();
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM daily").get().n, 0);
  } finally {
    db.close();
  }
});
