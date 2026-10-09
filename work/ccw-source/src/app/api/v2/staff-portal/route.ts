import {db,member,owner,origin,json,fail,HttpError,now} from '@/lib/server';
import {SERVICES,text,transitionAccount,type AccountEntry,type ServiceId} from '@/lib/service-accounts';
export const dynamic='force-dynamic';
async function actor(){const m=await member(true);if(m.mustChangePassword)throw new HttpError(428,'먼저 비밀번호를 변경해 주세요.');if(m.role!=='DO'&&m.workspaceVersion!=='v2')throw new HttpError(403,'버전 2에서 사용할 수 있습니다.');return m;}
export async function GET(){try{const m=await actor();const rows=await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'staff-service-account:%' OR key LIKE 'staff-notice:%'").all<any>();
 const accounts=rows.results.filter(r=>r.key.startsWith('staff-service-account:')).map(r=>JSON.parse(r.value) as AccountEntry).filter(a=>m.role==='DO'||a.memberId===m.id);
 const notices=rows.results.filter(r=>r.key.startsWith('staff-notice:')).map(r=>JSON.parse(r.value)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return json({isOwner:m.role==='DO',member:{id:m.id,name:m.label},accounts,notices});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{origin(req);const m=await actor();const raw=await req.text();if(raw.length>10000)throw Error('입력이 너무 깁니다.');const b=JSON.parse(raw);const ts=now();
 if(b.action==='publishNotice'){owner(m);const id=crypto.randomUUID();const value=JSON.stringify({id,title:text(b.title,'공지 제목',120,true),content:text(b.content,'공지 내용',3000,true),createdAt:ts,author:m.label});await db().batch([db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('staff-notice:'+id,value),db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) VALUES (0,'DSS',?,?,?,?)").bind(m.id,'직원 공지 등록',JSON.stringify({id}),ts)]);return json({ok:true});}
 if(b.action==='request'){
  if(!Object.hasOwn(SERVICES,b.service))throw Error('서비스를 선택해 주세요.');const service=b.service as ServiceId;const key='staff-service-account:'+m.id+':'+service;const previous=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();
  if(previous&&!['rejected','reclaimed'].includes(JSON.parse(previous.value).status))throw new HttpError(409,'이미 신청했거나 사용 중인 서비스입니다. 신청 현황을 확인해 주세요.');
  const entry:AccountEntry={id:key,memberId:m.id,person:m.person,name:m.label,service,purpose:text(b.purpose,'사용 목적',500,true),status:'requested',login:'',workspace:'',url:'',note:'',createdAt:ts,updatedAt:ts};
  const q=previous?db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(entry),key,previous.value):db().prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(key,JSON.stringify(entry));
  const out=await db().batch([q,db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT 0,'DSS',?,?,?,? WHERE changes()>0").bind(m.id,'서비스 계정 신청',JSON.stringify({id:key,service}),ts)]);if(!out[0].meta.changes)throw new HttpError(409,'이미 접수된 신청입니다.');return json({ok:true});
 }
 owner(m);const key=text(b.id,'신청 번호',200,true);if(!key.startsWith('staff-service-account:'))throw Error('신청을 확인해 주세요.');const previous=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();if(!previous)throw new HttpError(404,'신청을 찾을 수 없습니다.');const entry=JSON.parse(previous.value) as AccountEntry;
 if(entry.updatedAt!==b.updatedAt)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');const next=transitionAccount(entry,b.action,b);
 const out=await db().batch([db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(next),key,previous.value),db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT 0,'DSS',?,?,?,? WHERE changes()>0").bind(m.id,'서비스 계정 '+b.action,JSON.stringify({id:key,before:entry.status,after:next.status}),ts)]);if(!out[0].meta.changes)throw new HttpError(409,'변경이 겹쳤습니다. 새로고침해 주세요.');return json({ok:true});
}catch(e){return fail(e)}}
