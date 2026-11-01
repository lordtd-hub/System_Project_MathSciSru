import {handleOwnerEnrollment} from '../../lib/nativeEnrollmentRuntime.mjs';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Temporary approved GET-only startup diagnosis: never return enrollment HTML,
// auth JavaScript, cookies or redirects. POST cannot enroll or write anything.
export async function GET(request){
 if(request.method!=='GET')return reply(404,{error:'not_found'});
 try{
  const response=await handleOwnerEnrollment(request);
  await response.body?.cancel();
  if(response.status===200)return reply(200,{startup:'ready'});
  return reply(response.status===404?404:503,{error:response.status===404?'not_found':'enrollment_unavailable'});
 }catch{return reply(503,{error:'enrollment_unavailable'})}
}
export const POST=()=>reply(404,{error:'not_found'});
