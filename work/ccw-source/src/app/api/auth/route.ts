import {workspaceVersion} from '@/lib/workspace-version';
import {env} from '@/lib/runtime';
import {db,member,owner,origin,json,fail,HttpError,now} from '@/lib/server';
import {digest,passwordHash,randomToken,equal,sessionCookie,SESSION_COOKIE} from '@/lib/local-auth';
import {STAFF} from '@/lib/work-orders';
import {assertText} from '@/lib/policy';
async function throttle(key:string,max=15){const bucket=Math.floor(Date.now()/900000);const r=await db().prepare("INSERT INTO settings(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) RETURNING value").bind(`auth-rate:${bucket}:${await digest(key)}`).first<any>();if(Number(r.value)>max)throw new HttpError(429,'시도 횟수가 많습니다. 15분 후 다시 시도해 주세요.')}
export async function GET(req:Request){try{if(new URL(req.url).searchParams.get('mode')==='setup'){const used=await db().prepare("SELECT value FROM settings WHERE key='local-auth-initialized'").first();return json({setupRequired:!used})}const m=await member(true);return json({member:{id:m.id,person:m.person,role:m.role,label:m.label,active:m.active,access:m.access,workspaceVersion:m.workspaceVersion,mustChangePassword:m.mustChangePassword}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{origin(req);const raw=await req.text();if(raw.length>6000)throw Error('입력이 너무 깁니다.');const b=JSON.parse(raw);
 if(b.action==='logout'){const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);if(token)await db().prepare('DELETE FROM settings WHERE key=?').bind('session:'+await digest(token)).run();return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie('',req,0),'Cache-Control':'no-store'}})}
 if(b.action==='changeCredentials'){
  const m=await member(true);await throttle('credential-change:'+m.id,10);
  const index=await db().prepare('SELECT value FROM settings WHERE key=?').bind('credential-member:'+m.id).first<any>();if(!index)throw Error('기존 계정을 확인할 수 없습니다.');
  const oldKey='credential:'+index.value;const old=await db().prepare('SELECT value FROM settings WHERE key=?').bind(oldKey).first<any>();if(!old)throw Error('기존 계정을 확인할 수 없습니다.');const previous=JSON.parse(old.value);
  const current=assertText(b.currentPassword,'현재 비밀번호',200,true);if(!equal(await passwordHash(current,previous.salt),previous.hash))throw new HttpError(403,'현재 비밀번호가 맞지 않습니다.');
  const username=m.role==='DO'&&b.username?assertText(b.username,'새 아이디',64,true).toLowerCase():index.value;if(!/^[a-z0-9._-]{3,64}$/.test(username))throw Error('아이디는 영문·숫자 3자 이상으로 입력해 주세요.');const password=assertText(b.password,'새 비밀번호',200,true);if(password.length<8)throw Error('비밀번호는 8자 이상으로 정해 주세요.');
  if(equal(password,current))throw Error('임시 비밀번호와 다른 새 비밀번호를 정해 주세요.');
  const salt=randomToken(),value=JSON.stringify({memberId:m.id,salt,hash:await passwordHash(password,salt)}),newKey='credential:'+username;
  const guard='EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?)';let out;
  try{out=await db().batch([
   db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(value,oldKey,old.value),
   db().prepare('UPDATE settings SET key=? WHERE key=? AND value=?').bind(newKey,oldKey,value),
   db().prepare('UPDATE settings SET value=? WHERE key=? AND '+guard).bind(username,'credential-member:'+m.id,newKey,value),
   db().prepare("DELETE FROM settings WHERE key LIKE 'session:%' AND json_extract(value,'$.memberId')=? AND "+guard).bind(m.id,newKey,value),
   db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT 0,'DSS',?,'자체 로그인 정보 변경',?,? WHERE "+guard).bind(m.id,JSON.stringify({memberId:m.id,username,sessionsRevoked:true}),now(),newKey,value)
  ])}catch{throw new HttpError(409,'다른 계정이 사용 중인 아이디이거나 변경이 겹쳤습니다. 다시 확인해 주세요.')}
  if(!out[0].meta.changes)throw new HttpError(409,'로그인 정보가 먼저 변경됐습니다. 다시 로그인해 주세요.');
  return Response.json({ok:true,reauthenticate:true},{headers:{'Set-Cookie':sessionCookie('',req,0),'Cache-Control':'no-store'}});
 }
 if(b.action==='provisionStaff'){
  const m=await member();owner(m);const results=[];
  for(const spec of STAFF){
   const old=await db().prepare('SELECT * FROM members WHERE person=?').bind(spec.person).first<any>();
   if(old&&(old.role==='DO'||old.active!==1))throw new HttpError(409,'기존 직원 상태를 먼저 확인해 주세요.');
   const id=old?.id||'local:'+crypto.randomUUID();const index=await db().prepare('SELECT value FROM settings WHERE key=?').bind('credential-member:'+id).first<any>();
   if(index){results.push({person:spec.person,username:index.value,status:'기존 계정 유지'});continue;}
   const salt=randomToken();const value=JSON.stringify({memberId:id,salt,hash:await passwordHash('1111',salt),mustChangePassword:true});
   const queries=[db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('credential:'+spec.username,value),db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('credential-member:'+id,spec.username)];
   if(!old)queries.push(db().prepare("INSERT INTO members(id,person,role,dss,label,active,created_at) VALUES (?,?,'staff',?,?,1,?)").bind(id,spec.person,spec.person==='kyunghwa'?1:0,spec.name,now()));
   queries.push(db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) VALUES (0,'DSS',?,'직원 계정 준비',?,?)").bind(m.id,JSON.stringify({person:spec.person,username:spec.username,mustChangePassword:true}),now()));
   try{await db().batch(queries)}catch{throw new HttpError(409,'동일 아이디 또는 직원 계정이 먼저 생성됐습니다. 다시 확인해 주세요.');}
   results.push({person:spec.person,username:spec.username,status:'임시 비밀번호 변경 필요'});
  }return json({ok:true,accounts:results});
 }
 if(!['login','create','bootstrap'].includes(b.action))throw Error('로그인 동작을 확인해 주세요.');
 const username=assertText(b.username,'아이디',64,true).toLowerCase();if(!/^[a-z0-9._-]{3,64}$/.test(username))throw Error('아이디는 영문·숫자 3자 이상으로 입력해 주세요.');const password=assertText(b.password,'비밀번호',200,true);
 if(b.action==='login'){
  await throttle(username);const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind('credential:'+username).first<any>();const credential=row?JSON.parse(row.value):{salt:'ccw-unregistered',hash:'0'.repeat(64)};const hash=await passwordHash(password,credential.salt);if(!row||!equal(hash,credential.hash))throw new HttpError(401,'아이디 또는 비밀번호를 확인해 주세요.');const m=await db().prepare('SELECT * FROM members WHERE id=? AND active=1').bind(credential.memberId).first<any>();if(!m)throw new HttpError(401,'사용이 중지된 계정입니다.');const token=randomToken();await db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('session:'+await digest(token),JSON.stringify({memberId:m.id,expiresAt:Date.now()+43200000})).run();return Response.json({ok:true,mustChangePassword:credential.mustChangePassword===true,member:{person:m.person,role:m.role,label:m.label,workspaceVersion:workspaceVersion(username,m.person)}},{headers:{'Set-Cookie':sessionCookie(token,req),'Cache-Control':'no-store'}});
 }
 if(password.length<12)throw Error('비밀번호는 12자 이상으로 정해 주세요.');
 let actor='initial-setup',person='do',label='송형석',role='DO',dss=1;
 if(b.action==='bootstrap'){
  await throttle('bootstrap',10);const configured=(env as any).CCW_BOOTSTRAP_SECRET_HASH;const supplied=typeof b.setupToken==='string'?b.setupToken:'';if(!configured||!equal(await digest(supplied),configured))throw new HttpError(403,'대표 초기 설정 키를 확인해 주세요.');const used=await db().prepare("SELECT value FROM settings WHERE key='local-auth-initialized'").first();if(used)throw new HttpError(409,'대표 계정 초기 설정이 끝났습니다.');
 }else{const m=await member();owner(m);actor=m.id;person=assertText(b.person,'배정 자리',60,true);if(!['kyunghwa','human-035f1152-71dc-42bc-972b-5f6ffbe3bf77','human-6d5d7680-9693-4df0-8aca-4389892bbe14','kimkiyoung'].includes(person))throw Error('실무자 자리를 선택해 주세요.');label=assertText(b.label,'직원 표시 이름',80,true);role='staff';dss=['kyunghwa','kimkiyoung'].includes(person)?1:0;}
 const old=await db().prepare('SELECT * FROM members WHERE person=?').bind(person).first<any>();const id=old?.id||'local:'+crypto.randomUUID();const salt=randomToken();const credential={memberId:id,salt,hash:await passwordHash(password,salt)};
 const statements=[db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('credential:'+username,JSON.stringify(credential))];
 // One credential per member prevents accidental duplicate identities or reactivating an offboarded account.
 statements.push(db().prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('credential-member:'+id,username));
 if(!old)statements.push(db().prepare('INSERT INTO members(id,person,role,dss,label,active,created_at) VALUES (?,?,?,?,?,1,?)').bind(id,person,role,dss,label,now()));else if(old.active!==1)throw Error('중지된 계정은 계정 관리에서 먼저 확인해 주세요.');
 if(b.action==='bootstrap'){statements.push(db().prepare("INSERT INTO settings(key,value) VALUES ('local-auth-initialized',?)").bind(now()));statements.push(db().prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('owner',?)").bind(id));}
 statements.push(db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) VALUES (0,'DSS',?,'자체 계정 등록',?,?)").bind(actor,JSON.stringify({memberId:id,person}),now()));
 try{await db().batch(statements)}catch{throw new HttpError(409,'이미 등록된 아이디 또는 자리입니다. 로그인 화면에서 확인해 주세요.')}
 return json({ok:true},201);
}catch(e){return fail(e)}}
