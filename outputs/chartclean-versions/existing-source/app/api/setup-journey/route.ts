import {db,member,origin,json,fail,HttpError,now} from '@/lib/server';
import {mayRecord} from '@/lib/policy';
import {encryptSetupToken,decryptSetupToken} from '@/lib/setup-invitation';

const journeyKey=(hash:string)=>'setup-journey:'+hash;
const progressKey=(id:number)=>'setup-progress:'+id;
const accessKey=(id:number)=>'remote-access:'+id;
const inviteKey=(hash:string)=>'remote-access-invite:'+hash;
const currentKey=(id:number)=>'setup-current:'+id;
const lifetime=14*24*60*60*1000;
async function hash(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
function token(value:unknown){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new HttpError(400,'병원 안내 주소를 확인해 주세요.');return value}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
async function hospital(id:number){if(!Number.isSafeInteger(id)||id<1)throw new HttpError(400,'병원을 선택해 주세요.');const row=await db().prepare("SELECT id,kind,org,assignee,data FROM records WHERE id=? AND kind='customer'").bind(id).first<any>();if(!row)throw new HttpError(404,'등록된 병원을 찾지 못했습니다.');const data=JSON.parse(row.data);return {...row,data,name:String(data.setupName||data.name||'').trim()}}
async function invitation(value:unknown){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(journeyKey(await hash(token(value)))).first<{value:string}>();if(!row)throw new HttpError(404,'병원 안내 주소를 찾지 못했습니다.');const saved=JSON.parse(row.value);if(saved.expiresAt<Date.now())throw new HttpError(410,'병원 안내 주소의 기한이 지났습니다. 담당자에게 새 주소를 요청해 주세요.');return saved}
async function progress(id:number){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(progressKey(id)).first<{value:string}>();return row?JSON.parse(row.value):{openedAt:null,contactAt:null,emrAt:null}}
async function remote(id:number){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(accessKey(id)).first<{value:string}>();if(!row)return {id:null,receivedAt:null};const saved=JSON.parse(row.value);return {id:saved.id||null,receivedAt:saved.receivedAt||null}}
async function current(id:number,req:Request){
 const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(currentKey(id)).first<{value:string}>();
 if(!row)return null;
 const saved=JSON.parse(row.value);
 const active=Number(saved.expiresAt)>Date.now();
 if(!active)return {url:null,createdAt:saved.createdAt,expiresAt:saved.expiresAt,active:false};
 const journey=await invitation(await decryptSetupToken(saved.token));
 const invite=await db().prepare('SELECT value FROM settings WHERE key=?').bind(inviteKey(await hash(journey.remoteToken))).first<{value:string}>();
 const valid=!!invite&&JSON.parse(invite.value).expiresAt>Date.now();
 return {url:valid?new URL('/setup?token='+journey.remoteToken,req.url).toString():null,createdAt:saved.createdAt,expiresAt:saved.expiresAt,active:valid};
}
async function saveCurrent(id:number,portalToken:string,createdAt:number,expiresAt:number){
 const value=JSON.stringify({token:await encryptSetupToken(portalToken),createdAt,expiresAt});
 await db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.expiresAt') AS INTEGER) <= ?").bind(currentKey(id),value,Date.now()).run();
}

export async function GET(req:Request){try{const url=new URL(req.url);const bearer=url.searchParams.get('token');if(bearer){const saved=await invitation(bearer);const clinic=await hospital(saved.recordId);await saveCurrent(clinic.id,bearer,saved.expiresAt-lifetime,saved.expiresAt);const state=await progress(clinic.id);if(!state.openedAt){state.openedAt=now();await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(progressKey(clinic.id),JSON.stringify(state)).run()}return json({hospital:clinic.name,stage:clinic.data.stage||'',progress:state,remote:await remote(clinic.id),remoteUrl:'/setup?token='+saved.remoteToken,expiresAt:saved.expiresAt})}
 const m=await member();const clinic=await hospital(Number(url.searchParams.get('recordId')));if(!mayRecord(m,clinic))throw new HttpError(403,'이 병원 세팅 권한이 필요합니다.');return json({hospital:clinic.name,stage:clinic.data.stage||'',progress:await progress(clinic.id),remote:await remote(clinic.id),invitation:await current(clinic.id,req)});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{const raw=await req.text();if(raw.length>1200)throw new HttpError(413,'입력 길이를 확인해 주세요.');const body=JSON.parse(raw);if(body.action==='invite'){origin(req);const m=await member();const clinic=await hospital(Number(body.recordId));if(!mayRecord(m,clinic))throw new HttpError(403,'이 병원 세팅 권한이 필요합니다.');const existing=await current(clinic.id,req);if(existing?.active)return json({hospital:clinic.name,...existing});const portalToken=randomToken(),remoteToken=randomToken(),createdAt=Date.now(),expiresAt=createdAt+lifetime;await db().batch([db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind(journeyKey(await hash(portalToken)),JSON.stringify({recordId:clinic.id,remoteToken,expiresAt})),db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind(inviteKey(await hash(remoteToken)),JSON.stringify({recordId:clinic.id,name:clinic.name,expiresAt})),db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(currentKey(clinic.id),JSON.stringify({token:await encryptSetupToken(portalToken),createdAt,expiresAt}))]);return json({hospital:clinic.name,...await current(clinic.id,req)})}
 if(body.action==='mark'){origin(req);const saved=await invitation(body.token);const key=body.step==='contact'?'contactAt':body.step==='emr'?'emrAt':null;if(!key)throw new HttpError(400,'단계를 확인해 주세요.');const clinic=await hospital(saved.recordId);const current=await progress(clinic.id);if(!current[key]){current[key]=now();await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(progressKey(clinic.id),JSON.stringify(current)).run()}return json({progress:current})}
 throw new HttpError(400,'처리할 동작을 확인해 주세요.');}catch(e){return fail(e)}}
