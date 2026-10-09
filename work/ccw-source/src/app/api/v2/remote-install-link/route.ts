import {db,origin,json,fail,HttpError} from '@/lib/server';
import {hospitalEditor,existingHospital} from '@/lib/v2-hospital-access';
export async function POST(req:Request){try{
 origin(req);const actor=await hospitalEditor();const raw=await req.text();if(raw.length>1000)throw new HttpError(413,'요청 길이를 확인해 주세요.');const body=JSON.parse(raw);
 const clinic=await existingHospital(body.recordId);const name=JSON.parse(clinic.data).name;if(typeof name!=='string'||!name.trim())throw new HttpError(400,'병원명을 확인해 주세요.');
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');const expiresAt=Date.now()+24*60*60*1000;
 await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('remote-access-invite:'+hash,JSON.stringify({recordId:clinic.id,name:name.trim(),expiresAt,actor:actor.id})).run();
 return json({url:new URL('/setup.html?token='+token,req.url).href,hospital:name.trim(),expiresAt},201);
}catch(e){return fail(e)}}
