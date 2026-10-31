import {createAuthenticatedGateway} from './gateway.mjs';
import {assertServerPrismaBundle} from './prismaBundle.mjs';
import {validDedicatedQaUrl} from './hostPolicy.js';
/** Never import/construct an operational DB/Google runtime until reviewed deployment assets exist. */
async function loadService(config){
 await assertServerPrismaBundle();
 // Secret provisioning/QA connection remain prohibited until a separately approved activation.
 // No fallback to the business app, NextAuth or ambient DATABASE_URL.
 const env=process.env,databaseUrl=env.ASSISTANT_OAUTH_DATABASE_URL??'';
 if(!validDedicatedQaUrl(databaseUrl))throw Error('Dedicated QA connection unavailable');
 const secret=env.ASSISTANT_OAUTH_SECRET??'',googleClientId=env.ASSISTANT_OAUTH_GOOGLE_CLIENT_ID??'',googleClientSecret=env.ASSISTANT_OAUTH_GOOGLE_CLIENT_SECRET??'';
 if(secret.length<48||!googleClientId.endsWith('.apps.googleusercontent.com')||!googleClientSecret)throw Error('Authorization configuration unavailable');
 const {createOAuthRuntime}=await import('../auth/runtime.mjs');
 return createOAuthRuntime({config,databaseUrl,secret,googleClientId,googleClientSecret});
}
export const handle=createAuthenticatedGateway({environment:process.env,loadService});
