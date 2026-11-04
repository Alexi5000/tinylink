import { env } from "cloudflare:workers";
import { service } from "../../../lib/service";

export const dynamic = "force-dynamic";
const handle = (request: Request) => service(request, env.DB!);

export { handle as GET, handle as HEAD };
