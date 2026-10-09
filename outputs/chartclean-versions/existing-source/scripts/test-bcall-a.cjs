// Local-only API integration test. BCALL_TEST_PASSWORD is required; credentials are never stored.
const assert=require('node:assert/strict');
const base=process.env.BCALL_TEST_BASE||'http://localhost:5187';
const url=new URL(base);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.protocol!=='http:')throw Error('Local test server only');
const password=process.env.BCALL_TEST_PASSWORD;
if(!password)throw Error('Set BCALL_TEST_PASSWORD');
let passed=0;
async function login(username){const r=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({action:'login',username,password})});assert.equal(r.status,200,'local login');return r.headers.get('set-cookie').split(';')[0]}
async function get(cookie,path='/api/outreach'){const r=await fetch(base+path,{headers:{cookie}});assert.equal(r.status,200,path);return r.json()}
async function post(cookie,data){const state=await get(cookie);const r=await fetch(base+'/api/outreach',{method:'POST',headers:{cookie,Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({kind:'call',data,revision:state.revision,requestId:crypto.randomUUID()})});return {status:r.status,body:await r.json()}}
function pass(name){passed++;console.log('PASS '+name)}
(async()=>{
 const owner=await login(process.env.BCALL_TEST_OWNER||'qa-outreach');
 const os=await login(process.env.BCALL_TEST_OS||'qa-os');
 const state=await get(owner),trial=state.rows.find(r=>r.kind==='trial');
 assert.ok(trial,'An existing local A trial fixture is required');
 const beforeCustomer=state.customers.find(c=>c.sourceId===trial.data.hospitalId||'customer-'+c.id===trial.data.hospitalId);
 const a={hospitalId:trial.data.hospitalId,journey:'A',trialId:trial.id,issueId:0,bStep:'분석 결과 설명',outcome:'분석 결과 안내',reaction:'로컬 API 검증 · 실제 통화 아님',usedCopy:'로컬 검증용 안내문',reference:'로컬 A 진행 기록 연결 검증',doNotContact:'계속 소통',nextAction:'로컬 검사 완료'};
 const saved=await post(os,a);assert.equal(saved.status,200,JSON.stringify(saved.body));pass('OS 계정의 A 후속 B콜 API 저장');
 const after=await get(owner),record=after.rows.find(r=>r.id===saved.body.id);assert.ok(record);assert.equal(record.data.issueId,0);assert.equal(record.data.issueVersion,null);assert.equal(record.data.deliveryId,null);assert.equal(record.data.journey,'A');pass('소식지 회차·배포 기록이 붙지 않은 A콜 조회');
 assert.equal(record.org,'OS');assert.equal(record.data.trialId,trial.id);assert.equal(record.data.trialVersion,trial.version);assert.equal(record.data.trialStatus,trial.data.status);assert.equal(record.data.trialEvidence.resultUrl,trial.data.resultUrl||'');pass('A 진행 버전·상태·근거 저장 및 조회');
 const history=await get(owner,'/api/outreach?history='+saved.body.id);assert.ok(history.some(e=>JSON.parse(e.data).after?.trialId===trial.id));pass('통화 변경 이력에 연결 근거 보존');
 if(beforeCustomer){const customer=after.customers.find(c=>c.id===beforeCustomer.id);assert.equal(customer.stage,beforeCustomer.stage);pass('기존 고객 여정 단계 보존')}
 const badB=await post(os,{...a,journey:'B',trialId:0,bStep:'일반 연락'});assert.ok(badB.status>=400);assert.match(badB.body.error,/소식지/);pass('기존 B콜의 회차 누락 차단');
 const issue=state.rows.find(r=>r.kind==='issue');assert.ok(issue,'local issue fixture');
 const wrongIssue=await post(os,{...a,issueId:issue.id});assert.ok(wrongIssue.status>=400);pass('A콜에 소식지 회차 혼합 차단');
 const wrongTrial=await post(os,{...a,trialId:99999});assert.ok(wrongTrial.status>=400);assert.match(wrongTrial.body.error,/A 진행 기록/);pass('없는 A 기록 참조 차단');
 const badPurpose=await post(os,{...a,bStep:'EMR 요청'});assert.ok(badPurpose.status>=400);pass('A콜 목적과 B콜 목적 혼합 차단');
 const afterFailures=await get(owner);assert.equal(afterFailures.revision,after.revision);pass('거절된 요청은 원장·revision을 변경하지 않음');
 console.log(`${passed} integration checks passed; local record ${saved.body.id}; no dispatch or production requests`);
})().catch(e=>{console.error(e.message);process.exitCode=1});
