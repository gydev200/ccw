const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');const {DatabaseSync}=require('node:sqlite');const {AsyncLocalStorage}=require('node:async_hooks');const root=process.cwd(),ctx=new AsyncLocalStorage(),sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE members(id TEXT PRIMARY KEY,person TEXT UNIQUE,role TEXT,dss INTEGER,label TEXT,active INTEGER,created_at TEXT); CREATE TABLE records(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,org TEXT,assignee TEXT,data TEXT,version INTEGER DEFAULT 1,dedup TEXT UNIQUE,created_at TEXT,updated_at TEXT);CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_id INTEGER,org TEXT,actor TEXT,action TEXT,data TEXT,created_at TEXT);CREATE TABLE control_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,person TEXT,org TEXT,data TEXT,history TEXT DEFAULT '[]',version INTEGER DEFAULT 1,dedup TEXT UNIQUE,created_at TEXT,updated_at TEXT); CREATE TABLE files(id TEXT,record_id INTEGER,name TEXT,type TEXT,size INTEGER,created_at TEXT);CREATE TABLE times(id INTEGER,record_id INTEGER,person TEXT,org TEXT);CREATE TABLE drafts(id TEXT,data TEXT);`);
function prepare(q,args=[]){return {bind(...v){return prepare(q,v)},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}}}
const env={DB:{prepare,async batch(ss){sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}}};const cache={};function load(file){file=path.resolve(root,file);if(!path.extname(file))file+='.ts';if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=(n)=>n==='cloudflare:workers'?{env}:n==='next/headers'?{headers:async()=>ctx.getStore().headers}:n.startsWith('@/')?load(n.slice(2)):n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n);vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,mod,mod.exports);return mod.exports}
sql.exec("CREATE TABLE hr_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,source_id TEXT,person TEXT,data TEXT,history TEXT DEFAULT '[]',version INTEGER DEFAULT 1,created_at TEXT,updated_at TEXT,UNIQUE(kind,source_id));");
const orders=load('app/api/work-orders/route.ts');
const auth=load('app/api/auth/route.ts'),mentor=load('app/api/mentor/route.ts'),control=load('app/api/control/route.ts'),map=load('app/api/management-map/route.ts'),commands=load('app/api/management-map/commands/route.ts'),erp=load('app/api/erp/route.ts');const checks=[];function check(label,fn){fn();checks.push(label)}
async function call(route,method='GET',body,cookie=''){if(body&&['question','submit'].includes(body.action)&&!body.requestId)body.requestId=crypto.randomUUID();const req=new Request('http://localhost/api/test',{method,headers:{origin:'http://localhost',cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return ctx.run({headers:req.headers},async()=>{const res=await route[method](req);return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}})}


(async()=>{
 const staff=load('lib/work-orders.ts').STAFF;
 env.CCW_BOOTSTRAP_SECRET_HASH=await load('lib/local-auth.ts').digest('test-setup');await call(auth,'POST',{action:'bootstrap',username:'owner',password:'owner-password-123',setupToken:'test-setup'});
 const dc=(await call(auth,'POST',{action:'login',username:'owner',password:'owner-password-123'})).cookie;
 let r=await call(orders);check('비로그인 업무 목록 차단',()=>assert.equal(r.status,401));
 r=await call(auth,'POST',{action:'provisionStaff'},dc);check('직원 3명 계정 생성',()=>assert.equal(r.data.accounts.length,3));
 const original=sql.prepare("SELECT value FROM settings WHERE key='credential:ccw32'").get().value;
 r=await call(auth,'POST',{action:'provisionStaff'},dc);check('반복 생성시 비밀번호 보존',()=>assert.equal(sql.prepare("SELECT value FROM settings WHERE key='credential:ccw32'").get().value,original));
 const cookies=[];
 for(const spec of staff){
  r=await call(auth,'POST',{action:'login',username:spec.username.toUpperCase(),password:'1111'});check(spec.username+' 임시 로그인',()=>assert.equal(r.data.mustChangePassword,true));const temp=r.cookie;
  r=await call(orders,'GET',null,temp);check(spec.username+' 변경전 업무 차단',()=>assert.equal(r.status,428));
  r=await call(erp,'GET',null,temp);check(spec.username+' 기존 ERP 우회 차단',()=>assert.equal(r.status,428));
  r=await call(auth,'POST',{action:'changeCredentials',password:'1111',currentPassword:'1111'},temp);check(spec.username+' 짧은 암호 거부',()=>assert.equal(r.status,400));
  r=await call(auth,'POST',{action:'changeCredentials',password:'changed-password-'+spec.username,currentPassword:'1111'},temp);check(spec.username+' 본인 비밀번호 변경',()=>assert.equal(r.status,200));
  r=await call(orders,'GET',null,temp);check(spec.username+' 이전 세션 폐기',()=>assert.equal(r.status,401));
  r=await call(auth,'POST',{action:'login',username:spec.username,password:'1111'});check(spec.username+' 임시암호 재사용 차단',()=>assert.equal(r.status,401));
  r=await call(auth,'POST',{action:'login',username:spec.username,password:'changed-password-'+spec.username});cookies.push(r.cookie);
 }
 r=await call(auth,'POST',{action:'provisionStaff'},cookies[0]);check('직원 계정 생성 권한 차단',()=>assert.equal(r.status,403));
 r=await call(orders,'POST',{action:'seed'},dc);check('오늘 업무 9건 수합',()=>assert.equal(r.data.created,9));
 r=await call(orders,'POST',{action:'seed'},dc);check('업무 중복 등록 방지',()=>assert.equal(r.data.created,0));
 const assigned=[];
 for(let i=0;i<3;i++){
  r=await call(orders,'GET',null,cookies[i]);assigned.push(r.data.orders);check(staff[i].username+' 본인 업무만 조회',()=>assert(r.data.orders.every(x=>x.assignee===staff[i].person)));
  check(staff[i].username+' DO 비노출',()=>assert(r.data.orders.every(x=>x.org!=='DO')));
  if(i)check(staff[i].username+' DSS 비노출',()=>assert(r.data.orders.every(x=>x.org!=='DSS')));
 }
 const goOrder=assigned[0].find(x=>x.org==='DSS');
 r=await call(orders,'POST',{action:'status',id:goOrder.id,version:goOrder.version,status:'진행 중'},cookies[1]);check('다른 직원 업무 직접 접근 거부',()=>assert.equal(r.status,404));
 r=await call(orders,'POST',{action:'report',id:goOrder.id,version:goOrder.version,date:'2026-09-16',result:'합성 결과',evidence:'합성 근거',next:'다음 검수',minutes:15},cookies[0]);check('결과·일지 함께 저장',()=>assert(r.data.logSaved));
 let log=sql.prepare("SELECT * FROM hr_entries WHERE kind='academy_log'").get();check('본인 일지에 지시 번호 연결',()=>assert.equal(JSON.parse(log.data).workOrderId,goOrder.id));
 r=await call(orders,'POST',{action:'report',id:goOrder.id,version:goOrder.version,date:'2026-09-16',result:'stale',evidence:'fake',next:'fake',minutes:5},cookies[0]);check('오래된 버전 저장 거부',()=>assert.equal(r.status,409));check('충돌시 일지 보존',()=>assert.equal(JSON.parse(sql.prepare("SELECT data FROM hr_entries").get().data).result,'합성 결과'));
 r=await call(orders,'POST',{action:'review',id:goOrder.id,version:goOrder.version+1,status:'완료',note:'검증'},cookies[0]);check('직원 자기 완료 승인 차단',()=>assert.equal(r.status,403));
 r=await call(orders,'POST',{action:'review',id:goOrder.id,version:goOrder.version+1,status:'완료',note:'검증'},dc);check('DO 결과 확인 완료',()=>assert.equal(r.status,200));
 const kimOrder=assigned[1][0];r=await call(orders,'POST',{action:'question',id:kimOrder.id,version:kimOrder.version,question:'합성 질문'},cookies[1]);check('본인 상사 질문 접수',()=>assert.equal(r.status,200));
 const before=sql.prepare('SELECT * FROM records WHERE id=?').get(kimOrder.id);const body={...JSON.parse(before.data),assignee:staff[2].person};
 r=await call(orders,'POST',{action:'edit',id:kimOrder.id,version:before.version,data:body,handoff:'진행 범위·다음 행동'},dc);check('부서 유지 담당 인계',()=>assert.equal(r.status,200));
 const after=sql.prepare('SELECT * FROM records WHERE id=?').get(kimOrder.id);check('인계 후 부서 고정·개인 질문 분리',()=>{assert.equal(after.org,before.org);assert.equal(JSON.parse(after.data).questions.length,0)});
 r=await call(orders,'POST',{action:'edit',id:kimOrder.id,version:after.version,data:{...body,org:'CA'},handoff:'이동'},dc);check('기록 부서 이동 거부',()=>assert.equal(r.status,400));
 const access=load('lib/work-orders.ts').defaultAccess(staff[1].person);r=await call(orders,'POST',{action:'access',person:staff[1].person,access:{...access,orgs:['DO']}},dc);check('DO 직원 권한 확대 차단',()=>assert.equal(r.status,400));
 r=await call(orders,'POST',{action:'access',person:staff[1].person,access:{...access,orgs:['DSS']}},dc);check('김경아 DSS 허용 차단',()=>assert.equal(r.status,400));
 r=await call(orders,'POST',{action:'access',person:staff[1].person,access:{...access,orgs:['CA'],weekdays:[1,3,5],scheduleConfirmed:true}},dc);check('근무요일·화면권한 저장',()=>assert.equal(r.status,200));
 r=await call(orders,'GET',null,cookies[1]);check('허용 외 부서 업무 비노출',()=>assert.equal(r.data.orders.length,0));
 r=await call(erp,'GET',null,cookies[1]);check('기존 ERP도 설정 권한 적용',()=>assert.deepEqual(r.data.orgs.map(x=>x.id),['CA']));
 const secretTask={org:'DSS',assignee:'kyunghwa',kind:'task',data:JSON.stringify({title:'비공개 경영 자료'})};check('고경화 DSS 내부자료 접근 차단',()=>assert.equal(load('lib/policy.ts').mayRecord({role:'staff',person:'kyunghwa',active:1,dss:1},secretTask),false));
 check('비밀번호 감사 기록 미포함',()=>assert(!JSON.stringify(sql.prepare('SELECT * FROM events').all()).includes('changed-password')));
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
