/** Every request reads a fresh transaction; no positive cache and no fallback database URL.
 * @param {import('./generated/client').PrismaClient} prisma
 * @param {Extract<import('../../src/lib/assistant/oauthQaPolicy').OAuthQaConfig,{state:'ready'}>} config
 */
export function createLiveStore(prisma, config) {
 const trialId='nia-synthetic-v1';
 return {
  async isOwnerSessionAllowed(){
   const row=await prisma.niaTrial.findUnique({where:{id:trialId}});
   const now=Date.now();return Boolean(row?.enabled&&row.ownerId===config.ownerId&&row.googleSub===config.googleSub&&
    row.clientId===config.clientId&&row.resource===config.resource&&+row.startsAt===config.startsAt&&
    +row.endsAt===config.endsAt&&now>=config.startsAt&&now<config.endsAt);
  },
  async readLiveAuthorization(sessionId){
   return prisma.$transaction(async tx=>{
    const [trial,session,client,resource,user,account,link,consent]=await Promise.all([
     tx.niaTrial.findUnique({where:{id:trialId}}),tx.session.findUnique({where:{id:sessionId}}),
     tx.oauthClient.findUnique({where:{clientId:config.clientId}}),tx.oauthResource.findUnique({where:{identifier:config.resource}}),
     tx.user.findUnique({where:{id:config.ownerId}}),
     tx.account.findFirst({where:{userId:config.ownerId,providerId:'google',accountId:config.googleSub}}),
     tx.oauthClientResource.findFirst({where:{clientId:config.clientId,resourceId:config.resource}}),
     tx.oauthConsent.findFirst({where:{clientId:config.clientId,userId:config.ownerId,resources:{has:config.resource},scopes:{has:'demo:projects:read'}}})
    ]);
    if(!trial||!session||!client||!resource||!user)return null;
    return {enabled:trial.enabled===true,ownerId:trial.ownerId,googleSub:trial.googleSub,clientId:trial.clientId,
     resource:trial.resource,startsAt:+trial.startsAt,endsAt:+trial.endsAt,sessionId:session.id,
     sessionUserId:session.userId,sessionExpiresAt:+session.expiresAt,clientEnabled:client.disabled===false,
     clientRequiresPkce:client.requirePKCE===true,clientRequiresConsent:client.skipConsent===false,
     clientRedirectMatches:client.tokenEndpointAuthMethod==='none'&&client.redirectUris?.length===1&&client.redirectUris[0]===config.redirectUri&&
       client.grantTypes?.length===1&&client.grantTypes[0]==='authorization_code'&&
       client.scopes?.includes('demo:projects:read')&&client.scopes.every(s=>['demo:projects:read'].includes(s)),
     clientResourceLinked:Boolean(link),resourceEnabled:resource.disabled===false&&resource.accessTokenTtl===300&&
       resource.allowedScopes?.includes('demo:projects:read')&&resource.allowedScopes.every(s=>['demo:projects:read'].includes(s)),
     ownerEmail:user.email,ownerEmailVerified:user.emailVerified===true,googleAccountLinked:Boolean(account),consentGranted:Boolean(consent)};
   },{isolationLevel:'RepeatableRead',maxWait:2000,timeout:4000});
  }
 };
}
