import {env} from 'cloudflare:workers';
import {service} from '../../lib/service';
export const dynamic='force-dynamic';
function handle(request:Request){const url=new URL(request.url);url.pathname='/r'+url.pathname;return service(new Request(url,request),env.DB!)}
export {handle as GET,handle as HEAD};
