import {db,member,owner,origin,json,fail,HttpError,now} from '@/lib/server';
import {encryptRemotePassword,decryptRemotePassword} from '@/lib/remote-access';
import {mayOrg} from '@/lib/policy';

const inviteKey = (hash:string) => 'remote-access-invite:'+hash;
const accessKey = (id:number) => 'remote-access:'+id;
const passwordRule = /^[A-Za-z0-9!@#$%^&*_+=.?-]{12,64}$/;
const idRule = /^[0-9]{6,20}$/;

async function hashToken(token:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
function requireToken(value:unknown){
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new HttpError(400,'설치 링크를 확인해 주세요.');
 return value;
}
async function customer(recordId:number){
 if(!Number.isSafeInteger(recordId)||recordId<1)throw new HttpError(400,'병원을 선택해 주세요.');
 const row=await db().prepare("SELECT id,data FROM records WHERE id=? AND kind='customer'").bind(recordId).first<{id:number,data:string}>();
 if(!row)throw new HttpError(404,'등록된 병원을 찾지 못했습니다.');
 const name=JSON.parse(row.data).name;
 if(typeof name!=='string'||!name.trim())throw new HttpError(400,'병원명을 확인해 주세요.');
 return {id:row.id,name:name.trim()};
}

export async function GET(req:Request){try{
 const url=new URL(req.url);
 const token=url.searchParams.get('token');
 if(token){
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(inviteKey(await hashToken(requireToken(token)))).first<{value:string}>();
  if(!row)throw new HttpError(404,'설치 링크가 만료됐습니다.');
  const invite=JSON.parse(row.value);
  if(invite.expiresAt<Date.now())throw new HttpError(410,'설치 링크가 만료됐습니다.');
  return json({hospital:invite.name});
 }
 const m=await member();
 const recordId=Number(url.searchParams.get('recordId'));
 if(Number.isSafeInteger(recordId)&&recordId>0){
  if(!mayOrg(m,'SS'))throw new HttpError(403,'SS 세팅 권한이 필요합니다.');
  const clinic=await customer(recordId);
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(accessKey(recordId)).first<{value:string}>();
  const value=row?JSON.parse(row.value):null;
  return json({hospital:clinic.name,id:value?.id||null,receivedAt:value?.receivedAt||null,source:value?.source||null,neoId:value?.neoId||null});
 }
 const show=Number(url.searchParams.get('show'));
 if(Number.isSafeInteger(show)&&show>0){
  if(!mayOrg(m,'SS'))throw new HttpError(403,'SS 세팅 권한이 필요합니다.');
  await customer(show);
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(accessKey(show)).first<{value:string}>();
  if(!row)throw new HttpError(404,'접속 정보가 없습니다.');
  const value=JSON.parse(row.value);
  return json({id:value.id,password:await decryptRemotePassword(value.password,value.pwSeed===true),neoPassword:value.neoPassword?await decryptRemotePassword(value.neoPassword,value.pwSeed===true):null,receivedAt:value.receivedAt});
 }
 owner(m);
 const rows=await db().prepare("SELECT id,data FROM records WHERE kind='customer' ORDER BY id DESC LIMIT 300").all<{id:number,data:string}>();
 const saved=await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'remote-access:%'").all<{key:string,value:string}>();
 const byId=new Map(saved.results.map(r=>[Number(r.key.slice('remote-access:'.length)),JSON.parse(r.value)]));
 return json({hospitals:rows.results.map(r=>{const value=byId.get(r.id);return {id:r.id,name:JSON.parse(r.data).name,remoteId:value?.id||null,receivedAt:value?.receivedAt||null};})});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 const raw=await req.text();
 if(raw.length>2000)throw new HttpError(413,'입력 길이를 확인해 주세요.');
 const body=JSON.parse(raw);
 if(body.action==='helper-prepare'){
  origin(req);
  const token=requireToken(body.token);
  if(typeof body.password!=='string'||!passwordRule.test(body.password))throw new HttpError(400,'접속 비밀번호를 확인해 주세요.');
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(inviteKey(await hashToken(token))).first<{value:string}>();
  if(!row)throw new HttpError(404,'설치 링크가 만료됐습니다.');
  const invite=JSON.parse(row.value);
  if(invite.expiresAt<Date.now())throw new HttpError(410,'설치 링크가 만료됐습니다.');
  await customer(invite.recordId);
  const jobToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('remote-helper:'+await hashToken(jobToken),JSON.stringify({recordId:invite.recordId,name:invite.name,password:await encryptRemotePassword(body.password),expiresAt:Math.min(invite.expiresAt,Date.now()+60*60*1000)})).run();
  return json({jobToken,hospital:invite.name});
 }
 if(body.action==='helper-open'||body.action==='helper-complete'){
  const key='remote-helper:'+await hashToken(requireToken(body.jobToken));
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();
  if(!row)throw new HttpError(404,'웹에서 설정 파일을 다시 받아 주세요.');
  const job=JSON.parse(row.value);
  if(job.expiresAt<Date.now())throw new HttpError(410,'설정 파일이 만료됐습니다. 웹에서 다시 받아 주세요.');
  await customer(job.recordId);
  if(body.action==='helper-open'){
   if(job.completedId)return json({hospital:job.name,completedId:job.completedId});
   return json({hospital:job.name,password:await decryptRemotePassword(job.password)});
  }
  if(typeof body.id!=='string'||!idRule.test(body.id))throw new HttpError(400,'접속 번호를 확인해 주세요.');
  if(job.completedId){if(job.completedId!==body.id)throw new HttpError(409,'다른 PC에서 사용한 설정 파일입니다.');return json({saved:true,hospital:job.name});}
  const saved=JSON.stringify({id:body.id,password:job.password,receivedAt:now()});
  const finished=JSON.stringify({...job,password:null,completedId:body.id});
  const results=await db().batch([
   db().prepare('INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(accessKey(job.recordId),saved,key,row.value),
   db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(finished,key,row.value),
  ]);
  if(results[1].meta.changes!==1)throw new HttpError(409,'설정 파일 처리 중입니다. 잠시 후 다시 실행해 주세요.');
  return json({saved:true,hospital:job.name});
 }
 if(body.action==='invite'){
  origin(req);const m=await member();if(!mayOrg(m,'SS'))throw new HttpError(403,'SS 세팅 권한이 필요합니다.');
  const clinic=await customer(Number(body.recordId));
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const key=inviteKey(await hashToken(token));
  await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind(key,JSON.stringify({recordId:clinic.id,name:clinic.name,expiresAt:Date.now()+24*60*60*1000})).run();
  return json({url:new URL('/setup.html?token='+token,req.url).href,hospital:clinic.name});
 }
 if(body.action==='complete'){
  const token=requireToken(body.token);
  if(typeof body.id!=='string'||!idRule.test(body.id))throw new HttpError(400,'접속 번호를 확인해 주세요.');
  if(typeof body.password!=='string'||!passwordRule.test(body.password))throw new HttpError(400,'접속 비밀번호를 확인해 주세요.');
  const key=inviteKey(await hashToken(token));
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();
  if(!row)throw new HttpError(404,'설치 링크가 만료됐습니다.');
  const invite=JSON.parse(row.value);
  if(invite.expiresAt<Date.now())throw new HttpError(410,'설치 링크가 만료됐습니다.');
  await customer(invite.recordId);
  const consumed=await db().prepare('DELETE FROM settings WHERE key=? RETURNING value').bind(key).first();
  if(!consumed)throw new HttpError(409,'이미 사용한 설치 링크입니다.');
  await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(accessKey(invite.recordId),JSON.stringify({id:body.id,password:await encryptRemotePassword(body.password),receivedAt:now()})).run();
  return json({saved:true,hospital:invite.name});
 }
 throw new HttpError(400,'처리할 동작을 확인해 주세요.');
}catch(e){return fail(e)}}
