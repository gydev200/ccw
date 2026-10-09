import {db,member,owner,json,fail,origin,now,HttpError} from '@/lib/server';
import {assertText,validUrl} from '@/lib/policy';
import humans from '@/lib/human-roster';
import mentors from '@/lib/mentor-roster.json';
import candidates from '@/data/cchr-candidates.server.json';
import {HR_STATUSES,HR_LESSONS} from '@/lib/hr-model';
export const dynamic='force-dynamic';
const parse=(r:any)=>({...r,data:JSON.parse(r.data),history:JSON.parse(r.history)});
const text=(v:any,label:string,required=false,max=5000)=>assertText(v??'',label,max,required);
function integer(v:any,label:string){if(!Number.isInteger(v)||v<0)throw new HttpError(400,label+'을 확인해 주세요.');return v}
function day(v:any){const d=text(v,'날짜',true,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw new HttpError(400,'날짜를 확인해 주세요.');return d}
function statusFor(c:any,value:any){if(!HR_STATUSES.includes(value))throw new HttpError(400,'채용 상태를 확인해 주세요.');return c.source.includes('2차 채용')&&value==='1차 합격'?'2차 후보 1차 합격':value}
async function save(r:any,data:any,m:any,action:string){const ts=now();const history=[...r.history,{at:ts,actor:m.id,action,before:r.data,after:data}];const result=await db().prepare('UPDATE hr_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),JSON.stringify(history),ts,r.id,r.version).run();if(!result.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 확인해 주세요.');return json({ok:true,id:r.id,version:r.version+1})}
export async function GET(req:Request){try{
 const m=await member();const view=new URL(req.url).searchParams.get('view')||'education';
 if(view==='recruiting'){
  owner(m);const saved=await db().prepare("SELECT * FROM hr_entries WHERE kind='candidate' ORDER BY id").all<any>();const map=new Map(saved.results.map((r:any)=>{const p=parse(r);return [p.source_id,p]}));
  return json({candidates:candidates.map(c=>{const r:any=map.get(String(c.id));return {...c,photoPath:undefined,status:r?.data.status||statusFor(c,HR_STATUSES.includes(c.status as any)?c.status:'검토 전'),note:r?.data.note||'',version:r?.version||0,history:r?.history||[]}}),sourceDate:'2026-09-06',localStatusImport:'원래 CCHR의 브라우저별 변경은 원본 파일에 포함되지 않습니다.'});
 }
 if(view!=='education')throw new HttpError(400,'화면을 확인해 주세요.');
 const result=m.role==='DO'?await db().prepare("SELECT * FROM hr_entries WHERE kind='education' ORDER BY id DESC").all<any>():await db().prepare("SELECT * FROM hr_entries WHERE kind='education' AND person=? ORDER BY id DESC").bind(m.person).all<any>();
 return json({rows:result.results.map(parse),people:humans.filter(h=>h.id!=='do'&&(m.role==='DO'||h.id===m.person)).map(h=>{const id='mentorId' in h?h.mentorId:'';const mentor=mentors.people.find(p=>p.id===id);return {id:h.id,name:h.name,grade:h.grade,mentorId:id,mentorName:mentor?mentor.name+' '+mentor.grade:'배정 확인 필요'}}),lessons:HR_LESSONS,isDO:m.role==='DO',today:new Date(Date.now()+9*3600000).toISOString().slice(0,10)});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();const raw=await req.text();if(raw.length>50000)throw new HttpError(413,'내용이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='candidateStatus'){
  owner(m);const sourceId=integer(b.sourceId,'지원자 번호');const candidate=candidates.find(c=>c.id===sourceId);if(!candidate)throw new HttpError(404,'지원자를 찾을 수 없습니다.');const version=integer(b.version,'기록 버전');const data={status:statusFor(candidate,b.status),note:text(b.note,'판단 근거',true)};
  const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='candidate' AND source_id=?").bind(String(sourceId)).first<any>();
  if(old){if(old.version!==version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');return save(parse(old),data,m,'채용 상태 변경')}
  if(version!==0)throw new HttpError(409,'기록 버전을 확인해 주세요.');const ts=now();const result=await db().prepare("INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) VALUES('candidate',?,'do',?,?,?,?) ON CONFLICT(kind,source_id) DO NOTHING").bind(String(sourceId),JSON.stringify(data),JSON.stringify([{at:ts,actor:m.id,action:'채용 상태 변경',before:{status:candidate.status},after:data}]),ts,ts).run();if(!result.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다.');return json({ok:true,version:1},201);
 }
 if(b.action==='assign'){
  owner(m);const person=text(b.person,'교육 대상',true);if(!humans.some(h=>h.id===person&&h.id!=='do'))throw new HttpError(400,'교육 대상을 확인해 주세요.');const lesson=HR_LESSONS.find(l=>l.id===b.lessonId);if(!lesson)throw new HttpError(400,'교육 과제를 선택해 주세요.');
  const date=day(b.date);const key=person+':'+date+':'+lesson.id;const data={title:lesson.title,lessonId:lesson.id,date,instruction:text(b.instruction,'업무 지시',true),resources:text(b.resources,'실습 자료·승인 예시',true),criterion:text(b.criterion||lesson.criterion,'완료 기준',true),status:'배정',submission:null,review:null};const ts=now();const result=await db().prepare("INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) VALUES('education',?,?,?,?,?,?) ON CONFLICT(kind,source_id) DO NOTHING").bind(key,person,JSON.stringify(data),JSON.stringify([{at:ts,actor:m.id,action:'교육 배정',after:data}]),ts,ts).run();if(!result.meta.changes)throw new HttpError(409,'같은 날짜의 과제가 이미 있습니다. 기존 과제를 확인해 주세요.');return json({ok:true,id:result.meta.last_row_id},201);
 }
 const id=integer(b.id,'교육 번호'),version=integer(b.version,'기록 버전');const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='education' AND id=?").bind(id).first<any>();if(!old||(m.role!=='DO'&&old.person!==m.person))throw new HttpError(404,'교육 기록을 찾을 수 없습니다.');if(old.version!==version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');const r=parse(old);
 if(b.action==='submit'){
  if(m.person!==r.person)throw new HttpError(403,'교육 결과는 본인이 제출해 주세요.');if(r.data.status==='확인 완료')throw new HttpError(400,'확인이 완료된 과제입니다.');const url=text(b.url,'결과 주소',false,2000);if(!validUrl(url))throw new HttpError(400,'결과 주소를 확인해 주세요.');return save(r,{...r.data,status:'확인 대기',review:null,submission:{result:text(b.result,'작업 결과',true),url,corrections:text(b.corrections,'수정 내역'),help:text(b.help,'받은 도움·질문'),at:now()}},m,'교육 결과 제출');
 }
 if(b.action==='review'){
  owner(m);if(r.data.status!=='확인 대기'||!r.data.submission)throw new HttpError(400,'제출된 결과를 먼저 확인해 주세요.');if(!['확인 완료','수정 요청'].includes(b.status))throw new HttpError(400,'확인 결과를 선택해 주세요.');const review={note:text(b.note,'확인 근거·다음 지도',true),independent:b.independent===true,at:now(),actor:m.id};return save(r,{...r.data,status:b.status,review},m,'교육 확인·평가');
 }
 throw new HttpError(400,'처리할 작업을 확인해 주세요.');
 }catch(e){return fail(e)}}
