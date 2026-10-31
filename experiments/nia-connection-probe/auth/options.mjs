export const READ_SCOPE = 'demo:projects:read';
/** Actual SDK options; dependencies are injected for offline unit review and privately loaded at runtime.
 * @param {{config: Extract<import('../../src/lib/assistant/oauthQaPolicy').OAuthQaConfig,{state:'ready'}>,secret:string,
 * googleClientId:string,googleClientSecret:string,database:import('better-auth').BetterAuthOptions['database'],
 * sdk:{jwt:typeof import('better-auth/plugins/jwt').jwt,oauthProvider:typeof import('@better-auth/oauth-provider').oauthProvider},
 * isOwnerSessionAllowed:()=>Promise<boolean>,verifyGoogleIdentity:(tokens:{idToken?:string,expectedIdTokenNonce?:string})=>Promise<any>}} input
 * @returns {import('better-auth').BetterAuthOptions}
 */
export function createOwnerOAuthOptions({config, secret, googleClientId, googleClientSecret, database, sdk, isOwnerSessionAllowed,verifyGoogleIdentity}) {
 /** @param {{user?:{id?:string}}} context */
 const owner = (context) => context.user?.id === config.ownerId;
 const withoutProviderTokens = data => ({...data, accessToken:null, refreshToken:null, idToken:null,
   accessTokenExpiresAt:null, refreshTokenExpiresAt:null});
 return {
  baseURL:config.origin, basePath:'/api/assistant/oauth', secret, database,
  telemetry:{enabled:false}, logger:{disabled:true}, trustedOrigins:[config.origin],
  emailAndPassword:{enabled:false}, disabledPaths:['/token'],
  advanced:{cookiePrefix:'nia-oauth-qa',useSecureCookies:true,crossSubDomainCookies:{enabled:false},
   defaultCookieAttributes:{httpOnly:true,secure:true,sameSite:'lax',path:'/api/assistant/oauth'},trustedProxyHeaders:false},
  session:{expiresIn:3600,updateAge:0,cookieCache:{enabled:false}},
  account:{accountLinking:{enabled:false},updateAccountOnSignIn:false,encryptOAuthTokens:true,storeStateStrategy:'database',
    skipStateCookieCheck:false,storeAccountCookie:false},
  socialProviders:{google:{clientId:googleClientId,clientSecret:googleClientSecret,disableSignUp:true,
    disableDefaultScope:true,scope:['openid','email','profile'],accessType:'online',includeGrantedScopes:false,overrideUserInfoOnSignIn:false,
    getUserInfo:tokens=>verifyGoogleIdentity(tokens),mapProfileToUser:()=>({name:'QA owner',image:null})}},
  user:{validateUserInfo:({user,source})=>{
   const p=source.oauth?.profile;
   if(source.action==='create-user'||source.method!=='oauth'||source.oauth?.providerId!=='google'||
      p?.sub!==config.googleSub||p?.email!==config.ownerEmail||p?.email_verified!==true||
      user.email!==config.ownerEmail||user.emailVerified!==true)return{error:'identity_not_allowed'};
  }},
  databaseHooks:{
   session:{create:{before:async data=>data.userId===config.ownerId&&await isOwnerSessionAllowed()?{data}:false}},
   account:{create:{before:async data=>data.userId===config.ownerId&&data.providerId==='google'&&data.accountId===config.googleSub?{data:withoutProviderTokens(data)}:false},
     update:{before:async data=>({data:withoutProviderTokens(data)})}}
  },
  rateLimit:{enabled:true,storage:'database',window:60,max:30},
  plugins:[sdk.jwt({jwt:{issuer:config.issuer},jwks:{keyPairConfig:{alg:'EdDSA'},disablePrivateKeyEncryption:false}}), sdk.oauthProvider({
   loginPage:'/api/assistant/oauth/ui/login',consentPage:'/api/assistant/oauth/ui/consent',
   scopes:[READ_SCOPE],grantTypes:['authorization_code'],
   allowDynamicClientRegistration:false,allowUnauthenticatedClientRegistration:false,
   enforcePerClientResources:true,resourceSeedMode:'insertOnly',accessTokenExpiresIn:300,refreshTokenExpiresIn:3600,codeExpiresIn:120,
   refreshTokenReuseInterval:0,storeTokens:'hashed',storeClientSecret:'hashed',
   resources:[{identifier:config.resource,name:'Invented project fixtures only',allowedScopes:[READ_SCOPE],
     accessTokenTtl:300,refreshTokenTtl:3600}],
   // Administration is unreachable through the HTTP allowlist; no client creation endpoint is published.
   clientPrivileges:owner,resourcePrivileges:owner
  })]
 };
}
