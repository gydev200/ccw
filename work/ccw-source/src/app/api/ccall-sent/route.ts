import {env} from '@/lib/runtime';
import {db,member,origin,json,fail,HttpError,createRecord,updateRecord} from '@/lib/server';
import {canCCall,validateCCallTarget} from '@/lib/ccall';
const clinics=[{id:'planme',name:'플랜미',connected:true},{id:'floce',name:'플로체',connected:false},{id:'yonsei',name:'연세리셀',connected:false},{id:'rea',name:'레아산부인과',connected:false}];
async function access(){const m=await member();if(!canCCall(m))throw new HttpError(403,'SS C콜 권한이 필요합니다.');return m;}
async function rounds(){
 const stored=(await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'ss-production:planme:%' AND key NOT LIKE '%:review' AND key NOT LIKE '%:history:%'").all<any>()).results;
 return stored.map(r=>JSON.parse(r.value)).filter(run=>/^\d{4}-\d{2}-\d{2}$/.test(run.date)&&Array.isArray(run.rows)&&run.rows.length).map(run=>({date:run.date,count:run.rows.length})).sort((a,b)=>b.date.localeCompare(a.date));
}
async function load(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new HttpError(400,'예정일을 확인해 주세요.');
 const available=await rounds();if(!available.some(r=>r.date===date))return {rows:[],rounds:available};
 const base='ss-production:planme:'+date;
 const raw=await db().prepare('SELECT value FROM settings WHERE key=?').bind(base).first<any>();
 const proof=await db().prepare('SELECT value FROM settings WHERE key=?').bind(base+':review').first<any>();
 const run=JSON.parse(raw.value),receipt=proof?JSON.parse(proof.value).payload:null;
 // A preparation list is visible before review/dispatch. Only matching references may resolve identity.
 const identities=(receipt?.patients||[]).filter((p:any)=>run.rows.some((r:any)=>r.ref===p.ref));
 let source:any={rows:[],checkedAt:new Date().toISOString()},sourceWarning='';
 if(identities.length){
  if(!env.SS_DISPATCH_TOKEN)sourceWarning='환자 연락처 연결 확인 필요';
  else try {
   const response=await fetch('https://app-chenggyo.vercel.app/api/chaenggyeo/send/ccall',{method:'POST',headers:{Authorization:'Bearer '+env.SS_DISPATCH_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({hospital:'planme',date,patientIds:identities.map((p:any)=>p.patientId),includePlanned:true}),signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('원본 조회 실패');source=await response.json();if(source.hospital!=='planme'||!Array.isArray(source.rows))throw Error('병원 불일치');
  }catch{source={rows:[],checkedAt:new Date().toISOString()};sourceWarning='환자 연락처 조회 지연 · 다시 조회해 주세요.';}
 }
 const records=(await db().prepare("SELECT id,version,assignee,data FROM records WHERE kind='ccall_target'").all<any>()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 return {rounds:available,checkedAt:source.checkedAt,reason:sourceWarning,rows:run.rows.map((context:any)=>{
  const identity=identities.find((x:any)=>x.ref===context.ref),p=identity?source.rows.find((x:any)=>x.patientId===identity.patientId):null;
  const call=records.find((r:any)=>r.data.source==='sent-history'&&r.data.hospital==='planme'&&r.data.date===date&&r.data.ref===context.ref);
  const refused=records.some((r:any)=>r.data.hospital==='planme'&&r.data.ref===context.ref&&r.data.outcome==='연락 거절');
  return {...(p||{patientNumber:'',name:'환자 정보 연결 대기',phone:null,callable:false,sentAt:'',sendStatus:'발송 예정',holdReason:sourceWarning||'환자 연락처 연결 대기'}),patientId:undefined,ref:context.ref,rank:context.rank,context:context.source||'',message:p?.sentAt?p.message:context.lms,call,callable:!!p?.callable&&!refused,phone:refused?null:p?.phone||null,holdReason:refused?'연락 거절 기록 · 후속 전화 중단':p?.holdReason||sourceWarning||(!p?'환자 연락처 연결 대기':'')};
 }).sort((a:any,b:any)=>String(a.patientNumber||'').localeCompare(String(b.patientNumber||''),'ko',{numeric:true})||a.ref.localeCompare(b.ref))};
}
export async function GET(req:Request){try{await access();const u=new URL(req.url),hospital=u.searchParams.get('hospital')||'planme',date=u.searchParams.get('date')||new Date(Date.now()+9*3600000).toISOString().slice(0,10);if(hospital!=='planme')return json({hospitals:clinics,rows:[],rounds:[],reason:'오늘 C콜은 플랜미만 운영합니다.'});return json({hospitals:clinics,...await load(date)});}catch(e){return fail(e)}}
export async function POST(req:Request){try{origin(req);const m=await access();const b:any=await req.json();if(b.hospital!=='planme')throw new HttpError(400,'오늘 C콜은 플랜미만 운영합니다.');const source=await load(b.date),patient=source.rows.find((p:any)=>p.ref===b.ref);if(!patient)throw new HttpError(409,'해당 날짜의 발송 예정 명단에 있는 환자만 기록할 수 있습니다.');if(!patient.callable&&b.outcome!=='연락 거절'&&b.outcome!=='통화 예정')throw new HttpError(409,patient.holdReason);const d=validateCCallTarget({...b,group:patient.sentAt&&(!b.callAt||Date.parse(b.callAt)>Date.parse(patient.sentAt))?'after':'before',sentAt:patient.sentAt||'',delivery:'미확인',evidence:patient.sentAt?'SOLAPI 발송 원장 연결':'날짜별 발송 예정 명단 연결',date:b.date,ref:b.ref});const data={...d,source:'sent-history',hospital:'planme',assignee:m.person};if(patient.call){if(m.role!=='DO'&&patient.call.assignee!==m.person)throw new HttpError(403,'다른 담당자의 통화 기록은 수정할 수 없습니다.');if(patient.call.data.recording&&!d.recordingBasisConfirmed)throw new HttpError(409,'녹음 운영 기준 확인은 유지해야 합니다.');if(patient.call.version!==b.version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');const r=await db().prepare('SELECT * FROM records WHERE id=?').bind(patient.call.id).first<any>();if(patient.call.data.recording&&patient.call.data.callAt!==d.callAt)throw new HttpError(409,'녹음이 연결된 통화 시각은 변경할 수 없습니다.');await updateRecord({...r,data:JSON.parse(r.data)},{...data,recording:patient.call.data.recording||null},m,d.group==='before'?'C콜 발송 전 통화 기록':'C콜 발송 후 통화 기록',{previous:patient.call.data,next:data});return json({id:r.id});}const id=await createRecord('ccall_target','SS',m.person,{...data,recording:null},m,`ccall-sent:planme:${b.date}:${b.ref}`);return json({id},201);}catch(e){return fail(e)}}
