import {readStandalonePolicy} from './hostPolicy.js';
import {createSyntheticMcpTransport,METADATA_PATH} from './transport.js';
import {createLiveOAuthVerifier} from './oauthLiveVerifier.js';
import {createOAuthQaRoutes} from './oauthQaRoutes.js';
const failure=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
/** Injectable service is a trusted server factory, never an environment switch/request credential. */
export function createAuthenticatedGateway({environment={},loadService,now=Date.now,audit=()=>{}}={}){
 let service,identity,transport,transportIdentity;
 const load=async config=>{
  if(typeof loadService!=='function')throw Error('Authorization service unavailable');
  const next=JSON.stringify(config);
  if(identity!==next){identity=next;service=undefined}
  service??=Promise.resolve().then(()=>loadService(config)).catch(error=>{service=undefined;throw error});
  return service;
 };
 const oauth=createOAuthQaRoutes({environment,loadService:load,now});
 return async request=>{
  const config=readStandalonePolicy(environment,now());
  if(config.state!=='ready')return failure(config.state==='disabled'?404:503,config.state==='disabled'?'not_found':'service_unavailable');
  const url=new URL(request.url);
  if(url.origin!==config.origin||url.hash)return failure(404,'not_found');
  if(url.pathname==='/api/assistant/mcp'||url.pathname===METADATA_PATH){
   const verifyRequest=async incoming=>{
    const runtime=await load(config);
    return createLiveOAuthVerifier({config,now,verifyJwt:runtime.verifyJwt,readLiveAuthorization:runtime.readLiveAuthorization})(incoming);
   };
   // Same maintained SDK/domain transport; only its trusted deployment configuration is rebound.
   const key=JSON.stringify(config);
   if(transportIdentity!==key){transportIdentity=key;transport=createSyntheticMcpTransport({configuration:{...config,environment:'qa-preview',mode:'oauth'},verifyRequest,now,audit})}
   return transport(request);
  }
  return oauth(request);
 };
}
