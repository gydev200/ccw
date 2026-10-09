const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');const {DatabaseSync}=require('node:sqlite');const {AsyncLocalStorage}=require('node:async_hooks');const root=process.cwd(),ctx=new AsyncLocalStorage(),sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE members(id TEXT PRIMARY KEY,person TEXT UNIQUE,role TEXT,dss INTEGER,label TEXT,active INTEGER,created_at TEXT); CREATE TABLE records(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,org TEXT,assignee TEXT,data TEXT,version INTEGER DEFAULT 1,dedup TEXT UNIQUE,created_at TEXT,updated_at TEXT);CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_id INTEGER,org TEXT,actor TEXT,action TEXT,data TEXT,created_at TEXT);CREATE TABLE control_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,person TEXT,org TEXT,data TEXT,history TEXT DEFAULT '[]',version INTEGER DEFAULT 1,dedup TEXT UNIQUE,created_at TEXT,updated_at TEXT); CREATE TABLE files(id TEXT,record_id INTEGER,name TEXT,type TEXT,size INTEGER,created_at TEXT);CREATE TABLE times(id INTEGER,record_id INTEGER,person TEXT,org TEXT);CREATE TABLE drafts(id TEXT,data TEXT);`);
function prepare(q,args=[]){return {bind(...v){return prepare(q,v)},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}}}
const env={DB:{prepare,async batch(ss){sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}}};const cache={};function load(file){file=path.resolve(root,file);if(!path.extname(file))file+='.ts';if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const req=(n)=>n==='cloudflare:workers'?{env}:n==='next/headers'?{headers:async()=>ctx.getStore().headers}:n.startsWith('@/')?load(n.slice(2)):n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n);vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename:file})(req,mod,mod.exports);return mod.exports}

sql.exec(`CREATE TABLE hr_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,source_id TEXT NOT NULL,person TEXT NOT NULL,data TEXT NOT NULL,history TEXT NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(kind,source_id));`);
sql.exec(fs.readFileSync('drizzle/0005_preserve_exam_answers.sql','utf8'));
const auth=load('app/api/auth/route.ts'),academy=load('app/api/academy/route.ts'),bank=load('lib/academy-questions.server.json'),model=load('lib/academy-model.ts');const checks=[];
function check(label,fn){fn();checks.push(label)}
async function call(route,method='GET',body,cookie='',origin='http://localhost'){const req=new Request('http://localhost/api/academy',{method,headers:{origin,cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return ctx.run({headers:req.headers},async()=>{const res=await route[method](req);return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}})}
(async()=>{
 env.CCW_BOOTSTRAP_SECRET_HASH=await load('lib/local-auth.ts').digest('synthetic-setup-only');let r=await call(auth,'POST',{action:'bootstrap',username:'test-do',password:'synthetic-password-DO',setupToken:'synthetic-setup-only'});assert.equal(r.status,201);const dc=(await call(auth,'POST',{action:'login',username:'test-do',password:'synthetic-password-DO'})).cookie;
 const p='human-6d5d7680-9693-4df0-8aca-4389892bbe14',other='kyunghwa',cookies={};for(const [i,person] of [p,other].entries()){r=await call(auth,'POST',{action:'create',username:'test-worker-'+i,password:'synthetic-password-worker',label:'가상 검증자 '+i,person},dc);assert.equal(r.status,201);cookies[person]=(await call(auth,'POST',{action:'login',username:'test-worker-'+i,password:'synthetic-password-worker'})).cookie}const wc=cookies[p],oc=cookies[other];
 check('비로그인 차단',()=>{});assert.equal((await call(academy)).status,401);
 r=await call(academy,'POST',{action:'assign',person:p,track:'focused',date:'2026-09-16',round:1},wc);check('직원의 배정 권한 차단',()=>assert.equal(r.status,403));
 r=await call(academy,'POST',{action:'assign',person:p,track:'focused',date:'2026-09-16',round:1},dc);assert.equal(r.status,201,JSON.stringify(r));const a=r.data;
 r=await call(academy,'POST',{action:'assign',person:p,track:'focused',date:'2026-09-16',round:1},dc);check('동일 회차 중복 배정 차단',()=>assert.equal(r.status,409));
 r=await call(academy,'POST',{action:'start',id:a.id},dc);check('관리자의 직원 대리응시 차단',()=>assert.equal(r.status,403));
 r=await call(academy,'POST',{action:'start',id:a.id},oc);check('타인 시험 접근 차단',()=>assert.equal(r.status,404));
 let exam=(await call(academy,'POST',{action:'start',id:a.id},wc)).data;check('집중과정 140문항 및 정답 미노출',()=>{assert.equal(exam.data.questions.length,140);assert.ok(exam.data.questions.every(q=>q.answer===undefined&&q.model===undefined&&q.criteria===undefined));assert.ok(!JSON.stringify(exam.history).includes('"answer":'))});
 r=await call(academy,'POST',{action:'start',id:a.id},wc);check('중복 시작은 동일 응시 유지',()=>assert.equal(r.data.id,exam.id));
 const answers=Object.fromEntries(bank.filter(q=>a.data.modules.includes(q.module)).map(q=>[q.id,q.type==='choice'?q.answer:'원문·완료 기준을 대조하고 근거와 담당·기한을 기록합니다.']));
 r=await call(academy,'POST',{action:'draft',id:exam.id,version:exam.version,answers:{'company-1':2}},wc);assert.equal(r.status,200);const stale=exam;exam=r.data;
 r=await call(academy,'POST',{action:'draft',id:exam.id,version:stale.version,answers},wc);check('오래된 답안 덮어쓰기 차단',()=>assert.equal(r.status,409));
 r=await call(academy,'GET',null,wc);check('다시 접속해 임시 답안 복구',()=>assert.equal(r.data.rows.find(x=>x.id===exam.id).data.answers['company-1'],2));
 r=await call(academy,'POST',{action:'submit',id:exam.id,version:exam.version,answers:{'company-1':2}},wc);check('미답변 제출 차단',()=>assert.equal(r.status,400));
 r=await call(academy,'POST',{action:'submit',id:exam.id,version:exam.version,answers},wc);assert.equal(r.status,200,JSON.stringify(r));exam=r.data;check('객관식 서버 채점·주관식 미평가 유지',()=>{assert.equal(exam.data.date,new Date(Date.now()+9*3600000).toISOString().slice(0,10));assert.equal(exam.data.scheduledDate,'2026-09-16');assert.ok(exam.data.summary.every(s=>s.objective===28&&s.pending&&s.earned===null));assert.equal(exam.data.status,'채점 대기')});
 r=await call(academy,'POST',{action:'draft',id:exam.id,version:exam.version,answers},wc);check('제출 후 답안 변경 차단',()=>assert.equal(r.status,400));
 const marks=Object.fromEntries(bank.filter(q=>q.type==='written'&&a.data.modules.includes(q.module)).map(q=>[q.id,{score:3,note:'합성 답안에서 근거·인계는 확인, 상황별 예외는 보완 필요.'}]));
 r=await call(academy,'POST',{action:'mark',id:exam.id,version:exam.version,marks,note:'검증용 평가'},wc);check('자가 채점 확정 차단',()=>assert.equal(r.status,403));
 r=await call(academy,'POST',{action:'mark',id:exam.id,version:exam.version,marks:{},note:'검증'},dc);check('주관식 채점 누락 차단',()=>assert.equal(r.status,400));
 r=await call(academy,'POST',{action:'mark',id:exam.id,version:exam.version,marks,note:'상황별 예외 대응을 해당 교육에서 다시 확인해 주세요.'},dc);assert.equal(r.status,200);exam=r.data;
 r=await call(academy,'GET',null,wc);check('확정 점수와 채점근거 본인 열람',()=>{const e=r.data.rows.find(x=>x.id===exam.id);assert.equal(e.data.status,'평가 완료');assert.ok(e.data.summary.every(s=>s.earned===46));assert.ok(e.data.questions[0].explanation)});
 r=await call(academy,'GET',null,oc);check('다른 직원 고과·답안 목록 격리',()=>assert.ok(r.data.rows.every(x=>x.person===other)));
 r=await call(academy,'POST',{action:'assign',person:other,track:'all',date:'2026-09-16',round:1},dc);const full=(await call(academy,'POST',{action:'start',id:r.data.id},oc)).data;check('전체과정 DSS 포함 180문항',()=>{assert.equal(full.data.questions.length,180);assert.equal(full.data.questions.filter(q=>q.module==='DSS').length,20)});
 r=await call(academy,'POST',{action:'metric',person:p,org:'PPM',start:'2026-09-01',end:'2026-09-30',target:90,reason:'합성 목표, 정본 대조 건수'},dc);assert.equal(r.status,201);const metric=r.data;
 const log={action:'log',date:'2026-09-16',org:'PPM',title:'합성 안내문 수정',taskRef:'가상 업무 A',result:'승인 원문과 대조',evidence:'가상 결과 A 2쪽',next:'다음 담당 확인 · 9/17',minutes:40,waitingMinutes:15,requestId:'synthetic-log-1',observations:[{metricId:metric.id,numerator:2,denominator:3,evidence:'검수 대상 3건 중 2건 확인'}]};
 r=await call(academy,'POST',{...log,observations:[{...log.observations[0],numerator:4}]},wc);check('지표 분자·분모 오류 차단',()=>assert.equal(r.status,400));
 r=await call(academy,'POST',log,wc);assert.equal(r.status,201,JSON.stringify(r));let l=r.data;
 r=await call(academy,'POST',log,wc);check('중복 일지 저장 방지',()=>assert.equal(r.status,409));
 r=await call(academy,'POST',{action:'feedback',id:l.id,version:l.version,status:'확인 완료',note:'검증',next:'후속'},oc);check('타인 일지 피드백 차단',()=>assert.equal(r.status,403));
 r=await call(academy,'POST',{action:'feedback',id:l.id,version:l.version,status:'보완 요청',note:'날짜 대조 근거 추가',next:'9/17까지 반영'},dc);assert.equal(r.status,200);l=r.data;
 r=await call(academy,'POST',{...log,id:l.id,version:l.version,result:'날짜 근거도 추가'},wc);assert.equal(r.status,200);l=r.data;check('재제출 원문 보존·이전 판정 해제',()=>{assert.equal(l.data.review,null);assert.equal(l.history.length,3);assert.equal(l.history[0].after.result,'승인 원문과 대조')});
 r=await call(academy,'POST',{action:'feedback',id:l.id,version:l.version,status:'확인 완료',note:'원자료 대조 완료',next:'다음 과제 독립 수행'},dc);assert.equal(r.status,200);l=r.data;
 const ratings=Object.fromEntries(model.REVIEW_DIMENSIONS.map(k=>[k,{score:3,note:'합성 제출 결과 근거 대조'}]));
 const review={action:'review',person:p,period:'weekly',date:'2026-09-16',refs:[{id:l.id,version:l.version},{id:exam.id,version:exam.version}],ratings,note:'검증용 주간 평가',next:'SS 예외 처리 복습 · 본인 · 9/18'};
 r=await call(academy,'POST',{...review,refs:[{id:l.id,version:l.version-1}]},dc);check('바뀐 근거로 고과 확정 차단',()=>assert.equal(r.status,409));
 r=await call(academy,'POST',review,dc);assert.equal(r.status,201,JSON.stringify(r));const reviewRow=r.data;check('주간 월요일~일요일 계산·평가근거 보존',()=>{assert.equal(reviewRow.data.start,'2026-09-14');assert.equal(reviewRow.data.end,'2026-09-20');assert.equal(reviewRow.data.refs[0].snapshot.result,'날짜 근거도 추가')});
 r=await call(academy,'POST',{...review,period:'monthly'},dc);check('월간 고과 생성',()=>{assert.equal(r.status,201);assert.equal(r.data.data.start,'2026-09-01');assert.equal(r.data.data.end,'2026-09-30')});
 r=await call(academy,'POST',{...review,period:'daily',refs:[{id:l.id,version:l.version}]},dc);check('일일 고과 생성',()=>assert.equal(r.status,201));
 r=await call(academy,'POST',{...review,period:'monthly',date:'2026-10-01'},dc);check('기간 밖 평가 근거 차단',()=>assert.equal(r.status,400));
 r=await call(academy,'POST',{action:'progress',module:'DSS'},wc);check('DSS 원칙 학습 기록·실제 자료권한 분리',()=>assert.equal(r.status,201));
 r=await call(academy,'POST',{action:'progress',module:'DSS'},wc,'https://evil.example');check('외부 출처 요청 차단',()=>assert.equal(r.status,403));

 r=await call(academy,'POST',{action:'assign',person:p,track:'focused',date:'2026-09-07',round:1},dc);assert.equal(r.status,201);let late=(await call(academy,'POST',{action:'start',id:r.data.id},wc)).data;
 late=(await call(academy,'POST',{action:'submit',id:late.id,version:late.version,answers},wc)).data;
 check('예정일과 다른 주 제출일 별도 기록',()=>{assert.equal(late.data.scheduledDate,'2026-09-07');assert.equal(late.data.date,new Date(Date.now()+9*3600000).toISOString().slice(0,10));});
 late=(await call(academy,'POST',{action:'mark',id:late.id,version:late.version,marks,note:'지연 응시 합성 평가'},dc)).data;
 r=await call(academy,'POST',{...review,date:'2026-09-07',refs:[{id:late.id,version:late.version}]},dc);check('실제 제출 주 밖 시험 고과 차단',()=>assert.equal(r.status,400));
 r=await call(academy,'POST',{...review,id:reviewRow.id,version:reviewRow.version,date:late.data.date,refs:[{id:late.id,version:late.version}]},dc);check('실제 제출 주에 시험 근거 연결',()=>assert.equal(r.status,200));
 check('윤년·월 경계 기간 계산',()=>{assert.equal(model.periodRange('monthly','2028-02-12').end,'2028-02-29');assert.equal(model.periodRange('weekly','2026-11-01').start,'2026-10-26');assert.throws(()=>model.periodRange('daily','2026-02-30'))});

 fs.mkdirSync('work',{recursive:true});
 const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
 const dump=[];
 for(const t of ['settings','members','hr_entries'])for(const row of sql.prepare('SELECT * FROM '+t).all()){if(t==='hr_entries'){row.history='[]';}dump.push('INSERT OR REPLACE INTO '+t+'('+Object.keys(row).join(',')+') VALUES('+Object.values(row).map(quote).join(',')+');');}
 fs.writeFileSync('work/synthetic-seed.sql',dump.join('\n'));
 fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/academy-test-results.json',JSON.stringify({at:new Date().toISOString(),syntheticOnly:true,passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
