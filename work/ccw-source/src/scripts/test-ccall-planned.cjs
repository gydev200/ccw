const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compiled=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const core={exports:{},Date,Set};vm.runInNewContext(compiled('lib/ccall.ts'),core);
const ref='a'.repeat(64),ref2='b'.repeat(64),pid='11111111-1111-4111-8111-111111111111';
let proof=true,refused=false,deny=false,created,updated,sentAt='',existing=null;const date='2026-09-18';
const run={date,hospital:'planme',rows:[{ref,rank:1,source:'기존 진료',lms:'발송 예정 문안'}]};
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async all(){if(sql.includes('settings'))return {results:[{key:'ss-production:planme:'+date,value:JSON.stringify(run)}]};return {results:existing?[{id:5,version:1,assignee:'kyunghwa',data:JSON.stringify(existing)}]:refused?[{id:6,version:1,assignee:'kyunghwa',data:JSON.stringify({hospital:'planme',ref,outcome:'연락 거절'})}]:[]}},async first(){if(sql.includes('records'))return {id:5,version:1,assignee:'kyunghwa',org:'SS',data:JSON.stringify(existing)};return args[0].endsWith(':review')?(proof?{value:JSON.stringify({payload:{patients:[{ref,patientId:pid}]}})}:null):{value:JSON.stringify(run)}}}}};
const HttpError=class extends Error{constructor(status,message){super(message);this.status=status}};
const server={db:()=>db,member:async()=>({person:'kyunghwa',role:'staff',access:{orgs:deny?['OS']:['SS']}}),origin:()=>{},json:(x,status=200)=>Response.json(x,{status}),fail:e=>Response.json({error:e.message},{status:e.status||400}),HttpError,createRecord:async(k,o,a,d)=>{created=d;return 5},updateRecord:async(r,d)=>{updated=d}};
const mod={exports:{}};vm.runInNewContext(compiled('app/api/ccall-sent/route.ts'),{exports:mod.exports,module:mod,Date,Set,URL,Response,Request,AbortSignal,require:n=>n==='cloudflare:workers'?{env:{SS_DISPATCH_TOKEN:'test'}}:n==='@/lib/server'?server:core.exports,fetch:async(u,o)=>{const b=JSON.parse(o.body);assert.equal(b.includePlanned,true);assert.deepEqual(b.patientIds,[pid]);return Response.json({hospital:'planme',checkedAt:'now',rows:[{patientId:pid,patientNumber:'10',name:'테스트',phone:'01000000000',callable:true,sentAt,sendStatus:sentAt?'발송 접수 완료':'발송 예정',message:'실제 발송 문안',holdReason:''}]})}});
const get=()=>mod.exports.GET(new Request('https://example.test/api/ccall-sent?date='+date));const post=()=>mod.exports.POST(new Request('https://example.test/api/ccall-sent',{method:'POST',body:JSON.stringify({hospital:'planme',date,ref,version:1,outcome:'연결 완료',callAt:'2026-09-18T00:00:00Z'})}));
(async()=>{
 let b=await(await get()).json();assert.equal(b.rows.length,1);assert.equal(b.rows[0].message,'발송 예정 문안');assert.equal(b.rows[0].sentAt,'');assert.equal(b.rounds.length,1);
 assert.equal((await post()).status,201);assert.equal(created.group,'before');assert.equal(created.sentAt,'');
 existing={...created,recording:{key:'existing-audio'},callAt:'2026-09-18T00:00:00Z'};sentAt='2026-09-18T00:30:00Z';
 assert.equal((await post()).status,409); // recording protection remains
 existing.recording=null;assert.equal((await post()).status,200);assert.equal(updated.group,'before');assert.equal(updated.sentAt,new Date(sentAt).toISOString());
 existing=null;refused=true;b=await(await get()).json();assert.equal(b.rows[0].phone,null);assert.equal(b.rows[0].callable,false);assert.equal((await post()).status,409);
 refused=false;proof=false;b=await(await get()).json();assert.equal(b.rows.length,1);assert.equal(b.rows[0].callable,false);assert.equal(b.rows[0].message,'발송 예정 문안');
 deny=true;assert.equal((await get()).status,403);
 console.log('예정 명단·발송 전 기록·발송 후 기존 기록·녹음 보호·연락거절·검수 전 목록·권한 검사 통과');
})().catch(e=>{console.error(e);process.exit(1)});
