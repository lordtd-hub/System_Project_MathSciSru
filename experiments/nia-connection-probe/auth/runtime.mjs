import { createOwnerOAuthOptions } from './options.mjs';
import { createLiveStore } from './live-store.mjs';
import { bindOAuthRuntime } from './bind-runtime.mjs';
import { createGoogleIdentityVerifier } from './google-identity.mjs';
import { createGrantTransaction } from './grant-transaction.mjs';
/** Imported/constructed ONLY after outer Preview/QA/finite-window gates. No eager database singleton. */
export async function createOAuthRuntime({config,databaseUrl,secret,googleClientId,googleClientSecret}) {
 const [{betterAuth},{prismaAdapter},{jwt},{oauthProvider},jose,{PrismaClient}]=await Promise.all([
  import('better-auth'),import('@better-auth/prisma-adapter'),import('better-auth/plugins/jwt'),
  import('@better-auth/oauth-provider'),import('jose'),import('./generated/client/index.js')]);
 const prisma=new PrismaClient({datasources:{db:{url:databaseUrl}},log:[]});
 const live=createLiveStore(prisma,config);
 const identity=createGoogleIdentityVerifier({jose,clientId:googleClientId});
 const createAuth=connection=>betterAuth(createOwnerOAuthOptions({config,secret,googleClientId,googleClientSecret,
  database:prismaAdapter(connection,{provider:'postgresql',transaction:false}),sdk:{jwt,oauthProvider},
  isOwnerSessionAllowed:createLiveStore(connection,config).isOwnerSessionAllowed,verifyGoogleIdentity:identity}));
 const auth=createAuth(prisma);
 await auth.$context;
 const grantTransaction=createGrantTransaction({prisma,config,createHandler:async connection=>{
  const scoped=createAuth(connection);await scoped.$context;return request=>scoped.handler(request);
 }});
 return bindOAuthRuntime({config,auth,jose,live,grantTransaction});
}
