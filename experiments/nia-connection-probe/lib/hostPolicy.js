// Generated from source/hostPolicy.ts.
export const OAUTH_BASE_PATH='/api/assistant/oauth';
export const OAUTH_DISCOVERY_PATH='/.well-known/oauth-authorization-server'+OAUTH_BASE_PATH;
export const QA_PROJECT_REF='jwkvykuwihpvvmtlawlh';
export const QA_AUTH_SCHEMA='nia_oauth_race_validation';
export const QA_AUTH_ROLE='nia_oauth_validation_runner';
export const QA_SESSION_POOLER='aws-1-ap-southeast-1.pooler.supabase.com';
export const HOST_SCOPE=Object.freeze({projectId:'prj_MPNUTjWygM12B3vu5u6mIoWfYUG4',host:'project-k5a7o.vercel.app',branch:'codex/nia-synthetic-api-proof'});
                                                                                                                                                                                                                                                                                                
                                                   
const identifier=(v                 )=>Boolean(v&&v.length<=255&&v.trim()===v&&!Array.from(v).some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127||/\s/.test(c)));
/** New isolated-host binding only. Does not modify or impersonate the old Preview gate. */
export function readStandalonePolicy(env    ,now=Date.now())              {
 if(env.ENABLE_ASSISTANT_AUTHENTICATED_SYNTHETIC!=='1'||env.VERCEL_ENV!=='production'||env.VERCEL_PROJECT_ID!==HOST_SCOPE.projectId||env.VERCEL_PROJECT_PRODUCTION_URL!==HOST_SCOPE.host||env.VERCEL_GIT_COMMIT_REF!==HOST_SCOPE.branch)return{state:'disabled'};
 const origin='https://'+HOST_SCOPE.host,issuer=origin+OAUTH_BASE_PATH;
 const ownerId=env.ASSISTANT_DEMO_MCP_OWNER_SUBJECT,googleSub=env.ASSISTANT_OAUTH_OWNER_GOOGLE_SUB,ownerEmail=env.ASSISTANT_OAUTH_OWNER_EMAIL,clientId=env.ASSISTANT_OAUTH_CLIENT_ID,redirectUri=env.ASSISTANT_OAUTH_CHATGPT_REDIRECT_URI;
 const start=env.ASSISTANT_DEMO_MCP_NOT_BEFORE??'',end=env.ASSISTANT_DEMO_MCP_EXPIRES_AT??'',startsAt=Date.parse(start),endsAt=Date.parse(end);
 const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
 if(env.ASSISTANT_OAUTH_QA_PROJECT_REF!==QA_PROJECT_REF||env.ASSISTANT_DEMO_MCP_MODE!=='oauth'||env.ASSISTANT_DEMO_MCP_ISSUER!==issuer||![ownerId,googleSub,ownerEmail,clientId].every(identifier)||!/^\d{6,255}$/.test(googleSub??'')||!ownerEmail?.endsWith('@sru.ac.th')||ownerEmail!==ownerEmail.toLowerCase()||!redirectUri||!utc.test(start)||!utc.test(end)||!Number.isFinite(now)||!Number.isFinite(startsAt)||!Number.isFinite(endsAt)||endsAt<=startsAt||endsAt-startsAt>3_600_000)return{state:'misconfigured'};
 try{const u=new URL(redirectUri);if(u.protocol!=='https:'||u.hostname!=='chatgpt.com'||u.username||u.password||u.port||u.search||u.hash||u.href!==redirectUri||u.pathname==='/')return{state:'misconfigured'}}catch{return{state:'misconfigured'}};
 if(now<startsAt||now>=endsAt)return{state:'disabled'};
 return Object.freeze({state:'ready',origin,issuer,resource:origin+'/api/assistant/mcp',ownerId:ownerId ,googleSub:googleSub ,ownerEmail:ownerEmail ,clientId:clientId ,redirectUri,startsAt,endsAt,qaProject:QA_PROJECT_REF});
}
/** No business credential fallback, weak certificate mode, duplicate keys or unbounded pool. */
export function validDedicatedQaUrl(value       )        {
 try{
  const u=new URL(value),expected                      ={schema:QA_AUTH_SCHEMA,sslmode:'require',sslaccept:'strict',connection_limit:'1',connect_timeout:'5'};
  return u.protocol==='postgresql:'&&u.hostname===QA_SESSION_POOLER&&u.port==='5432'&&u.pathname==='/postgres'&&decodeURIComponent(u.username)===QA_AUTH_ROLE+'.'+QA_PROJECT_REF&&Boolean(u.password)&&!u.hash&&Object.entries(expected).every(([key,val])=>u.searchParams.getAll(key).length===1&&u.searchParams.get(key)===val)&&[...u.searchParams.keys()].every(key=>Object.hasOwn(expected,key));
 }catch{return false}
}
