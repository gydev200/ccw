import {durable} from '@/lib/academy-retention';
import {db,member,owner,json,fail,origin,now,HttpError} from '@/lib/server';
import {assertText} from '@/lib/policy';
import humans from '@/lib/human-roster';
import bank from '@/lib/academy-questions.server.json';
import {ACADEMY,KPI_TEMPLATES,REVIEW_DIMENSIONS,periodRange,scoreSummary} from '@/lib/academy-model';
export const dynamic='force-dynamic';
const text=(v:any,label:string,required=false,max=6000)=>assertText(v??'',label,max,required);
const int=(v:any,min=0,max=100000)=>{if(!Number.isInteger(v)||v<min||v>max)throw new HttpError(400,'숫자 범위를 확인해 주세요.');return v};
const day=(v:any)=>periodRange('daily',text(v,'날짜',true,10)).start;
const auditData=(kind:string,data:any)=>{if(kind!=='academy_attempt')return data;const {questions,...rest}=data;return rest};
const parse=(r:any)=>({...r,data:JSON.parse(r.data),history:JSON.parse(r.history)});
const allowedKinds=['academy_assignment','academy_attempt','academy_log','academy_metric','academy_review','academy_progress'];
function person(v:any){const p=text(v,'직원',true,100);if(!humans.some(h=>h.id===p&&h.id!=='do'))throw new HttpError(400,'직원을 확인해 주세요.');return p}
function clean(r:any,m:any){const out=structuredClone(r);if(out.kind==='academy_attempt'&&out.data.questions){out.data.questions=out.data.questions.map((q:any)=>{const revised=bank.find(b=>b.id===q.id);return revised&&['company-20','organization-2','organization-11','organization-17'].includes(q.id)?{...q,prompt:revised.prompt}:q})}if(m.role!=='DO'&&out.kind==='academy_attempt'){
 const strip=(d:any)=>{if(!d?.questions)return d;return {...d,questions:d.questions.map((q:any)=>{if(d.status==='평가 완료')return q;const {answer,criteria,model,explanation,...safe}=q;return safe})}};
 out.data=strip(out.data);out.history=out.history.map((h:any)=>({...h,before:strip(h.before),after:strip(h.after)}));
 }return out}
async function row(id:any,m:any,kind?:string){const r=await db().prepare('SELECT * FROM hr_entries WHERE id=?').bind(int(id,1)).first<any>();if(!r||!allowedKinds.includes(r.kind)||(kind&&r.kind!==kind)||(m.role!=='DO'&&r.person!==m.person))throw new HttpError(404,'본인의 기록을 찾을 수 없습니다.');return parse(r)}
async function insert(kind:string,key:string,p:string,data:any,m:any){const ts=now();const res=await db().prepare('INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(kind,source_id) DO NOTHING').bind(kind,key,p,JSON.stringify(data),JSON.stringify([{at:ts,actor:m.id,action:kind,after:auditData(kind,data)}]),ts,ts).run();if(!res.meta.changes)throw new HttpError(409,'같은 기록이 이미 있습니다. 목록에서 이어서 진행해 주세요.');return clean(await row(Number(res.meta.last_row_id),m),m)}
async function save(r:any,data:any,b:any,m:any,action:string){if(r.version!==int(b.version,1))throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 입력을 보관한 뒤 새로 불러와 주세요.');const ts=now();const history=[...r.history,{at:ts,actor:m.id,action,before:auditData(r.kind,r.data),after:auditData(r.kind,data)}];const res=await db().prepare('UPDATE hr_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),JSON.stringify(history),ts,r.id,r.version).run();if(!res.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 다시 불러와 주세요.');return clean({...r,data,history,version:r.version+1,updated_at:ts},m)}
function answersFor(qs:any[],raw:any,complete=false){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('답안을 확인해 주세요.');if(Object.keys(raw).some(id=>!qs.some(q=>q.id===id)))throw Error('배정된 문항만 답해 주세요.');const out:any={};for(const q of qs){const v=raw[q.id];if(q.type==='choice'){if(v!==undefined&&v!==null&&v!=='')out[q.id]=int(v,0,q.options.length-1);else if(complete)throw Error('모든 객관식 문항에 답해 주세요.')}else{out[q.id]=text(v,'주관식 답안',complete,4000)}}return out}
export async function GET(){try{const m=await member();const results=m.role==='DO'?await db().prepare("SELECT * FROM hr_entries WHERE kind IN ('academy_assignment','academy_attempt','academy_log','academy_metric','academy_review','academy_progress') ORDER BY id DESC").all<any>():await db().prepare("SELECT * FROM hr_entries WHERE kind IN ('academy_assignment','academy_attempt','academy_log','academy_metric','academy_review','academy_progress') AND person=? ORDER BY id DESC").bind(m.person).all<any>();
 if(m.role==='DO'){for(const r of results.results){if(r.kind==='academy_attempt'){try{r.receipt=await durable(r);r.backupConfirmed=true}catch{r.backupConfirmed=false}}}}return json({rows:results.results.map(parse).map(r=>clean(r,m)),people:humans.filter(h=>h.id!=='do'&&(m.role==='DO'||h.id===m.person)).map(h=>({id:h.id,name:h.name,grade:h.grade,primaryOrg:h.primaryOrg,secondaryOrgs:'secondaryOrgs'in h?h.secondaryOrgs:[]})),today:new Date(Date.now()+9*3600000).toISOString().slice(0,10),isDO:m.role==='DO',content:ACADEMY,kpis:KPI_TEMPLATES,dimensions:REVIEW_DIMENSIONS});}catch(e){return fail(e)}}
export async function POST(req:Request){try{origin(req);const m=await member();const raw=await req.text();if(raw.length>500000)throw new HttpError(413,'입력 내용이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='assign'){
  owner(m);const p=person(b.person),track=ACADEMY.tracks.find(t=>t.id===b.track);if(!track)throw Error('교육 과정을 선택해 주세요.');const date=day(b.date),round=int(b.round,1,20);return json(await insert('academy_assignment',p+':'+date+':'+round,p,{date,round,track:track.id,modules:track.modules,title:`${round}차 · ${track.name}`,contentVersion:ACADEMY.version,status:'배정',note:text(b.note,'배정 안내')},m),201);
 }
 if(b.action==='progress'){
  const mod=ACADEMY.modules.find(x=>x.id===b.module);if(!mod)throw Error('교육 부문을 확인해 주세요.');const key=m.person+':'+ACADEMY.version+':'+mod.id;const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='academy_progress' AND source_id=?").bind(key).first<any>();if(old)return json(clean(parse(old),m));return json(await insert('academy_progress',key,m.person,{module:mod.id,contentVersion:ACADEMY.version,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),status:'읽음 확인'},m),201);
 }
 if(b.action==='start'){
  const a=await row(b.id,m,'academy_assignment');if(a.person!==m.person)throw new HttpError(403,'시험은 배정된 본인이 시작해 주세요.');const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='academy_attempt' AND source_id=?").bind(String(a.id)).first<any>();if(old)return json(clean(parse(old),m));if(a.data.contentVersion!==ACADEMY.version)throw Error('교육 내용이 변경됐습니다. 담당자에게 새 시험 배정을 요청해 주세요.');const questions=bank.filter(q=>a.data.modules.includes(q.module));return json(await insert('academy_attempt',String(a.id),m.person,{assignmentId:a.id,title:a.data.title,date:new Date(Date.now()+9*3600000).toISOString().slice(0,10),scheduledDate:a.data.date,round:a.data.round,contentVersion:ACADEMY.version,questions,answers:{},marks:{},status:'응시 중',startedAt:now(),submittedAt:null,review:null},m),201);
 }
 if(['draft','submit','mark'].includes(b.action)){
  const r=await row(b.id,m,'academy_attempt');
  if(b.action==='mark'){
   owner(m);if(r.data.status!=='채점 대기')throw Error('제출된 시험의 채점 대기 상태를 확인해 주세요.');const written=r.data.questions.filter((q:any)=>q.type==='written'),marks:any={};for(const q of written){const mark=b.marks?.[q.id];if(!mark)throw Error('모든 주관식 문항을 채점해 주세요.');marks[q.id]={score:int(mark.score,0,q.points),note:text(mark.note,'문항별 채점 근거',true,2000)}}const data={...r.data,marks,status:'평가 완료',summary:scoreSummary(r.data.questions,r.data.answers,marks),review:{note:text(b.note,'총평·다음 교육',true),at:now(),actor:m.id}};return json(await save(r,data,b,m,'시험 평가 확정'));
  }
  if(r.person!==m.person)throw new HttpError(403,'답안은 본인이 작성해 주세요.');if(r.data.status!=='응시 중')throw Error('제출한 답안은 수정할 수 없습니다. 재시험은 새 회차로 배정받습니다.');const complete=b.action==='submit',answers=answersFor(r.data.questions,b.answers,complete);return json(await save(r,{...r.data,answers,date:complete?new Date(Date.now()+9*3600000).toISOString().slice(0,10):r.data.date,status:complete?'채점 대기':'응시 중',submittedAt:complete?now():null,...(complete?{summary:scoreSummary(r.data.questions,answers)}:{})},b,m,complete?'답안 제출':'답안 임시저장'));
 }
 if(b.action==='metric'){
  owner(m);const p=person(b.person),template=KPI_TEMPLATES.find(k=>k.org===b.org);if(!template)throw Error('업무 부문을 선택해 주세요.');const start=day(b.start),end=day(b.end);if(start>end)throw Error('기간을 확인해 주세요.');const target=int(b.target,0,100);const existing=await db().prepare("SELECT id FROM hr_entries WHERE kind='academy_metric' AND person=? AND json_extract(data,'$.org')=? AND json_extract(data,'$.start')<=? AND json_extract(data,'$.end')>=?").bind(p,template.org,end,start).first();if(existing)throw new HttpError(409,'같은 부문의 적용 기간이 겹칩니다. 기존 지표 기간을 확인해 주세요.');return json(await insert('academy_metric',p+':'+template.org+':'+start+':'+end,p,{...template,start,end,target,reason:text(b.reason,'목표 설정 근거',true),status:'적용',unit:'%',date:start},m),201);
 }
 if(b.action==='log'){
  const date=day(b.date),org=text(b.org,'업무 부문',true,12);if(!KPI_TEMPLATES.some(k=>k.org===org))throw Error('업무 부문을 선택해 주세요.');const observations=[];
  for(const ob of Array.isArray(b.observations)?b.observations:[]){const k=await row(ob.metricId,m,'academy_metric');if(k.person!==m.person||k.data.org!==org||date<k.data.start||date>k.data.end)throw Error('해당 날짜·부문·본인의 성과지표를 선택해 주세요.');const numerator=int(ob.numerator),denominator=int(ob.denominator);if(numerator>denominator)throw Error('충족 건수는 대상 건수보다 클 수 없습니다.');observations.push({metricId:k.id,numerator,denominator,evidence:text(ob.evidence,'측정 근거',true,2000)});}
  const data={date,org,title:text(b.title,'업무 제목',true,200),taskRef:text(b.taskRef,'업무번호·지시 위치',true,500),result:text(b.result,'수행 결과',true),evidence:text(b.evidence,'결과 증빙 위치',true,2000),blocker:text(b.blocker,'막힘·대기'),next:text(b.next,'다음 행동·담당·기한',true),support:text(b.support,'받은 도움'),minutes:int(b.minutes,0,1440),waitingMinutes:int(b.waitingMinutes,0,1440),manualModules:[org],observations,status:'피드백 대기',review:null};
  if(b.id){const r=await row(b.id,m,'academy_log');if(r.person!==m.person)throw new HttpError(403,'업무일지는 본인이 수정해 주세요.');if(r.data.status==='확인 완료')throw Error('확인 완료된 일지는 수정 요청 후 보완해 주세요.');return json(await save(r,data,b,m,'업무일지 수정'))}
  const requestId=text(b.requestId,'저장 식별자',true,100);return json(await insert('academy_log',m.person+':'+requestId,m.person,data,m),201);
 }
 if(b.action==='feedback'){
  owner(m);const r=await row(b.id,m,'academy_log');if(!['확인 완료','보완 요청'].includes(b.status))throw Error('피드백 결과를 선택해 주세요.');const data={...r.data,status:b.status,review:{note:text(b.note,'피드백 근거',true),next:text(b.next,'다음 행동·기한',true),at:now(),actor:m.id}};return json(await save(r,data,b,m,'업무 피드백'));
 }
 if(b.action==='review'){
  owner(m);const p=person(b.person),range=periodRange(b.period,day(b.date));if(!Array.isArray(b.refs)||!b.refs.length)throw Error('평가할 업무일지·시험 근거를 선택해 주세요.');const refs=[];for(const ref of b.refs){const r=await row(ref.id,m);if(r.person!==p||!['academy_log','academy_attempt'].includes(r.kind)||r.data.date<range.start||r.data.date>range.end)throw Error('해당 직원·기간의 근거만 선택해 주세요.');if(r.version!==ref.version)throw new HttpError(409,'평가 근거가 변경됐습니다. 다시 확인해 주세요.');if(!['확인 완료','평가 완료'].includes(r.data.status))throw Error('확인·채점이 끝난 근거를 선택해 주세요.');refs.push({id:r.id,version:r.version,kind:r.kind,title:r.data.title,date:r.data.date,snapshot:r.data});}
  const ratings:any={};for(const key of REVIEW_DIMENSIONS){const value=b.ratings?.[key];ratings[key]={score:int(value?.score,1,5),note:text(value?.note,key+' 평가 근거',true,2000)}}
  const data={...range,date:range.start,period:b.period,title:({daily:'일일',weekly:'주간',monthly:'월간'} as any)[b.period]+' 고과',refs,ratings,note:text(b.note,'종합 피드백',true),next:text(b.next,'개선 과제·담당·기한',true),status:'평가 확정',reviewer:m.id};
  if(b.id){const r=await row(b.id,m,'academy_review');if(r.person!==p||r.data.start!==range.start||r.data.end!==range.end||r.data.period!==b.period)throw Error('기존 평가의 직원·기간을 바꿀 수 없습니다.');return json(await save(r,data,b,m,'기간 고과 정정'))}
  return json(await insert('academy_review',p+':'+b.period+':'+range.start,p,data,m),201);
 }
 throw Error('처리할 작업을 확인해 주세요.');
 }catch(e){return fail(e)}}
