import { RESERVED_CODES, shortPath } from "../features/links/model.ts";
import {
  createLink,
  deleteLink,
  listLinks,
  requireOwnedLink,
  setLinkActive,
} from "../features/links/server/repository.ts";
import { redirectLink } from "../features/links/server/redirect.ts";
import { validateLink } from "../features/links/server/validation.ts";
import { listDailyClicks } from "../features/analytics/server/repository.ts";
import {
  ApiError,
  decodeCode,
  json,
  readJsonObject,
  requireMethod,
} from "../shared/server/http.ts";
import { checkMutationLimit } from "../shared/server/rate-limit.ts";

export { ApiError } from "../shared/server/http.ts";
export {
  validateLink,
  randomCode,
} from "../features/links/server/validation.ts";

async function route(
  request: Request,
  db: D1Database,
  requestId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/health") {
    requireMethod(method, ["GET"]);
    await db.prepare("SELECT 1").first();
    return json({
      status: "operational",
      database: "connected",
      checkedAt: new Date().toISOString(),
    });
  }
  const legacyCode = /^\/r\/([^/]+)\/?$/.exec(path)?.[1];
  const cleanCode = /^\/([^/]+)\/?$/.exec(path)?.[1];
  if (legacyCode) return redirectLink(request, db, legacyCode, requestId);
  if (cleanCode && !RESERVED_CODES.has(decodeCode(cleanCode).toLowerCase())) {
    return redirectLink(request, db, cleanCode, requestId);
  }

  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner) throw new ApiError(401, "Sign in to manage your links.");
  const itemCode = /^\/api\/links\/([^/]+)$/.exec(path)?.[1];
  if (path === "/api/links") requireMethod(method, ["GET", "POST"]);
  else if (path === "/api/analytics") requireMethod(method, ["GET"]);
  else if (itemCode) requireMethod(method, ["PATCH", "DELETE"]);
  else throw new ApiError(404, "Endpoint not found.");

  if (method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      throw new ApiError(403, "Origin not allowed.");
    await checkMutationLimit(db, owner);
  }
  if (path === "/api/analytics")
    return json({ days: await listDailyClicks(db, owner) });
  if (path === "/api/links" && method === "GET")
    return json({ links: await listLinks(db, owner) });
  if (path === "/api/links") {
    const item = validateLink(await readJsonObject(request), url.origin);
    const link = await createLink(db, owner, item);
    return json({ link, shortUrl: url.origin + shortPath(link.code) }, 201);
  }

  const code = decodeCode(itemCode!);
  if (method === "PATCH") {
    await requireOwnedLink(db, owner, code);
    const body = await readJsonObject(request);
    if (typeof body.active !== "boolean")
      throw new ApiError(400, "active must be true or false.");
    await setLinkActive(db, owner, code, body.active);
  } else {
    await deleteLink(db, owner, code);
  }
  return json({ ok: true });
}

export async function service(
  request: Request,
  db: D1Database,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  let response: Response;
  try {
    response = await route(request, db, requestId);
  } catch (error) {
    if (error instanceof ApiError) {
      response = json(
        { error: error.message, requestId },
        error.status,
        error.headers,
      );
    } else {
      console.error(JSON.stringify({ event: "request_failed", requestId }));
      response = json(
        { error: "Service temporarily unavailable. Please retry.", requestId },
        503,
      );
    }
  }
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}
