import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness(entry, mocks = {}, globals = {}) {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: (callback) => callback,
    useEffect() {},
  };
  const cache = new Map();
  function load(file) {
    if (file in mocks) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    runInNewContext(
      source,
      {
        module: loadedModule,
        exports: loadedModule.exports,
        require: (name) =>
          name === "react"
            ? react
            : name.startsWith(".")
              ? load(
                  resolve(
                    dirname(file),
                    name + (name.endsWith(".ts") ? "" : ".ts"),
                  ),
                )
              : require(name),
        setTimeout,
        clearTimeout,
        Date,
        AbortSignal,
        ...globals,
      },
      { filename: file },
    );
    return loadedModule.exports;
  }
  const exports = load(resolve(root, entry));
  return {
    exports,
    render(name, props) {
      cursor = 0;
      return exports[name](props);
    },
  };
}
const apiFile = resolve(root, "features/workspace/api.ts");
const link = (code, active = 1, expires_at = null) => ({
  code,
  active,
  expires_at,
  title: code,
});

// These tests run the real hooks with a small state/ref adapter, without a DOM stack.
test("mutations synchronously reject a second write before React rerenders", async () => {
  const pending = deferred();
  const writes = [];
  const h = harness("features/links/use-link-actions.ts", {
    [apiFile]: {
      request: (...args) => {
        writes.push(args);
        return pending.promise;
      },
      errorMessage: (e) => e.message,
    },
  });
  const props = { demo: false, refresh: async () => {}, onCreated() {} };
  const actions = h.render("useLinkActions", props);
  const first = actions.change(link("a"));
  await actions.change(link("b"));
  actions.confirmDelete(link("b"));
  assert.equal(writes.length, 1);
  assert.equal(h.render("useLinkActions", props).remove, null);
  pending.resolve({});
  await first;
  assert.equal(h.render("useLinkActions", props).busy, "");
  await h.render("useLinkActions", props).change(link("b"));
  assert.equal(writes.length, 2);
});

test("pending deletion cannot be dismissed or replaced and failure stays visible", async () => {
  const pending = deferred();
  const h = harness("features/links/use-link-actions.ts", {
    [apiFile]: {
      request: () => pending.promise,
      errorMessage: (e) => e.message,
    },
  });
  const props = { demo: false, refresh: async () => {}, onCreated() {} };
  h.render("useLinkActions", props).confirmDelete(link("a"));
  const actions = h.render("useLinkActions", props);
  const deleting = actions.deleteLink();
  actions.closeDelete();
  actions.confirmDelete(link("b"));
  assert.equal(h.render("useLinkActions", props).remove.code, "a");
  pending.reject(new Error("Delete failed"));
  await deleting;
  const result = h.render("useLinkActions", props);
  assert.equal(result.remove.code, "a");
  assert.equal(result.deleteError, "Delete failed");
  result.closeDelete();
  assert.equal(h.render("useLinkActions", props).remove, null);
});

test("expired resume performs no write, while a future expiry can resume", async () => {
  const writes = [];
  const h = harness("features/links/use-link-actions.ts", {
    [apiFile]: {
      request: async (...args) => {
        writes.push(args);
      },
      errorMessage: (e) => e.message,
    },
  });
  const props = { demo: false, refresh: async () => {}, onCreated() {} };
  await h.render("useLinkActions", props).change(link("expired", 0, 1));
  assert.equal(writes.length, 0);
  assert.match(h.render("useLinkActions", props).actionError, /expired/);
  await h
    .render("useLinkActions", props)
    .change(link("future", 0, Date.now() + 60000));
  assert.equal(writes.length, 1);
});

test("clipboard denial exposes the absolute short URL without navigating", async () => {
  const h = harness(
    "features/links/use-link-actions.ts",
    {
      [apiFile]: { request() {}, errorMessage: (e) => e.message },
    },
    {
      navigator: {
        clipboard: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      },
      location: { origin: "https://tiny.test" },
    },
  );
  const props = { demo: false, refresh: async () => {}, onCreated() {} };
  await h.render("useLinkActions", props).copy(link("launch"));
  assert.equal(
    h.render("useLinkActions", props).manualCopy,
    "https://tiny.test/launch",
  );
});

test("links refresh completes while analytics and health are pending; later partial error preserves links", async () => {
  const links = deferred(),
    analytics = deferred(),
    health = deferred();
  const h = harness("features/workspace/use-workspace.ts", {
    [apiFile]: {
      request: (path) =>
        ({
          "/api/links": links,
          "/api/analytics": analytics,
          "/api/health": health,
        })[path].promise,
      errorMessage: (e) => e.message,
    },
  });
  const refreshing = h.render("useWorkspace").refresh();
  links.resolve({ links: [link("a")] });
  await refreshing;
  let result = h.render("useWorkspace");
  assert.equal(result.links[0].code, "a");
  assert.equal(result.loading, false);
  assert.equal(result.analyticsLoading, true);
  health.resolve({});
  analytics.reject(new Error("Analytics unavailable"));
  await new Promise((done) => setImmediate(done));
  result = h.render("useWorkspace");
  assert.equal(result.health, "Operational");
  assert.equal(result.analyticsError, "Analytics unavailable");
  assert.equal(result.analyticsLoading, false);
  assert.equal(result.links[0].code, "a");
});

test("older refresh responses cannot overwrite newer snapshots", async () => {
  const oldLinks = deferred(),
    newLinks = deferred();
  let reads = 0;
  const h = harness("features/workspace/use-workspace.ts", {
    [apiFile]: {
      request: (path) =>
        path === "/api/links"
          ? (++reads === 1 ? oldLinks : newLinks).promise
          : Promise.resolve({ days: [] }),
      errorMessage: (e) => e.message,
    },
  });
  const first = h.render("useWorkspace").refresh();
  const second = h.render("useWorkspace").refresh();
  newLinks.resolve({ links: [link("new")] });
  await second;
  oldLinks.resolve({ links: [link("old")] });
  await first;
  assert.equal(h.render("useWorkspace").links[0].code, "new");
});

test("API errors retain a safe request reference", async () => {
  const h = harness(
    "features/workspace/api.ts",
    {},
    {
      fetch: async () => ({
        ok: false,
        json: async () => ({
          error: "Unavailable",
          requestId: "audit-request-123",
        }),
      }),
    },
  );
  await assert.rejects(
    h.exports.request("/api/links"),
    /Unavailable.*audit-request-123/,
  );
});

test("create submits configured options once and clears the draft only after success", async () => {
  const pending = deferred();
  const writes = [];
  let reset = 0,
    created = 0,
    collapsed = 0;
  const form = {
    values: {
      url: "https://example.com",
      title: "Launch",
      alias: "launch",
      expiresAt: "2030-01-01T12:00",
    },
    reset() {
      reset++;
    },
  };
  const h = harness(
    "features/links/use-link-actions.ts",
    {
      [apiFile]: {
        request: (...args) => {
          writes.push(args);
          return pending.promise;
        },
        errorMessage: (e) => e.message,
      },
    },
    {
      FormData: class {
        constructor(form) {
          this.values = { ...form.values };
        }
        get(name) {
          return this.values[name] ?? null;
        }
      },
    },
  );
  const props = {
    demo: false,
    refresh: async () => {},
    onCreated() {
      created++;
    },
  };
  const actions = h.render("useLinkActions", props);
  const event = { currentTarget: form, preventDefault() {} };
  const first = actions.create(event, () => collapsed++);
  await actions.create(event, () => collapsed++);
  assert.equal(writes.length, 1);
  const payload = JSON.parse(writes[0][1].body);
  assert.equal(payload.alias, "launch");
  assert.equal(payload.title, "Launch");
  assert.ok(payload.expiresAt.startsWith("2030-01-01"));
  assert.equal(reset, 0);
  assert.equal(h.render("useLinkActions", props).saving, true);
  pending.resolve({ link: link("launch") });
  await first;
  assert.equal(reset, 1);
  assert.equal(created, 1);
  assert.equal(collapsed, 1);
  assert.equal(h.render("useLinkActions", props).saving, false);
});

test("analytics and health update even while the links endpoint is stalled", async () => {
  const links = deferred();
  const h = harness("features/workspace/use-workspace.ts", {
    [apiFile]: {
      request: (path) =>
        path === "/api/links"
          ? links.promise
          : Promise.resolve({ days: [{ day: "2026-11-04", clicks: 3 }] }),
      errorMessage: (e) => e.message,
    },
  });
  const refresh = h.render("useWorkspace").refresh();
  await new Promise((done) => setImmediate(done));
  const result = h.render("useWorkspace");
  assert.equal(result.health, "Operational");
  assert.equal(result.days[0].clicks, 3);
  assert.equal(result.analyticsLoading, false);
  assert.equal(result.loading, true);
  links.resolve({ links: [] });
  await refresh;
});
