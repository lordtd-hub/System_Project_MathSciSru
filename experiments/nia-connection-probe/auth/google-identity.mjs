/** Cryptographic identity validation delegates to the existing verified jose package.
 * Native provider code exchange/PKCE/state stays in Better Auth; no custom OAuth protocol.
 */
export function createGoogleIdentityVerifier({jose,clientId}) {
 const keys=jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{
  [jose.customFetch]:(input,init)=>fetch(input,{...init,redirect:'error'})
 });
 return async(tokens)=>{
  if(!tokens.idToken)return null;
  try{
   const {payload:p}=await jose.jwtVerify(tokens.idToken,keys,{issuer:['https://accounts.google.com','accounts.google.com'],
    audience:clientId,algorithms:['RS256'],requiredClaims:['iss','sub','aud','exp','iat','email','email_verified'],maxTokenAge:'1h',clockTolerance:0});
   if(typeof p.sub!=='string'||typeof p.email!=='string'||p.email_verified!==true||
      (p.azp!==undefined&&p.azp!==clientId)||(Array.isArray(p.aud)&&p.aud.length>1&&!p.azp)||
      (tokens.expectedIdTokenNonce!==undefined&&p.nonce!==tokens.expectedIdTokenNonce))return null;
   return {user:{id:p.sub,name:'QA owner',email:p.email,emailVerified:true,image:null},data:p};
  }catch{return null;}
 };
}
