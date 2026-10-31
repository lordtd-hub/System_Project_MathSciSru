// PostgreSQL transaction boundary around the maintained SDK, not an OAuth implementation.
// One owner/client PoC: every worker uses the same database-scoped transaction advisory lock.
export const GRANT_LOCK_KEYS = Object.freeze([0x4e494151, 0x4f415554]);
export const GRANT_LOCK_SQL = 'SELECT 1 AS "locked" FROM pg_catalog.pg_advisory_xact_lock($1::integer, $2::integer)';
const unavailable = () => new Error('OAuth grant unavailable');

function monitoredClient(client, state) {
 const models = new Map();
 const invoke = (owner, method, args, name) => {
  if (!state.open) { state.failed = true; return Promise.reject(unavailable()); }
  state.pending++;
  return Promise.resolve().then(() => method.apply(owner,args)).catch(error => {
   // Prisma models use P2025 for a zero-row update/delete, including normal SDK CAS/replay paths.
   // It is not a PostgreSQL statement error. Preserve it so the maintained adapter can handle it.
   if(error?.code==='P2025'&&['update','delete'].includes(name))throw error;
   state.failed = true; throw unavailable();
  }).finally(() => { state.pending--; });
 };
 return new Proxy(client, {get(target,key){
  const value=Reflect.get(target,key);
  if(typeof value==='function')return(...args)=>invoke(target,value,args,key);
  if(value&&typeof value==='object'&&typeof key==='string'&&!key.startsWith('_')){
   if(!models.has(key))models.set(key,new Proxy(value,{get(model,name){
    const operation=Reflect.get(model,name);
    return typeof operation==='function'?(...args)=>invoke(model,operation,args,name):operation;
   }}));
   return models.get(key);
  }
  return value;
 }});
}

/** createHandler MUST construct a fresh SDK with the supplied transaction client only.
 * It must not capture a cached/global SDK or Prisma client. No internal SDK context swapping.
 */
export function createGrantTransaction({prisma,config,createHandler,now=Date.now}) {
 return async request=>{
  const path=new URL(request.url).pathname;
  if(request.method!=='POST'||![config.issuer+'/oauth2/token',config.issuer+'/oauth2/revoke'].includes(new URL(request.url).origin+path))throw unavailable();
  try{
   return await prisma.$transaction(async tx=>{
    const state={open:true,failed:false,pending:0};
    try{
     const connection=monitoredClient(tx,state);
     await connection.$executeRawUnsafe("SET LOCAL lock_timeout = '2s'");
     await connection.$queryRawUnsafe(GRANT_LOCK_SQL,...GRANT_LOCK_KEYS);
     const row=await connection.niaTrial.findUnique({where:{id:'nia-synthetic-v1'}});
     const time=now();
     if(!row||row.enabled!==true||row.ownerId!==config.ownerId||row.googleSub!==config.googleSub||
       row.clientId!==config.clientId||row.resource!==config.resource||+row.startsAt!==config.startsAt||
       +row.endsAt!==config.endsAt||!Number.isFinite(time)||time<config.startsAt||time>=config.endsAt)throw unavailable();
     const handler=await createHandler(connection);
     const response=await handler(request);
     if(!(response instanceof Response)||response.status>=500)throw unavailable();
     // Buffer before commit: no token/header/cookie can escape a failed/unknown commit.
     const reader=response.body?.getReader(),chunks=[];let size=0;
     if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
      if(size>65536){await reader.cancel();throw unavailable()}chunks.push(part.value)}
     const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
     state.open=false;
     if(state.failed||state.pending!==0)throw unavailable();
     return new Response(size?bytes:null,{status:response.status,headers:response.headers});
    }finally{state.open=false;}
   },{isolationLevel:'ReadCommitted',maxWait:2000,timeout:5000});
  }catch{
   // No automatic retry. Connection loss at COMMIT may be outcome-unknown; do not disclose credentials.
   throw unavailable();
  }
 };
}
