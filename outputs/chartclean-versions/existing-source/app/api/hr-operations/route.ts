import {db,member,json,fail,origin,now,HttpError} from '@/lib/server';
import {hrManagerAllowed} from '@/lib/dss-navigation';
import {HR_SECTION_IDS,validateHrOperation} from '@/lib/hr-operation-model';
export const dynamic='force-dynamic';
const parse=(r:any)=>({...r,data:JSON.parse(r.data),history:JSON.parse(r.history)});
export async function GET(req:Request){try{
 const m=await member();if(!hrManagerAllowed(m))throw new HttpError(403,'인사 담당 계정에서만 확인할 수 있습니다.');
 const url=new URL(req.url),section=url.searchParams.get('section')||'';
 if(!HR_SECTION_IDS.includes(section as any))throw new HttpError(400,'인사 업무 분야를 확인해 주세요.');
 const cursor=Number(url.searchParams.get('before')||0);
 if(!Number.isSafeInteger(cursor)||cursor<0)throw new HttpError(400,'목록 위치를 확인해 주세요.');
 const limit=50;
 const rows=(await db().prepare("SELECT * FROM hr_entries WHERE kind='hr_operation' AND json_extract(data,'$.section')=? AND (?=0 OR id<?) ORDER BY id DESC LIMIT ?").bind(section,cursor,cursor,limit+1).all<any>()).results;
 const more=rows.length>limit,visible=rows.slice(0,limit);
 const summary=(await db().prepare("SELECT count(*) AS total, sum(CASE WHEN json_extract(data,'$.status')='완료' THEN 1 ELSE 0 END) AS done, sum(CASE WHEN json_extract(data,'$.status')='확인 대기' THEN 1 ELSE 0 END) AS pending FROM hr_entries WHERE kind='hr_operation' AND json_extract(data,'$.section')=?").bind(section).first<any>())||{total:0,done:0,pending:0};
 const draft=await db().prepare('SELECT data,updated_at FROM drafts WHERE id=?').bind(`hr-operation:${m.id}:${section}`).first<any>();
 return json({rows:visible.map(parse),nextCursor:more?visible.at(-1)?.id:null,summary:{total:summary.total||0,done:summary.done||0,pending:summary.pending||0},draft:draft?{...JSON.parse(draft.data),savedAt:draft.updated_at}:null});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();if(!hrManagerAllowed(m))throw new HttpError(403,'인사 담당 계정에서만 처리할 수 있습니다.');
 const raw=await req.text();if(raw.length>32000)throw new HttpError(413,'인사 기록이 너무 큽니다.');
 const body=JSON.parse(raw);
 if(body.action==='draft'){
  const section=body.section,draft=body.draft;
  if(!HR_SECTION_IDS.includes(section)||!draft||typeof draft!=='object'||draft.data?.section!==section||JSON.stringify(draft).length>16000)throw new HttpError(400,'임시 저장할 내용을 확인해 주세요.');
  const ts=now();await db().prepare('INSERT INTO drafts(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(`hr-operation:${m.id}:${section}`,JSON.stringify(draft),ts).run();
  return json({ok:true,savedAt:ts});
 }
 if(body.action==='clearDraft'){
  if(!HR_SECTION_IDS.includes(body.section))throw new HttpError(400,'인사 업무 분야를 확인해 주세요.');
  await db().prepare('DELETE FROM drafts WHERE id=?').bind(`hr-operation:${m.id}:${body.section}`).run();return json({ok:true});
 }
 const data=validateHrOperation(body.data);
 if(body.action==='create'){
  const requestId=body.requestId;
  if(typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw new HttpError(400,'기록 식별번호를 확인해 주세요.');
  const existing=await db().prepare("SELECT id,version FROM hr_entries WHERE kind='hr_operation' AND source_id=?").bind(requestId).first<any>();
  if(existing)return json({ok:true,id:existing.id,version:existing.version,alreadySaved:true});
  const ts=now(),history=[{at:ts,actor:m.id,action:'등록',after:data}];
  const result=await db().prepare("INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) VALUES('hr_operation',?,?,?,?,?,?) ON CONFLICT(kind,source_id) DO NOTHING").bind(requestId,data.subject||'공통',JSON.stringify(data),JSON.stringify(history),ts,ts).run();
  if(!result.meta.changes){const row=await db().prepare("SELECT id,version FROM hr_entries WHERE kind='hr_operation' AND source_id=?").bind(requestId).first<any>();return json({ok:true,id:row?.id,version:row?.version,alreadySaved:true})}
  return json({ok:true,id:result.meta.last_row_id,version:1},201);
 }
 if(body.action==='update'){
  const id=Number(body.id),version=Number(body.version);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(version)||version<1)throw new HttpError(400,'기록과 버전을 확인해 주세요.');
  const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='hr_operation' AND id=?").bind(id).first<any>();
  if(!old)throw new HttpError(404,'인사 기록을 찾지 못했습니다.');
  if(old.version!==version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 확인해 주세요.');
  const before=JSON.parse(old.data);if(before.section!==data.section)throw new HttpError(400,'기록의 업무 분야는 변경할 수 없습니다.');
  const ts=now(),history=[...JSON.parse(old.history),{at:ts,actor:m.id,action:'수정',before,after:data}];
  const result=await db().prepare("UPDATE hr_entries SET person=?,data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(data.subject||'공통',JSON.stringify(data),JSON.stringify(history),ts,id,version).run();
  if(!result.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 확인해 주세요.');
  return json({ok:true,id,version:version+1});
 }
 throw new HttpError(400,'처리할 작업을 확인해 주세요.');
 }catch(e){return fail(e)}}
