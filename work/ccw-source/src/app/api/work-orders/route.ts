import {db,member,owner,json,fail,origin,now,HttpError,record} from '@/lib/server';
import {assertText,mayRecord,validUrl} from '@/lib/policy';
import {STAFF,todayOrders,validateOrder,defaultAccess,validDate,ORDER_STATES,DEPARTMENTS} from '@/lib/work-orders';
export const dynamic='force-dynamic';
const parse=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function GET(){try{
 const m=await member();const rows=await db().prepare("SELECT * FROM records WHERE kind='work_order' ORDER BY json_extract(data,'$.due'),id").all<any>();
 const visible=rows.results.filter(r=>mayRecord(m,r)).map(parse);
 const people=STAFF.filter(p=>m.role==='DO'||p.person===m.person);const schedules=[];
 for(const p of people){const r=await db().prepare('SELECT value FROM settings WHERE key=?').bind('staff-access:'+p.person).first<any>();const c=await db().prepare('SELECT s.value FROM settings s JOIN members m ON s.key = ? || m.id WHERE m.person=?').bind('credential-member:',p.person).first<any>();schedules.push({...p,access:r?JSON.parse(r.value):defaultAccess(p.person),username:c?.value||p.username,accountExists:!!c});}
 return json({orders:visible,people:schedules,isDO:m.role==='DO',member:m});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();const raw=await req.text();if(raw.length>60000)throw new HttpError(413,'입력 내용이 너무 큽니다.');const b=JSON.parse(raw);const ts=now();
 if(b.action==='seed'){
  owner(m);const queries=todayOrders().map(d=>db().prepare("INSERT OR IGNORE INTO records(kind,org,assignee,data,dedup,created_at,updated_at) VALUES ('work_order',?,?,?,?,?,?)").bind(d.org,d.assignee,JSON.stringify(d),d.seedKey,ts,ts));const out=await db().batch(queries);return json({ok:true,created:out.reduce((n,r)=>n+(r.meta.changes||0),0)});
 }
 if(b.action==='access'){
  owner(m);const spec=STAFF.find(p=>p.person===b.person);if(!spec)throw Error('직원을 확인해 주세요.');const a=b.access;if(!a||!Array.isArray(a.orgs)||!a.orgs.every((x:any)=>DEPARTMENTS.includes(x))||(spec.person!=='kyunghwa'&&a.orgs.includes('DSS')))throw Error('허용할 부서를 확인해 주세요.');
  if(!Array.isArray(a.screens)||!a.screens.every((x:any)=>['업무 지시','내 인사·고과','교육·오리엔테이션'].includes(x))||!a.screens.includes('업무 지시'))throw Error('기본 업무 화면을 확인해 주세요.');if(!Array.isArray(a.weekdays)||!a.weekdays.every((x:any)=>Number.isInteger(x)&&x>=0&&x<=6))throw Error('근무 요일을 확인해 주세요.');
  const access={orgs:[...new Set(a.orgs)],screens:[...new Set(a.screens)],weekdays:[...new Set(a.weekdays)],scheduleConfirmed:a.scheduleConfirmed===true};
  await db().batch([db().prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('staff-access:'+spec.person,JSON.stringify(access)),db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) VALUES(0,'DO',?,'직원 화면·근무요일 설정',?,?)").bind(m.id,JSON.stringify({person:spec.person,access}),ts)]);return json({ok:true});
 }
 if(b.action==='create'){
  owner(m);const d=validateOrder(b.data);const key=assertText(b.requestId,'저장 식별자',100,true);const r=await db().prepare("INSERT INTO records(kind,org,assignee,data,dedup,created_at,updated_at) VALUES('work_order',?,?,?,?,?,?) ON CONFLICT(dedup) DO NOTHING").bind(d.org,d.assignee,JSON.stringify(d),'work-order:'+key,ts,ts).run();return json({ok:true,id:r.meta.last_row_id});
 }
 const id=Number(b.id);if(!Number.isInteger(id)||id<1)throw Error('업무를 선택해 주세요.');const r=await record(id,m);if(r.kind!=='work_order')throw new HttpError(404,'업무 지시를 찾을 수 없습니다.');if(r.version!==b.version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로 불러온 뒤 다시 확인해 주세요.');
 let d={...r.data};const queries:any[]=[];let action='';let log:any=null;
 if(b.action==='edit'){
  owner(m);const edit=validateOrder(b.data);if(edit.org!==r.org)throw Error('일과 기록은 원래 부서에 남습니다. 다른 부서 일은 새 업무로 등록해 주세요.');
  d={...d,...edit,status:d.status};if(edit.assignee!==r.assignee){d.assignmentHistory=[...(d.assignmentHistory||[]),{from:r.assignee,to:edit.assignee,at:ts,note:assertText(b.handoff,'인계 내용',6000,true)}];d.status='배정';d.result='';d.evidence='';d.blocker='';d.next='';d.minutes=0;d.questions=[];d.review=null;}
  action='배상무 업무 조율';
 }else if(b.action==='status'){
  if(!['진행 중','조율 필요'].includes(b.status)||d.status==='완료')throw Error('현재 업무 상태를 확인해 주세요.');d.status=b.status;action='업무 상태 변경';
 }else if(b.action==='review'){
  owner(m);if(!['완료','보완 요청'].includes(b.status))throw Error('확인 결과를 선택해 주세요.');if(b.status==='완료'&&(d.status!=='상사 확인 대기'||!d.result))throw Error('제출한 결과를 먼저 확인해 주세요.');d.status=b.status;d.review={note:assertText(b.note,'확인 내용',6000,true),actor:m.id,at:ts,source:'DO 확인'};action='업무 결과 확인';
 }else if(b.action==='report'){
  if(m.person!==r.assignee)throw new HttpError(403,'결과와 업무일지는 담당자 본인이 등록합니다.');if(d.status==='완료')throw Error('완료한 업무는 수정 요청을 받은 뒤 보완해 주세요.');
  const date=assertText(b.date,'작업일',10,true);if(!validDate(date))throw Error('작업일을 확인해 주세요.');const minutes=Number(b.minutes);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw Error('실제 작업시간을 확인해 주세요.');
  d.result=assertText(b.result,'작업 결과',12000,true);d.evidence=assertText(b.evidence,'결과 위치·근거',3000,true);d.blocker=assertText(b.blocker||'','막힌 일',6000);d.next=assertText(b.next,'다음 행동·담당·기한',6000,true);d.minutes=minutes;d.status=d.blocker?'조율 필요':'상사 확인 대기';
  log={date,org:r.org==='PM'?'PPM':r.org,title:d.title,taskRef:'업무 지시 #'+r.id,result:d.result,evidence:d.evidence,blocker:d.blocker,next:d.next,support:assertText(b.support||'','AI 도움',3000),minutes,waitingMinutes:0,manualModules:[r.org],observations:[],status:'피드백 대기',review:null,workOrderId:r.id};action='결과·업무일지 제출';
 }else if(b.action==='question'){
  if(m.person!==r.assignee)throw new HttpError(403,'담당자 본인의 질문만 등록할 수 있습니다.');const question=assertText(b.question,'질문',6000,true);d.questions=[...(d.questions||[]),{id:crypto.randomUUID(),person:m.person,question,at:ts,status:'답변 대기'}];d.status='조율 필요';action='상사에게 질문';
 }else if(b.action==='answer'){
  owner(m);const answer=assertText(b.answer,'답변',6000,true);const questions=d.questions||[];if(!questions.some((q:any)=>q.id===b.questionId))throw Error('질문을 선택해 주세요.');d.questions=questions.map((q:any)=>q.id===b.questionId?{...q,answer,answeredAt:ts,status:'답변 등록',answerSource:'DO 확인'}:q);action='질문 답변 등록';
 }else throw Error('처리할 작업을 확인해 주세요.');
 // The optimistic update guards every following write; D1 batch makes report and log atomic.
 const serialized=JSON.stringify(d);queries.push(db().prepare('UPDATE records SET data=?,assignee=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(serialized,d.assignee,ts,id,b.version));
 queries.push(db().prepare('INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(id,r.org,m.id,action,JSON.stringify({status:d.status}),ts));
 if(log)queries.push(db().prepare("INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) SELECT 'academy_log',?,?,?,?,?,? WHERE changes()>0 AND EXISTS(SELECT 1 FROM records WHERE id=? AND version=? AND data=?) ON CONFLICT(kind,source_id) DO UPDATE SET data=excluded.data,history=json_insert(hr_entries.history,'$[#]',json(?)),version=hr_entries.version+1,updated_at=excluded.updated_at").bind('work-order:'+id+':'+m.person+':'+log.date,m.person,JSON.stringify(log),JSON.stringify([{at:ts,actor:m.id,action:'업무 지시에서 제출'}]),ts,ts,id,b.version+1,serialized,JSON.stringify({at:ts,actor:m.id,action:'업무 지시에서 보완'})));
 const out=await db().batch(queries);if(!out[0].meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로 불러와 주세요.');return json({ok:true,version:b.version+1,logSaved:!!log});
}catch(e){return fail(e)}}
