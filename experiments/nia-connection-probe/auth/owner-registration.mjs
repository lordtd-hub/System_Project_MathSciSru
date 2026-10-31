import {validDedicatedQaUrl,HOST_SCOPE} from '../lib/hostPolicy.js';
export const AUTH_MODELS=Object.freeze(['user','session','account','verification','jwks','rateLimit','oauthClient','oauthResource','oauthClientResource','oauthRefreshToken','oauthAccessToken','oauthConsent','oauthClientAssertion','niaTrial']);
const scope='demo:projects:read';
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
/** Private operator binding only: NOT an HTTP route, login bypass, or token issuer.
 * The caller must supply a server-issued, session-bound, single-use enrollment nonce.
 * A raw subject/email supplied by a browser is never accepted as verified identity.
 * verifyGoogleIdentity is the existing maintained-jose ID-token verifier, injected by
 * trusted server code; never select it from an HTTP request or environment variable.
 */
export async function registerVerifiedOwner({prisma,databaseUrl,verifyGoogleIdentity,tokens,expectedNonce,registration,now=Date.now()}){
 const fail=()=>{throw Error('Owner registration unavailable')};
 if(!validDedicatedQaUrl(databaseUrl)||typeof expectedNonce!=='string'||expectedNonce.length<32||expectedNonce.length>256||typeof tokens?.idToken!=='string')return fail();
 const {ownerId,ownerEmail,clientId,redirectUri,startsAt,endsAt}=registration??{};
 if(!identifier(ownerId)||!identifier(clientId)||!/^[a-z0-9._%+-]+@sru\.ac\.th$/.test(ownerEmail??'')||!Number.isFinite(now)||!Number.isFinite(startsAt)||!Number.isFinite(endsAt)||endsAt<=now||endsAt<=startsAt||endsAt-startsAt>3600000)return fail();
 try{const u=new URL(redirectUri);if(u.origin!=='https://chatgpt.com'||u.search||u.hash||u.username||u.password||u.href!==redirectUri||!/^\/(?:connector\/oauth\/[A-Za-z0-9_-]+|connector_platform_oauth_redirect)$/.test(u.pathname))return fail()}catch{return fail()}
 let verified;try{verified=await verifyGoogleIdentity({idToken:tokens.idToken,expectedIdTokenNonce:expectedNonce})}catch{return fail()}
 const p=verified?.data;
 if(!p||!/^\d{6,255}$/.test(p.sub??'')||p.sub!==verified.user?.id||p.email!==ownerEmail||p.email_verified!==true||p.hd!=='sru.ac.th'||verified.user.email!==p.email||verified.user.emailVerified!==true||p.nonce!==expectedNonce)return fail();
 const stamp=new Date(now),resource='https://'+HOST_SCOPE.host+'/api/assistant/mcp';
 // No consent, session, authorization code, token or private signing key is seeded.
 const rows={
  user:{id:ownerId,name:'QA owner',email:p.email,emailVerified:true,image:null,createdAt:stamp,updatedAt:stamp},
  account:{id:'nia-owner-google-v1',accountId:p.sub,providerId:'google',userId:ownerId,accessToken:null,refreshToken:null,idToken:null,accessTokenExpiresAt:null,refreshTokenExpiresAt:null,scope:null,password:null,createdAt:stamp,updatedAt:stamp},
  oauthClient:{id:'nia-chatgpt-client-v1',clientId,clientSecret:null,userId:ownerId,disabled:true,skipConsent:false,scopes:[scope],clientCredentialsScopes:[],redirectUris:[redirectUri],tokenEndpointAuthMethod:'none',applicationType:'web',grantTypes:['authorization_code'],responseTypes:['code'],requirePKCE:true,name:'Nia synthetic owner trial',createdAt:stamp,updatedAt:stamp},
  oauthResource:{id:'nia-resource-v1',identifier:resource,name:'Invented project fixtures only',allowedScopes:[scope],accessTokenTtl:300,refreshTokenTtl:3600,disabled:true,createdAt:stamp,updatedAt:stamp},
  oauthClientResource:{id:'nia-client-resource-v1',clientId,resourceId:resource,createdAt:stamp},
  niaTrial:{id:'nia-synthetic-v1',enabled:false,ownerId,googleSub:p.sub,clientId,resource,startsAt:new Date(startsAt),endsAt:new Date(endsAt),createdAt:stamp}
 };
 try{
  await prisma.$transaction(async tx=>{
   // Empty dedicated namespace only; never upsert or silently replace prior grants.
   for(const model of AUTH_MODELS)if(await tx[model].count()!==0)throw Error('Namespace not empty');
   for(const [model,data] of Object.entries(rows))await tx[model].create({data});
  },{isolationLevel:'Serializable',maxWait:2000,timeout:5000});
 }catch{return fail()}
 // Public identity metadata only. Never return the input ID token or connection URL.
 return Object.freeze({ownerId,googleSub:p.sub,clientId,redirectUri,resource,enabled:false,createdRows:6});
}
