import { findLink } from "./repository.ts";
import { recordClick } from "../../analytics/server/repository.ts";
import {
  decodeCode,
  requireMethod,
  text,
} from "../../../shared/server/http.ts";

export async function redirectLink(
  request: Request,
  db: D1Database,
  encoded: string,
  requestId: string,
) {
  requireMethod(request.method, ["GET", "HEAD"]);
  const code = decodeCode(encoded);
  const link = await findLink(db, code);
  if (!link) return text("This short link does not exist.", 404);
  if (
    !link.active ||
    (link.expires_at !== null && link.expires_at <= Date.now())
  ) {
    return text("This link is paused or has expired.", 410);
  }
  if (request.method === "GET") {
    try {
      await recordClick(db, code, link.generation);
    } catch {
      console.error(
        JSON.stringify({ event: "analytics_write_failed", requestId }),
      );
    }
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.url,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
