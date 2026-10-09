const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let sends=[],states={},writes=[],role='DO';
class HttpError extends Error{constructor(status,m){super(m);this.status=status}}
const json=(b,status=200)=>new Response(JSON.stringify(b),{status});
const deps={db:()=>({prepare:()=>({bind:(...args)=>({run:async()=>{writes.push(args);return {meta:{changes:1}}}})})}),member:async()=>({id:1,role}),owner:m=>{if(m.role!=='DO')throw new HttpError(403,'owner')},origin:()=>{},json,fail:e=>json({error:e.message},e.status||500),HttpError};
const handlers={GET:async req=>json(states[new URL(req.url).searchParams.get('hospital')]),POST:async req=>{const b=await req.json();sends.push(b);return json({result:{status:b.hospital==='planme'&&states.fail?'held':'result_received'}})}};
const src=ts.transpileModule(fs.readFileSync('app/api/ss-approval/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const box={exports:{},require:n=>n.includes('ss-dispatch')?handlers:deps,crypto:require('crypto').webcrypto,Request,Response,Headers,URL,Set,Date};vm.runInNewContext(src,box);
const date=new Date(Date.now()+9*3600000).toISOString().slice(0,10),req=(hospitals,dateOverride=date)=>new Request('https://x/api/ss-approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:dateOverride,hospitals,confirm:'선택 병원 검수완료 대상 일괄 발송'})});
const list=[{hospital:'floce',runHash:'a'},{hospital:'planme',runHash:'b'}];
(async()=>{
 states={floce:{ready:true,runHash:'a'},planme:{ready:false,runHash:'b',reason:'expired'}};assert.equal((await box.exports.POST(req(list))).status,409);assert.equal(sends.length,0);
 states.planme.ready=true;assert.equal((await box.exports.POST(req([{hospital:'floce',runHash:'changed'}]))).status,409);assert.equal(sends.length,0);
 states.floce.result={status:'sending'};assert.equal((await box.exports.POST(req(list))).status,409);assert.equal(sends.length,0);delete states.floce.result;
 assert.equal((await box.exports.POST(req([list[0],list[0]]))).status,400);assert.equal((await box.exports.POST(req(list,'2000-01-01'))).status,400);
 role='staff';assert.equal((await box.exports.POST(req(list))).status,403);role='DO';assert.equal(sends.length,0);
 const result=await(await box.exports.POST(req(list))).json();assert.equal(result.status,'requested');assert.equal(sends.length,2);assert.equal(sends[0].confirm,'검수완료 대상 발송');assert(writes.length>=3);
 sends=[];states.fail=true;const partial=await(await box.exports.POST(req([list[1],list[0]]))).json();assert.equal(partial.status,'needs_attention');assert.equal(sends.length,1);
 const view=await(await box.exports.GET(new Request('https://x'))).json();assert.equal(view.hospitals.length,4);assert.equal(view.hospitals[2].ready,false);
 states.floce={ready:false,runHash:'',total:0,reason:'제작 회차 없음'};
 const missing=await(await box.exports.GET(new Request('https://x'))).json();assert.equal(missing.hospitals[0].hasRun,false);assert.equal(missing.hospitals[0].total,null);
 states.floce={ready:false,runHash:'existing-run',total:0,reason:'대상 없음'};
 const empty=await(await box.exports.GET(new Request('https://x'))).json();assert.equal(empty.hospitals[0].hasRun,true);assert.equal(empty.hospitals[0].total,0);
 const statusbox={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/ss-week-state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,statusbox);const state=statusbox.exports.weekState;
 assert.equal(state({status:'result_received'}).label,'발송 요청 완료');assert.equal(state({ready:true}).label,'승인 요망 · 미발송');assert.equal(state({delivery:{accepted:30,delivered:29,pending:1,failed:0,unsent:0}}).label,'발송 결과 확인 중');assert.equal(state({delivery:{accepted:30,delivered:29,pending:0,failed:1,unsent:0}}).label,'발송 완료 · 실패 포함');
 console.log('PASS: approval preflight, owner, revision, duplicate, partial stop, journal and delivery labels. All dispatch calls mocked; actual SMS 0.');
})().catch(e=>{console.error(e);process.exit(1)});
