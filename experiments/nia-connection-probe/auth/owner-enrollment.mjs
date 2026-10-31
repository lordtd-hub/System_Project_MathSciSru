import {randomBytes,timingSafeEqual} from 'node:crypto';
import {HOST_SCOPE,QA_PROJECT_REF} from '../lib/hostPolicy.js';
import {registerVerifiedOwner} from './owner-registration.mjs';
const origin='https://'+HOST_SCOPE.host,cookieName='__Host-nia-owner-enrollment';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(a)&&/^[A-Za-z0-9_-]{32,128}$/.test(b)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
/** Actual private wiring. Passing enabled=true never overrides the exact host gate.
 * No process.env access, eager client construction or route export on import.
 */
export function bindQaOwnerEnrollment({environment={},prisma,databaseUrl,googleClientId,verifyGoogleIdentity,registration,enabled=false,notBefore,expiresAt,now=Date.now,nonce}){
 const allow=instant=>enabled===true&&environment.VERCEL_ENV==='production'&&environment.VERCEL_PROJECT_ID===HOST_SCOPE.projectId&&environment.VERCEL_PROJECT_PRODUCTION_URL===HOST_SCOPE.host&&environment.VERCEL_GIT_COMMIT_REF===HOST_SCOPE.branch&&environment.ASSISTANT_OAUTH_QA_PROJECT_REF===QA_PROJECT_REF&&Number.isFinite(notBefore)&&Number.isFinite(expiresAt)&&expiresAt>notBefore&&expiresAt-notBefore<=3600000&&instant>=notBefore&&instant<expiresAt;
 return createOwnerEnrollmentHandler({enable:allow,googleClientId,now,nonce,register:input=>registerVerifiedOwner({prisma,databaseUrl,verifyGoogleIdentity,registration,now:now(),...input})});
}
/** Private server adapter for one first-owner enrollment. No published route exists.
 * enable is a trusted host/project/finite-window gate, NOT request input.
 * register must close over the verified QA connection and registerVerifiedOwner.
 * Double-submit cookie + ID-token nonce follow Google's server verification pattern.
 * No Google authorization code exchange, custom OAuth protocol or token storage.
 */
export function createOwnerEnrollmentHandler({enable=()=>false,googleClientId,register,now=Date.now,nonce=()=>randomBytes(32).toString('base64url')}){
 const reply=(status,error)=>Response.json({error},{status,headers});
 return async request=>{
  if(!enable(now())||new URL(request.url).origin!==origin)return reply(404,'not_found');
  if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId??''))return reply(503,'enrollment_unavailable');
  if(request.method==='GET'){
   const challenge=nonce();if(!/^[A-Za-z0-9_-]{32,128}$/.test(challenge))return reply(503,'enrollment_unavailable');
   const config=JSON.stringify({clientId:googleClientId,nonce:challenge}).replaceAll('<','\\u003c');
   const html='<!doctype html><html lang="th"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Nia owner enrollment</title><p>ยืนยันบัญชี เจ้าของที่กำหนดไว้ เพื่อบันทึกตัวตนเจ้าของเท่านั้น API จะยังปิดอยู่</p><div id="google"></div><p id="result" role="status"></p><script src="https://accounts.google.com/gsi/client" async defer></script><script nonce="'+challenge+'">const c='+config+';window.onload=()=>{google.accounts.id.initialize({client_id:c.clientId,nonce:c.nonce,auto_select:false,callback:async r=>{const q=await fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:r.credential,g_csrf_token:c.nonce})});document.getElementById("result").textContent=q.ok?"บันทึกตัวตนแล้ว API ยังปิดอยู่":"ยังบันทึกไม่ได้ ไม่มีการเปิด API";}});google.accounts.id.renderButton(document.getElementById("google"),{type:"standard",text:"signin_with"});};</script></html>';
   return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Set-Cookie':cookieName+'='+challenge+'; Path=/; Max-Age=300; Secure; HttpOnly; SameSite=Strict','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+challenge+"' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; style-src https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  }
  if(request.method!=='POST')return reply(405,'method_not_allowed');
  if(request.headers.get('origin')!==origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,'enrollment_rejected');
  const site=request.headers.get('sec-fetch-site');if(site&&site!=='same-origin')return reply(403,'enrollment_rejected');
  // Read a bounded stream rather than trusting Content-Length or buffering unbounded input.
  let body;try{const reader=request.body?.getReader();if(!reader)return reply(400,'enrollment_rejected');let length=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return reply(413,'enrollment_rejected')}chunks.push(value)}body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return reply(400,'enrollment_rejected')}
  const matches=(request.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
  if(matches.length!==1||!same(matches[0].slice(cookieName.length+1),body?.g_csrf_token)||typeof body?.credential!=='string'||Object.keys(body).some(k=>!['credential','g_csrf_token'].includes(k)))return reply(403,'enrollment_rejected');
  try{
   await register({tokens:{idToken:body.credential},expectedNonce:body.g_csrf_token});
   return Response.json({registered:true,api_enabled:false},{headers:{...headers,'Set-Cookie':cookieName+'=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict'}});
  }catch{return reply(403,'enrollment_rejected')}
 };
}
