import {env} from '@/lib/runtime';
import {db,bucket,member,owner,json,fail,HttpError} from '@/lib/server';
import {hashRun} from '@/lib/ss-dispatch';
export const dynamic='force-dynamic';
async function current(h:string,d:string,ref:string,part:string){
 if(!['floce','planme'].includes(h)||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^[a-f0-9]{64}$/.test(ref)||!['31','32'].includes(part))throw new HttpError(400,'화면 참조 오류');
 const r=await db().prepare('SELECT value FROM settings WHERE key=?').bind('ss-production:'+h+':'+d).first<any>();const run=r?JSON.parse(r.value):null;if(!run?.rows.some((p:any)=>p.ref===ref))throw new HttpError(404,'대상 없음');const hash=await hashRun(run);return {hash,key:'ss-preview/'+hash+'/'+ref+'/'+part+'.png'};
}
export async function GET(req:Request){try{owner(await member());const u=new URL(req.url),s=await current(u.searchParams.get('hospital')||'',u.searchParams.get('date')||'',u.searchParams.get('ref')||'',u.searchParams.get('part')||'');const obj=await bucket().get(s.key);if(!obj)throw new HttpError(404,'화면 미리보기 준비 중');return new Response(obj.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 if(!env.SS_DISPATCH_TOKEN)throw new HttpError(503,'검수 연결 미설정');const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([digest(req.headers.get('authorization')||''),digest('Bearer '+env.SS_DISPATCH_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)throw new HttpError(401,'검수 작업 인증 필요');
 const raw=await req.text();if(raw.length>4000000)throw new HttpError(413,'화면 크기 초과');const v=JSON.parse(raw);const s=await current(v.hospital,v.date,v.ref,v.part);if(s.hash!==v.runHash)throw new HttpError(409,'제작본 변경');const bytes=Uint8Array.from(atob(v.image),(c)=>c.charCodeAt(0));if(bytes.length>2500000||bytes.length<8||[137,80,78,71,13,10,26,10].some((x,i)=>bytes[i]!==x))throw new HttpError(400,'PNG 화면 필요');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==v.imageHash)throw new HttpError(400,'화면 지문 불일치');await bucket().put(s.key,bytes,{httpMetadata:{contentType:'image/png'},customMetadata:{runHash:s.hash,imageHash:hash,createdAt:new Date().toISOString()}});return json({saved:true});
}catch(e){return fail(e)}}
