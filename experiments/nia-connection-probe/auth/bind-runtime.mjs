import {ownerAuthorizationPage} from './ui.mjs';
/** SDK binding shared by deployed runtime and local integration checks; no alternate verification mode. */
export function bindOAuthRuntime({config,auth,jose,live,grantTransaction}) {
 return {
  async handle(request){
   if(!await live.isOwnerSessionAllowed())return Response.json({error:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
   const path=new URL(request.url).pathname;
   if(path===new URL(config.issuer).pathname+'/oauth2/token'||path===new URL(config.issuer).pathname+'/oauth2/revoke'){
    if(!grantTransaction)throw new Error('OAuth grant unavailable');
    return grantTransaction(request);
   }
   if(path.endsWith('/.well-known/oauth-authorization-server'))return Response.json(await auth.api.getOAuthServerConfig());
   if(path.endsWith('/ui/login'))return ownerAuthorizationPage('login',config);
   if(path.endsWith('/ui/consent'))return ownerAuthorizationPage('consent',config);
   return auth.handler(request);
  },
  async verifyJwt(token){
   const jwks=await auth.api.getJwks();
   const result=await jose.jwtVerify(token,jose.createLocalJWKSet(jwks),{
    issuer:config.issuer,audience:config.resource,algorithms:['EdDSA'],
    requiredClaims:['iss','aud','sub','azp','sid','scope','iat','exp'],maxTokenAge:'5m',clockTolerance:0});
   return result.payload;
  },
  readLiveAuthorization:live.readLiveAuthorization
 };
}
