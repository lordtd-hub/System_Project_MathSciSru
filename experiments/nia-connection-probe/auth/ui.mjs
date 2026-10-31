import { randomBytes } from 'node:crypto';
// API-served UI avoids the application's root layout/NextAuth session and business DB imports.
export function ownerAuthorizationPage(kind, config) {
 const nonce=randomBytes(18).toString('base64url');
 const consent=kind==='consent';
 const script=`const base='/api/assistant/oauth';const callback=${JSON.stringify(config.redirectUri)};
 const err=document.getElementById('error');const buttons=[...document.querySelectorAll('button')];
 async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('denied');return r.json()}
 function go(value,google){const u=new URL(value,location.origin);if(google?u.origin==='https://accounts.google.com':u.origin+u.pathname===new URL(callback).origin+new URL(callback).pathname){location.assign(u.href);return}throw Error('redirect denied')}
 buttons.forEach(b=>b.onclick=async()=>{buttons.forEach(x=>x.disabled=true);try{${consent?
 `const r=await post('/oauth2/consent',{accept:b.dataset.accept==='yes',oauth_query:location.search.slice(1),scope:'demo:projects:read'});go(r.url,false);`:
 `const r=await post('/sign-in/social',{provider:'google',oauth_query:location.search.slice(1),callbackURL:location.origin+'/api/assistant/oauth/ui/login',errorCallbackURL:location.origin+'/api/assistant/oauth/ui/login',disableRedirect:true});go(r.url,true);`}
 }catch{err.textContent='ดำเนินการไม่ได้ กรุณาติดต่อผู้ดูแล';buttons.forEach(x=>x.disabled=false)}});`;
 const html=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ยืนยันสิทธิ์ทดลอง Nia</title><main><h1>${consent?'อนุญาตอ่านข้อมูลจำลอง':'ยืนยันตัวตนเจ้าของ'}</h1><p>ทดลองอ่านโครงงานสมมติ 3 รายการเท่านั้น ไม่มีข้อมูลนักศึกษา คะแนน หรือสิทธิ์แก้ไขระบบ</p><p>สิทธิ์ทดลองสิ้นสุดตามเวลาที่ผู้ดูแลกำหนด ภายในหนึ่งชั่วโมง</p>${consent?'<button data-accept="yes">อนุญาตอ่านข้อมูลจำลอง</button> <button data-accept="no">ไม่อนุญาต</button>':'<button>ยืนยันด้วย Google</button>'}<p id="error" role="alert"></p></main><script nonce="${nonce}">${script}</script></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`}});
}
