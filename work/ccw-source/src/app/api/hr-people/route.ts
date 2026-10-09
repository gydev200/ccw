import {db,member,json,fail,origin,now,HttpError} from '@/lib/server';
import {hrManagerAllowed} from '@/lib/dss-navigation';
import {validateHrPerson} from '@/lib/hr-person-model';
export const dynamic='force-dynamic';
async function access(){const m=await member();if(!hrManagerAllowed(m))throw new HttpError(403,'인사 담당 계정에서만 확인할 수 있습니다.');return m}
export async function GET(req:Request){try{
 const m=await access(),url=new URL(req.url),id=Number(url.searchParams.get('id')||0);
 if(id){if(!Number.isSafeInteger(id)||id<1)throw new HttpError(400,'직원 기록을 확인해 주세요.');const row=await db().prepare("SELECT * FROM hr_entries WHERE kind='hr_person' AND id=?").bind(id).first<any>();if(!row)throw new HttpError(404,'직원 기록을 찾지 못했습니다.');return json({row:{...row,data:JSON.parse(row.data),history:JSON.parse(row.history)}})}
 const rows=(await db().prepare("SELECT id,source_id,person,data,history,version,created_at,updated_at FROM hr_entries WHERE kind='hr_person' ORDER BY source_id LIMIT 500").all<any>()).results.map(r=>({...r,data:JSON.parse(r.data),history:JSON.parse(r.history)}));
 const draft=await db().prepare('SELECT data,updated_at FROM drafts WHERE id=?').bind(`hr-person:${m.id}`).first<any>();
 return json({rows,draft:draft?{...JSON.parse(draft.data),savedAt:draft.updated_at}:null});
 }catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await access(),raw=await req.text();if(raw.length>16000)throw new HttpError(413,'직원 기록이 너무 큽니다.');const body=JSON.parse(raw);
 if(body.action==='draft'){
  const draft=body.draft;if(!draft||typeof draft!=='object'||JSON.stringify(draft).length>12000)throw new HttpError(400,'작성 중인 내용을 확인해 주세요.');const ts=now();await db().prepare('INSERT INTO drafts(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(`hr-person:${m.id}`,JSON.stringify(draft),ts).run();return json({ok:true,savedAt:ts});
 }
 if(body.action==='clearDraft'){await db().prepare('DELETE FROM drafts WHERE id=?').bind(`hr-person:${m.id}`).run();return json({ok:true})}
 const data=validateHrPerson(body.data),ts=now();
 if(body.action==='create'){
  const existing=await db().prepare("SELECT id FROM hr_entries WHERE kind='hr_person' AND source_id=?").bind(data.employeeNo).first<any>();if(existing)throw new HttpError(409,'이미 등록된 사원번호입니다. 기존 기록을 열어 주세요.');
  const result=await db().prepare("INSERT INTO hr_entries(kind,source_id,person,data,history,created_at,updated_at) VALUES('hr_person',?,?,?,?,?,?) ON CONFLICT(kind,source_id) DO NOTHING").bind(data.employeeNo,data.employeeNo,JSON.stringify(data),JSON.stringify([{at:ts,actor:m.id,action:'등록',after:data}]),ts,ts).run();if(!result.meta.changes)throw new HttpError(409,'같은 사원번호가 먼저 등록됐습니다.');return json({ok:true,id:result.meta.last_row_id},201);
 }
 if(body.action==='update'){
  const id=Number(body.id),version=Number(body.version);if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(version)||version<1)throw new HttpError(400,'직원 기록과 버전을 확인해 주세요.');
  const old=await db().prepare("SELECT * FROM hr_entries WHERE kind='hr_person' AND id=?").bind(id).first<any>();if(!old)throw new HttpError(404,'직원 기록을 찾지 못했습니다.');if(old.version!==version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다.');if(old.source_id!==data.employeeNo)throw new HttpError(400,'사원번호는 변경할 수 없습니다.');
  const before=JSON.parse(old.data),history=[...JSON.parse(old.history),{at:ts,actor:m.id,action:'수정',before,after:data}];
  const result=await db().prepare('UPDATE hr_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),JSON.stringify(history),ts,id,version).run();if(!result.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다.');return json({ok:true,id,version:version+1});
 }
 throw new HttpError(400,'처리할 작업을 확인해 주세요.');
 }catch(e){return fail(e)}}
