export class ApiError extends Error { constructor(public status:number,message:string){super(message)} }
export function validateLink(data:any,origin:string){
 if(!data || typeof data.url!=='string' || data.url.length>4096)throw new ApiError(400,'Enter a valid URL (up to 4,096 characters).');
 let url:URL;try{url=new URL(data.url)}catch{throw new ApiError(400,'Enter a complete URL starting with https:// or http://.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new ApiError(400,'Use an HTTP or HTTPS URL without embedded credentials.');
 if(url.origin===origin && (url.pathname.startsWith('/r/')||/^\/[^/]+\/?$/.test(url.pathname)))throw new ApiError(400,'Use the original destination, not another TinyLink.');
 const code=typeof data.alias==='string'?data.alias.trim():'';
 if(['api','r','signin-with-chatgpt','signout-with-chatgpt','callback','favicon.svg','_next','assets'].includes(code.toLowerCase()))throw new ApiError(400,'That alias is reserved. Choose another.');
 if(code && !/^[a-zA-Z0-9_-]{3,40}$/.test(code))throw new ApiError(400,'Aliases need 3–40 letters, numbers, hyphens, or underscores.');
 const expires=data.expiresAt?Date.parse(data.expiresAt):null;
 if(expires!==null&&(!Number.isFinite(expires)||expires<=Date.now()))throw new ApiError(400,'Choose an expiration in the future.');
 return {url:url.href,code,title:typeof data.title==='string'?data.title.trim().slice(0,100)||url.hostname:url.hostname,expires};
}
export function randomCode(){const bytes=crypto.getRandomValues(new Uint8Array(8));const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';return Array.from(bytes,b=>chars[b%62]).join('');}
const json=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export async function service(request:Request,db:D1Database):Promise<Response>{
 const u=new URL(request.url); const path=u.pathname; const method=request.method;const id=crypto.randomUUID();
 try{
  if(path==='/api/health'){if(method!=='GET')return json({error:'Method not allowed'},405);await db.prepare('SELECT 1').first();return json({status:'operational',database:'connected',checkedAt:new Date().toISOString()});}
  if(path.startsWith('/r/')){
   if(!['GET','HEAD'].includes(method))return json({error:'Method not allowed'},405);
   const code=decodeURIComponent(path.slice(3));const row=await db.prepare('SELECT * FROM links WHERE code=?').bind(code).first<any>();
   if(!row)return new Response('This short link does not exist.',{status:404});
   if(!row.active||row.expires_at&&row.expires_at<=Date.now())return new Response('This link is paused or has expired.',{status:410});
   if(method==='GET')try{await db.batch([db.prepare('UPDATE links SET clicks=clicks+1 WHERE code=?').bind(code),db.prepare('INSERT INTO daily (code,day,clicks) VALUES (?,?,1) ON CONFLICT(code,day) DO UPDATE SET clicks=clicks+1').bind(code,new Date().toISOString().slice(0,10))]);}catch{console.error(JSON.stringify({event:'analytics_write_failed',requestId:id}));}
   return new Response(null,{status:302,headers:{Location:row.url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Sign in to manage your links.'},401);
  if(!['GET','HEAD'].includes(method)){
   const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return json({error:'Origin not allowed'},403);
   const slot=Math.floor(Date.now()/60000);const key=owner+':'+slot;
   const rate=await db.prepare('INSERT INTO limits (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+120000).first<any>();
   if(rate.count>30)return json({error:'Too many changes. Try again in a minute.'},429,{'Retry-After':'60'});
   await db.prepare('DELETE FROM limits WHERE until<?').bind(Date.now()).run();
  }
  if(path==='/api/links'&&method==='GET'){
   const result=await db.prepare('SELECT * FROM links WHERE owner=? ORDER BY created_at DESC LIMIT 500').bind(owner).all();return json({links:result.results});
  }
  if(path==='/api/analytics'&&method==='GET'){
   const days=await db.prepare("SELECT d.day,SUM(d.clicks) AS clicks FROM daily d JOIN links l ON l.code=d.code WHERE l.owner=? AND d.day>=? GROUP BY d.day ORDER BY d.day").bind(owner,new Date(Date.now()-29*86400000).toISOString().slice(0,10)).all();return json({days:days.results});
  }
  if(path==='/api/links'&&method==='POST'){
   if(Number(request.headers.get('content-length')||0)>10000)throw new ApiError(413,'Request too large.');
   const body=await request.text();if(body.length>10000)throw new ApiError(413,'Request too large.');
   let data;try{data=JSON.parse(body)}catch{throw new ApiError(400,'Send a valid JSON object.');}
   const item=validateLink(data,u.origin);
   const count=await db.prepare('SELECT COUNT(*) AS n FROM links WHERE owner=?').bind(owner).first<any>();if(count.n>=500)throw new ApiError(409,'This MVP supports up to 500 links per account.');
   for(let attempt=0;attempt<5;attempt++){
    const code=item.code||randomCode();
    const inserted=await db.prepare('INSERT INTO links (code,owner,url,title,created_at,expires_at,active,clicks) VALUES (?,?,?,?,?,?,1,0) ON CONFLICT(code) DO NOTHING').bind(code,owner,item.url,item.title,Date.now(),item.expires).run();
    if(inserted.meta.changes)return json({link:await db.prepare('SELECT * FROM links WHERE code=?').bind(code).first(),shortUrl:u.origin+'/'+code},201);
    if(item.code)throw new ApiError(409,'That alias is taken. Try another.');
   }throw new ApiError(503,'Could not reserve a code. Please retry.');
  }
  if(path.startsWith('/api/links/')){
   const code=decodeURIComponent(path.slice('/api/links/'.length));
   const row=await db.prepare('SELECT code FROM links WHERE code=? AND owner=?').bind(code,owner).first();if(!row)throw new ApiError(404,'Link not found.');
   if(method==='PATCH'){
    let data;try{data=await request.json() as any}catch{throw new ApiError(400,'Send valid JSON.');}
    if(typeof data.active!=='boolean')throw new ApiError(400,'active must be true or false.');
    await db.prepare('UPDATE links SET active=? WHERE code=? AND owner=?').bind(data.active?1:0,code,owner).run();return json({ok:true});
   }
   if(method==='DELETE'){await db.prepare('DELETE FROM links WHERE code=? AND owner=?').bind(code,owner).run();return json({ok:true});}
   return json({error:'Method not allowed'},405);
  }
  return json({error:'Endpoint not found'},404);
 }catch(error){if(error instanceof ApiError)return json({error:error.message,requestId:id},error.status);console.error(JSON.stringify({event:'request_failed',requestId:id}));return json({error:'Service temporarily unavailable. Please retry.',requestId:id},503);}
}
