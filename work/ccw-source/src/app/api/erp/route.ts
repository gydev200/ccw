import {validateIntake} from '@/lib/service-intake';
import {invalidateChangedChecks} from '@/lib/service-workflow';
import {validateServiceReview} from '@/lib/service-review';
import {db,identity,member,owner,record,updateRecord,createRecord,json,fail,origin,now,HttpError,bootstrapOwner} from '@/lib/server';
import {mayRecord,mayOrg,mayAssign,assertText,assertOrg,validUrl} from '@/lib/policy';
import humans from '@/lib/human-roster';
import {initialMentor,recordMentorSubmission} from '@/lib/mentor';
import {blankTask,MONTHS,ORGS,PLAN} from '@/lib/model';
import type {Member} from '@/lib/model';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const u=await identity();const init=await db().prepare("SELECT value FROM settings WHERE key = 'owner'").first<any>();
 if(!init)return json({needsSetup:true,identity:{id:u.userId,name:u.displayName}});
 const m=await member();
 if(!m)return json({needsMembership:true,identity:{id:u.userId,name:u.displayName}});
 const url=new URL(req.url);const rid=Number(url.searchParams.get('record'));
 if(rid){const r=await record(rid,m);const [events,files,times]=await Promise.all([db().prepare('SELECT * FROM events WHERE record_id = ? ORDER BY id DESC').bind(rid).all(),db().prepare('SELECT id,name,type,size,created_at FROM files WHERE record_id = ? ORDER BY created_at DESC').bind(rid).all(),db().prepare('SELECT * FROM times WHERE record_id = ? ORDER BY id DESC').bind(rid).all()]);return json({record:r,events:events.results.map((x:any)=>({...x,data:JSON.parse(x.data)})),files:files.results,times:times.results})}
 let query='SELECT * FROM records';const params:any[]=[];
 if(m.role!=='DO'){query+=" WHERE (assignee = ? OR (kind = 'task' AND json_extract(data,'$.coordinator') = ?)) AND org != ?";params.push(m.person,m.person,'DO');if(!(['kyunghwa','kimkiyoung'].includes(m.person)&&m.dss)){query+=' AND org != ?';params.push('DSS')}}
 query+=' ORDER BY id DESC';const records=await db().prepare(query).bind(...params).all();
 const times=m.role==='DO'?await db().prepare('SELECT * FROM times ORDER BY id DESC').all():await db().prepare("SELECT times.* FROM times INNER JOIN records ON records.id = times.record_id WHERE (records.assignee = ? OR (records.kind = 'task' AND json_extract(records.data,'$.mentor') IS NULL AND json_extract(records.data,'$.coordinator') = ?)) AND records.org != 'DO' AND (records.org != 'DSS' OR ? = 1) ORDER BY times.id DESC").bind(m.person,m.person,['kyunghwa','kimkiyoung'].includes(m.person)&&m.dss?1:0).all();
 const members=m.role==='DO'?(await db().prepare('SELECT id,person,role,dss,label,active FROM members ORDER BY created_at').all()).results:[];
 const draft=await db().prepare('SELECT data FROM drafts WHERE id = ?').bind(m.id).first<any>();
 return json({draft:draft?JSON.parse(draft.data):null,humanRoles:humans.map(h=>({id:h.id,name:h.name,grade:h.grade,primaryOrg:h.primaryOrg,secondaryOrgs:h.secondaryOrgs||[],reportsTo:('reportsTo' in h?h.reportsTo:undefined),placementAfter:('placementAfter' in h?h.placementAfter:undefined)})),member:m,identity:{id:u.userId,name:u.displayName},records:records.results.filter((r:any)=>mayRecord(m,r)).map((x:any)=>({...x,data:JSON.parse(x.data)})),times:m.role==='DO'?times.results:times.results.filter((t:any)=>records.results.some((r:any)=>r.id===t.record_id&&mayRecord(m,r))),members,orgs:ORGS.filter(o=>mayOrg(m,o.id)),plan:PLAN});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const u=await identity();const rawBody=await req.text();if(rawBody.length>150000)throw Error('입력 내용이 너무 큽니다.');const body:any=JSON.parse(rawBody);const action=body.action;
 if(action==='setup'){
  bootstrapOwner(u.email);
  const existing=await db().prepare("SELECT value FROM settings WHERE key = 'owner'").first<any>();if(existing)throw new HttpError(409,'이미 시작된 ERP입니다. 새로고침해 주세요.');
  // First-owner setup is reachable only through the newly created, owner-only Sites access policy.
  const ts=now();await db().batch([db().prepare("INSERT INTO settings (key,value) VALUES ('owner',?)").bind(u.userId),db().prepare("INSERT INTO members (id,person,role,dss,label,active,created_at) VALUES (?,'do','DO',1,'전무이사님',1,?)").bind(u.userId,ts)]);
  return json({ok:true});
 }
 const m=await member();
 if(action==='reviewService'){
  const r=await record(Number(body.id),m);if(r.kind!=='customer'||(m.role!=='DO'&&r.org!=='SS'))throw new HttpError(403,'SS 병원 기록에서만 수정할 수 있습니다.');
  if(r.version!==body.version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 확인해 주세요.');
  const review=validateServiceReview(invalidateChangedChecks(body.data,r.data.serviceReview));return json(await updateRecord(r,{...r.data,serviceReview:review},m,'서비스 세팅·검수 변경',{before:r.data.serviceReview||null,after:review}));
 }
 if(action==='saveDraft'){
  const d=body.data;const org=assertOrg(d?.org);if(!mayOrg(m,org))throw new HttpError(403,'허용되지 않은 조직입니다.');
  if(!d||JSON.stringify(d).length>80000)throw Error('지시 초안이 너무 큽니다.');const key=assertText(d._requestId,'지시 식별번호',100,true);
  const exists=await db().prepare('SELECT id FROM records WHERE dedup = ?').bind('request:'+m.id+':'+key).first();if(exists)return json({ok:true});
  await db().prepare('INSERT INTO drafts (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(m.id,JSON.stringify(d),now()).run();return json({ok:true});
 }
 if(action==='member'){
  owner(m);const id=assertText(body.id,'계정번호',200,true);const person=String(body.person);if(!['kyunghwa','kimkiyoung','parttime','parttime_am','parttime_pm'].includes(person))throw Error('실무자를 선택해 주세요.');const dss=['kyunghwa','kimkiyoung'].includes(person)?1:0;if(id===m.id)throw Error('전무이사님 계정은 실무자로 변경할 수 없습니다.');
  const existing=await db().prepare('SELECT * FROM members WHERE person = ?').bind(person).first<any>();if(existing&&existing.id!==id)throw Error('이미 다른 계정이 연결돼 있습니다. 먼저 기존 계정 연결을 중지해 주세요.');
  await db().batch([db().prepare('INSERT INTO members (id,person,role,dss,label,active,created_at) VALUES (?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET person = excluded.person, role = excluded.role, dss = excluded.dss, label = excluded.label, active = 1').bind(id,person,'staff',dss,person==='kyunghwa'?'경화님':person==='kimkiyoung'?'김기영 주임':'신규 알바',now()),db().prepare("INSERT INTO events (record_id,org,actor,action,data,created_at) VALUES (0,'DSS',?,'계정 연결',?,?)").bind(m.id,JSON.stringify({person,id}),now())]);return json({ok:true});
 }
 if(action==='disableMember'){owner(m);if(body.id===m.id)throw Error('전무이사님 계정은 중지할 수 없습니다.');await db().batch([db().prepare("UPDATE members SET active = 0, person = person || ':disabled:' || id WHERE id = ? AND role != 'DO'").bind(body.id),db().prepare("INSERT INTO events (record_id,org,actor,action,data,created_at) VALUES (0,'DSS',?,'계정 중지',?,?)").bind(m.id,JSON.stringify({id:body.id}),now())]);return json({ok:true})}
 if(action==='create'){
  const kind=String(body.kind);if(!['task','customer','assignment','thread','capacity'].includes(kind))throw Error('등록 종류를 확인해 주세요.');
  if(kind!=='task')owner(m);
  const org=assertOrg(body.data?.org);if(!mayOrg(m,org))throw new HttpError(403,'허용되지 않은 조직입니다.');
  const assignee=m.role==='DO'?assertText(body.data.assignee,'담당자',100,true):m.person;if(!mayAssign(org,assignee))throw Error('이 조직에 배정할 수 없는 담당자입니다.');
  let data:any;
  if(kind==='task'){
   const d=body.data;data={...blankTask(org),collaboration:assertText(d.collaboration||'','협조',2000),title:assertText(d.title,'업무명',300,true),instruction:assertText(d.instruction,'지시 원문',30000,true),criterion:assertText(d.criterion,'완료 기준',3000,true),org,assignee,start:assertText(d.start||'','시작일',30),due:String(d.due||''),priority:assertText(d.priority||'보통','우선순위',20),phase:assertText(d.phase||'구축·세팅','업무 구분',50),status:m.role==='DO'?'지시 등록':'등록 판단 대기',nextAction:assertText(d.nextAction||'','다음 행동',2000),customer:assertText(d.customer||'','고객사',300),sourceUrl:assertText(d.sourceUrl||'','원문 주소',2000),repeat:assertText(d.repeat||'없음','반복',30),parentId:d.parentId?Number(d.parentId):null,notes:assertText(d.notes||'','업무 분류',2000)};
   if(d.intake!==undefined)data.intake=validateIntake(d.intake);if(d.customRequest===true)data.customRequest=true;
   data.coordinator=m.role==='DO'?String(d.coordinator||'do'):'do';if(!['do','kyunghwa','parttime'].includes(data.coordinator)||!mayAssign(org,data.coordinator))throw Error('소통 담당자를 확인해 주세요.');
   data.mentor=initialMentor(assignee,'일반 업무 등록');if(data.mentor)data.status='등록 판단 대기';validateTaskDates(data);if(data.sourceUrl&&!validUrl(data.sourceUrl))throw Error('원문 주소를 확인해 주세요.');if(data.parentId)await record(data.parentId,m);
  }else{data=validateEntity(kind,{...body.data,org,assignee});}
  const requestId=kind==='task'&&body.data._requestId?assertText(body.data._requestId,'지시 식별번호',100,true):null;const dedup=requestId?'request:'+m.id+':'+requestId:undefined;if(dedup){const existing=await db().prepare('SELECT id FROM records WHERE dedup = ?').bind(dedup).first<any>();if(existing)return json({id:existing.id},201);}
  const id=await createRecord(kind,org,assignee,data,m,dedup);if(kind==='task')await db().prepare('DELETE FROM drafts WHERE id = ?').bind(m.id).run();return json({id},201)
 }
 if(action==='export'){owner(m);const [records,events,times,files,members,control]=await Promise.all(['records','events','times','files','members','control_entries'].map(t=>db().prepare(`SELECT * FROM ${t}`).all()));return json({schema:'ChartClean ERP 1',exportedAt:now(),records:records.results,events:events.results,times:times.results,files:files.results,members:members.results,control:control.results})}
 if(action==='seedAssignments'){
  owner(m);const rows=[];
  for(const month of MONTHS)for(const org of ORGS){const assignees=org.id==='DO'?['do']:org.id==='DSS'?['kyunghwa']:org.id==='DM'?['do','kyunghwa','parttime']:['kyunghwa','parttime'];for(const person of assignees){const data={org:org.id,assignee:person,month,scope:org.human,after:org.after,status:person==='parttime'?'단계적 배정':'겸직',minutes:null};rows.push(db().prepare('INSERT OR IGNORE INTO records (kind,org,assignee,data,dedup,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('assignment',org.id,person,JSON.stringify(data),`assignment:${month}:${org.id}:${person}`,now(),now()))}}
  await db().batch(rows);return json({ok:true})
 }
 const r=await record(Number(body.id),m);if(r.version!==Number(body.version))throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');const d={...r.data};
 if(action==='edit'){
  if(!['task','customer','assignment','thread','capacity'].includes(r.kind))throw Error('이 기록은 전용 관리 화면에서 수정해 주세요.');
  owner(m);if(r.kind==='task'){
   d.title=assertText(body.data.title,'업무명',300,true);d.instruction=assertText(body.data.instruction,'지시 원문',30000,true);d.criterion=assertText(body.data.criterion,'완료 기준',3000,true);d.org=assertOrg(body.data.org);d.assignee=assertText(body.data.assignee,'담당자',100,true);if(!mayAssign(d.org,d.assignee))throw Error('허용되지 않은 배정입니다.');if(d.assignee!==r.assignee&&d.mentor){if((d.mentor.messages||[]).length||(d.mentor.submissions||[]).length||(d.mentor.reviews||[]).length)throw new HttpError(409,'개인 대화·제출 이력이 있는 업무입니다. 원본을 보존하고 인계할 내용을 별도 업무로 등록해 주세요.');d.mentor=initialMentor(d.assignee,'담당자 변경');if(d.mentor)d.status='등록 판단 대기';}
   for(const k of ['start','due','priority','phase','nextAction','customer','sourceUrl','repeat','collaboration'])d[k]=assertText(body.data[k]||'',k,2000);if(!validUrl(d.sourceUrl))throw Error('원문 주소를 확인해 주세요.');
   if(body.data.notes!==undefined)d.notes=assertText(body.data.notes,'업무 분류',2000);validateTaskDates(d);d.coordinator=String(body.data.coordinator||'do');if(!['do','kyunghwa','parttime'].includes(d.coordinator)||!mayAssign(d.org,d.coordinator))throw Error('소통 담당자를 확인해 주세요.');d.approvedRevision=null;d.execution='';if(d.revision>0)d.status='수정 중';
  }else Object.assign(d,validateEntity(r.kind,r.kind==='customer'&&body.data.serviceReview?{...body.data,serviceReview:invalidateChangedChecks(body.data.serviceReview,r.data.serviceReview)}:body.data));
  return json(await updateRecord(r,d,m,'지시·배정 수정',{before:r.data,after:d}));
 }
 if(r.kind!=='task')throw Error('업무를 선택해 주세요.');
 if(action==='start'){if(!['지시 등록','수정 중','진행 중','응답 대기'].includes(d.status))throw Error('현재 단계에서는 시작할 수 없습니다.');d.status='진행 중';d.waitFor='';d.waitSince='';return json(await updateRecord(r,d,m,'실행 시작'));}
 if(action==='result'){
  if(['완료','보류','등록 판단 대기'].includes(d.status))throw Error('진행 가능한 업무인지 확인해 주세요.');d.result=assertText(body.text,'결과 내용',30000,true);d.resultUrl=assertText(body.url||'','결과 주소',2000);if(!validUrl(d.resultUrl))throw Error('결과 주소를 확인해 주세요.');d.revision++;d.approvedRevision=null;d.execution='';d.status='DO 판단 대기';d.waitFor='DO';d.waitSince=now();recordMentorSubmission(d,r,m.person,now(),'업무 상세 결과 등록');return json(await updateRecord(r,d,m,'결과 등록',{revision:d.revision,text:d.result,url:d.resultUrl}));
 }
 if(action==='decision'){
  owner(m);const choice=body.choice;const note=assertText(body.text,'판단 내용',10000,true);d.decisionNote=note;
  if(choice==='등록 승인'&&d.status==='등록 판단 대기')d.status='지시 등록';
  else if(choice==='승인'){if(!d.revision)throw Error('승인할 결과가 없습니다.');if(d.status==='완료')throw Error('종결된 업무입니다.');d.approvedRevision=d.revision;d.status='실행 대기';d.waitFor='';d.waitSince='';}
  else if(choice==='수정'){d.approvedRevision=null;d.execution='';d.status='수정 중';d.waitFor='';d.waitSince='';}
  else if(choice==='보류'){d.approvedRevision=null;d.status='보류';}
  else if(choice==='종결'){if(!d.execution||d.approvedRevision!==d.revision)throw Error('현재 결과의 승인과 실제 실행 기록이 필요합니다.');d.status='완료';d.waitFor='';d.waitSince='';}
  else if(choice==='재개'){if(d.status!=='보류')throw Error('보류된 업무만 재개할 수 있습니다.');d.status='진행 중';}
  else throw Error('현재 단계에서 가능한 판단을 선택해 주세요.');
  return json(await updateRecord(r,d,m,'DO '+choice,{revision:d.revision,note}));
 }
 if(action==='execution'){
  if(d.status!=='실행 대기'||d.approvedRevision!==d.revision)throw Error('현재 결과가 승인된 뒤 실행 기록을 등록해 주세요.');d.execution=assertText(body.text,'실제 실행 결과',10000,true);d.status='종결 판단 대기';return json(await updateRecord(r,d,m,'실제 실행 기록',{revision:d.revision,text:d.execution}));
 }
 if(action==='communication'){
  const text=assertText(body.text,'소통 내용',10000,true);const target=assertText(body.target||'','상대방',100,true);const date=assertText(body.contactAt||'','다음 연락일',100);if(body.wait&&!date)throw Error('다음 연락일을 입력해 주세요.');
  if(body.wait){if(['완료','보류','등록 판단 대기'].includes(d.status))throw Error('현재 단계에서는 대기로 바꿀 수 없습니다.');d.status='응답 대기';d.waitFor=target;d.waitSince=now();d.contactAt=date;d.nextAction=assertText(body.nextAction||'','다음 행동',2000,true);}
  return json(await updateRecord(r,d,m,'소통 기록',{target,text,contactAt:date}));
 }
 if(action==='time'){
  const minutes=Number(body.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('활동시간은 1~1440분으로 입력해 주세요.');const person=m.role==='DO'?String(body.person):m.person;if(![...humans.map(h=>h.id),'parttime','parttime_am','parttime_pm'].includes(person)||!mayAssign(r.org,person))throw Error('활동자를 확인해 주세요.');const date=String(body.date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('활동일을 확인해 주세요.');const note=assertText(body.text||'','활동 내용',2000,true);
  await db().batch([db().prepare('INSERT INTO times (record_id,org,person,minutes,date,note,created_at) VALUES (?,?,?,?,?,?,?)').bind(r.id,r.org,person,minutes,date,note,now()),db().prepare('INSERT INTO events (record_id,org,actor,action,data,created_at) VALUES (?,?,?,?,?,?)').bind(r.id,r.org,m.id,'활동시간 기록',JSON.stringify({person,minutes,date,note}),now())]);return json({ok:true});
 }
 if(action==='nextCycle'){
  owner(m);if(d.status!=='완료')throw Error('현재 회차를 종결한 뒤 다음 회차를 만드세요.');const due=String(body.due);if(!/^\d{4}-\d{2}-\d{2}/.test(due))throw Error('다음 기한을 입력해 주세요.');const key=`cycle:${r.id}:${due}`;const exists=await db().prepare('SELECT id FROM records WHERE dedup = ?').bind(key).first<any>();if(exists)return json({id:exists.id,existing:true});
  const next={...blankTask(r.org),title:d.title,instruction:d.instruction,criterion:d.criterion,org:r.org,assignee:r.assignee,coordinator:d.coordinator||'do',collaboration:d.collaboration||'',phase:'반복 운영',due,customer:d.customer,repeat:d.repeat,notes:d.notes||'',parentId:r.id,sourceUrl:d.sourceUrl,mentor:initialMentor(r.assignee,'반복 업무 새 회차')};if(next.mentor)next.status='등록 판단 대기';return json({id:await createRecord('task',r.org,r.assignee,next,m,key)});
 }
 throw Error('처리할 동작을 확인해 주세요.');
}catch(e){return fail(e)}}
function validateEntity(kind:string,raw:any){
 const org=assertOrg(raw.org);const assignee=assertText(raw.assignee,'담당자',100,true);if(!mayAssign(org,assignee))throw Error('허용되지 않은 배정입니다.');const d:any={org,assignee};
 const keys=kind==='customer'?['name','stage','service','nextAction','due','notes','sourceUrl','emrStatus','tone','frequency','intensity','dailyGoal','serviceStatus']:kind==='assignment'?['month','scope','after','status','position']:kind==='thread'?['title','number','url','status','purpose']:['month'];
 for(const key of keys)d[key]=assertText(raw[key]||'',key,10000,['name','title','month','scope'].includes(key));
 if(kind==='customer'&&raw.serviceReview!==undefined)d.serviceReview=validateServiceReview(raw.serviceReview);
 if(kind==='capacity'){const n=raw.minutes;if(n!==null&&(!Number.isInteger(Number(n))||Number(n)<0||Number(n)>50000))throw Error('가용시간을 확인해 주세요.');d.minutes=n===null?null:Number(n);}
 if(d.url&&!validUrl(d.url)||d.sourceUrl&&!validUrl(d.sourceUrl))throw Error('주소를 확인해 주세요.');if(d.month&&!MONTHS.includes(d.month))throw Error('9~12월 중 선택해 주세요.');return d;
}

function validateTaskDates(d:any){if(d.start&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.start)||!Number.isFinite(Date.parse(d.start))||new Date(d.start).toISOString().slice(0,10)!==d.start))throw Error('시작일을 확인해 주세요.');if(d.due&&!Number.isFinite(Date.parse(d.due)))throw Error('기한을 확인해 주세요.');if(d.start&&d.due&&d.start>d.due.slice(0,10))throw Error('기한은 시작일 이후여야 합니다.');}
