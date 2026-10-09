import {env} from '@/lib/runtime';
import {hashRun} from '@/lib/ss-dispatch';
import {isPreparationWorker} from '@/lib/ss-preparation-worker';
import {db,member,owner,origin,json,fail,HttpError} from '@/lib/server';
export const dynamic='force-dynamic';
const clinics:Record<string,string>={floce:'플로체',planme:'플랜미'};
function key(slug:string,date:string){
 if(!clinics[slug]||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new HttpError(400,'병원과 회차 날짜를 확인해 주세요.');
 return 'ss-production:'+slug+':'+date;
}
export async function GET(req:Request){try{
 if(!await isPreparationWorker(req,env.SS_DISPATCH_TOKEN)){const m=await member();owner(m);}const u=new URL(req.url);const k=key(u.searchParams.get('hospital')||'',u.searchParams.get('date')||'');
 const r=await db().prepare('SELECT value FROM settings WHERE key=?').bind(k).first<{value:string}>();
 return json({run:r?JSON.parse(r.value):null});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 const worker=await isPreparationWorker(req,env.SS_DISPATCH_TOKEN);let m:{id:number|string};if(worker){m={id:'preparation-worker'}}else{origin(req);const person=await member();owner(person);m=person}const raw=await req.text();if(raw.length>500000)throw new HttpError(413,'제작 자료가 너무 큽니다.');
 const b=JSON.parse(raw);const k=key(b.hospital,b.date);
 if(b.schema!=='ccw.production-review.v1'||!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>100)throw Error('병원별 최대 100명의 제작 결과를 연결해 주세요.');
 const str=(s:unknown,max=6000)=>{if(typeof s!=='string'||s.length>max)throw Error('제작 자료 형식이 맞지 않습니다.');return s;};
 const rows=b.rows.map((p:any,i:number)=>{
  if(!/^[a-f0-9]{64}$/.test(p.ref))throw Error('비식별 제작 참조가 필요합니다.');
  const sections=(v:any)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('화면 제작 내용이 없습니다.');return {title:str(v.title,500),body:str(v.body,16000)};};
  return {rank:i+1,ref:p.ref,source:str(p.source,2000),lms:str(p.lms),screen31:sections(p.screen31),screen32:sections(p.screen32),issues:Array.isArray(p.issues)?p.issues.slice(0,20).map((s:unknown)=>str(s,1000)):[],linkStatus:str(p.linkStatus,200),origin:str(p.origin,500)};
 });
 if(new Set(rows.map((p:any)=>p.ref)).size!==rows.length)throw Error('같은 대상이 중복돼 있습니다.');
 const run={hospital:b.hospital,date:b.date,rows,importedAt:new Date().toISOString(),importedBy:m.id,externalSendAllowed:false,finalReviewPassed:false};
 const current=await db().prepare('SELECT value FROM settings WHERE key=?').bind(k).first<{value:string}>();
 if(current){
 const previous=JSON.parse(current.value), hash=await hashRun(previous);
 const sent=await db().prepare('SELECT key FROM settings WHERE key=?').bind('ss-dispatch:'+hash).first();
 if(sent)throw new HttpError(409,'발송 요청된 회차는 변경할 수 없습니다.');
 if(worker&&(b.action!=='amend-preparation'||previous.rows.length>rows.length||previous.rows.some((p:any,i:number)=>p.ref!==rows[i].ref)))throw new HttpError(409,'준비 보완은 기존 명단·순서를 유지하며 추가 대상만 붙일 수 있습니다.');
 }
 if((b.previousImportedAt||null)!==(current?JSON.parse(current.value).importedAt:null))throw new HttpError(409,'다른 제작 결과가 먼저 연결됐습니다. 새로고침 후 다시 확인해 주세요.');
 const value=JSON.stringify(run);
 // Preserve the previous immutable import and replace only the revision read above.
 if(current){const result=await db().batch([
  db().prepare('UPDATE settings SET value=? WHERE key=? AND value=? AND NOT EXISTS(SELECT 1 FROM settings WHERE key=?)').bind(value,k,current.value,'ss-dispatch:'+await hashRun(JSON.parse(current.value))),
  db().prepare('INSERT INTO settings(key,value) SELECT ?,? WHERE changes()>0').bind(k+':history:'+crypto.randomUUID(),current.value),
 ]);if(!result[0].meta.changes)throw new HttpError(409,'동시 변경이 발생했습니다. 새로고침해 주세요.');}
 else {const r=await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(k,value).run();if(!r.meta.changes)throw new HttpError(409,'이미 생성된 회차입니다. 새로고침해 주세요.');}
 return json({run});
}catch(e){return fail(e)}}
