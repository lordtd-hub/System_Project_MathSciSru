import {HOST_SCOPE,QA_PROJECT_REF,validDedicatedQaUrl} from './hostPolicy.js';
import {assertServerPrismaBundle} from './prismaBundle.mjs';
import {bindQaOwnerEnrollment} from '../auth/owner-enrollment.mjs';
import {createGoogleIdentityVerifier} from '../auth/google-identity.mjs';
import {createPinnedQaConnection} from './qaTls.mjs';
import {reportEnrollmentFailure} from './enrollmentDiagnostics.mjs';
const closed=()=>Response.json({error:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
/** Strict separate enrollment switch; never enables MCP/OAuth, emits a token,
 * starts a Google exchange on import, or falls back to a business credential.
 */
export function readEnrollmentSettings(env,now=Date.now()){
 if(env.ENABLE_ASSISTANT_OWNER_ENROLLMENT!=='1'||env.VERCEL_ENV!=='production'||env.VERCEL_PROJECT_ID!==HOST_SCOPE.projectId||env.VERCEL_PROJECT_PRODUCTION_URL!==HOST_SCOPE.host||env.VERCEL_GIT_COMMIT_REF!==HOST_SCOPE.branch||env.ASSISTANT_OAUTH_QA_PROJECT_REF!==QA_PROJECT_REF)return null;
 const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
 const names=['ASSISTANT_OAUTH_ENROLLMENT_NOT_BEFORE','ASSISTANT_OAUTH_ENROLLMENT_EXPIRES_AT','ASSISTANT_DEMO_MCP_NOT_BEFORE','ASSISTANT_DEMO_MCP_EXPIRES_AT'];
 if(names.some(n=>!utc.test(env[n]??'')))return null;
 const [notBefore,expiresAt,startsAt,endsAt]=names.map(n=>Date.parse(env[n]));
 if(![now,notBefore,expiresAt,startsAt,endsAt].every(Number.isFinite)||expiresAt<=notBefore||expiresAt-notBefore>3600000||now<notBefore||now>=expiresAt||endsAt<=now||endsAt<=startsAt||endsAt-startsAt>3600000)return null;
 const ownerId=env.ASSISTANT_DEMO_MCP_OWNER_SUBJECT,ownerEmail=env.ASSISTANT_OAUTH_OWNER_EMAIL,clientId=env.ASSISTANT_OAUTH_CLIENT_ID,redirectUri=env.ASSISTANT_OAUTH_CHATGPT_REDIRECT_URI;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId??'')||!/^[a-z0-9._%+-]+@sru\.ac\.th$/.test(ownerEmail??'')||!/^[A-Za-z0-9_-]{1,128}$/.test(clientId??''))return null;
 try{const u=new URL(redirectUri);if(u.origin!=='https://chatgpt.com'||u.search||u.hash||u.username||u.password||u.href!==redirectUri||!/^\/(?:connector\/oauth\/[A-Za-z0-9_-]+|connector_platform_oauth_redirect)$/.test(u.pathname))return null}catch{return null}
 return{notBefore,expiresAt,registration:{ownerId,ownerEmail,clientId,redirectUri,startsAt,endsAt}};
}
/** Enrollment must not retain a third pool alongside the OAuth/MCP functions.
 * Each verified registration owns one client, closed in success/failure paths.
 * If closure fails after commit, outcome must be inspected before any retry.
 */
export function enrollmentTransactionClient(createClient){
 return{$transaction:async(work,options)=>{const client=createClient();try{return await client.$transaction(work,options)}finally{await client.$disconnect()}}};
}
/** Trusted server dependency seam for offline startup checks. No HTTP parameter,
 * environment switch, published endpoint or alternate authorization mode selects it.
 */
export function createOwnerEnrollmentRuntime({environment=()=>process.env,now=Date.now,dependencies={},diagnosticWriter}={}){
 const deps={assertBundle:assertServerPrismaBundle,importPrisma:()=>import('../auth/generated/client/index.js'),
  importJose:()=>import('jose'),pinConnection:createPinnedQaConnection,bind:bindQaOwnerEnrollment,...dependencies};
 let cached;
 const unavailable=()=>Response.json({error:'enrollment_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 const initialize=async(env,settings)=>{
  let phase='bundle';
  try{
   await deps.assertBundle();
   const databaseUrl=env.ASSISTANT_OAUTH_DATABASE_URL??'',googleClientId=env.ASSISTANT_OAUTH_GOOGLE_CLIENT_ID??'';
   phase='database_url';if(!validDedicatedQaUrl(databaseUrl))throw Error('Rejected');
   // Same format already required by createOwnerEnrollmentHandler; check before imports.
   phase='google_client';if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId))throw Error('Rejected');
   phase='prisma_import';const {PrismaClient}=await deps.importPrisma();if(typeof PrismaClient!=='function')throw Error('Unavailable');
   phase='jose_import';const jose=await deps.importJose();
   phase='tls_ca';const connectionUrl=await deps.pinConnection(databaseUrl);
   const prisma=enrollmentTransactionClient(()=>new PrismaClient({datasources:{db:{url:connectionUrl}},log:[]}));
   phase='bind';return deps.bind({environment:env,...settings,prisma,databaseUrl,googleClientId,
    verifyGoogleIdentity:createGoogleIdentityVerifier({jose,clientId:googleClientId}),enabled:true,now});
  }catch(error){reportEnrollmentFailure(phase,error,diagnosticWriter);throw Error('Enrollment initialization unavailable')}
 };
 return async request=>{
  const env=environment(),settings=readEnrollmentSettings(env,now());
  if(!settings||new URL(request.url).origin!=='https://'+HOST_SCOPE.host)return closed();
  if(!['GET','POST'].includes(request.method))return Response.json({error:'method_not_allowed'},{status:405,headers:{'Cache-Control':'no-store'}});
  let initialized=false;
  try{
   cached??=initialize(env,settings);
   const service=await cached;initialized=true;
   const response=await service(request);
   if(response.status===503)reportEnrollmentFailure('handler',undefined,diagnosticWriter);
   return response;
  }catch(error){cached=undefined;if(initialized)reportEnrollmentFailure('handler',error,diagnosticWriter);return unavailable()}
 };
}
export const handleOwnerEnrollment=createOwnerEnrollmentRuntime();
