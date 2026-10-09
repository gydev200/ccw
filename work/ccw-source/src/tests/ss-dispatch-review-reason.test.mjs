import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/api/ss-dispatch/route.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function response(review){
 const date=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const run={hospital:'planme',date,rows:[{ref:'test'}]};
 const db = {prepare: () => ({bind: key => ({first: async () => {
   if (key === 'ss-production:planme:' + date) return {value: JSON.stringify(run)};
   if (key === 'ss-policy:planme:5') return {value: JSON.stringify({criteriaVersion: 3})};
   return null;
 }})})};
 const imports={
 '@/lib/ss-dispatch-retry':{quotaRetryAllowed:()=>false},
 '@/lib/ss-send-window':{inSendWindow:()=>true,SEND_WINDOW_REASON:'outside hours'},
 'cloudflare:workers':{env:{SS_DISPATCH_TOKEN:'test-token',SS_REVIEW_KEY:'test-key'}},
 '@/lib/server':{db:()=>db,json:x=>x,fail:e=>{throw e},member:()=>{throw Error('unexpected login')},owner:()=>{},origin:()=>{},HttpError:Error},
 '@/lib/ss-dispatch':{checkReceipt:async()=>structuredClone(review),hashRun:async()=>'test-hash',DISPATCH_CHECKS:[]},
 };
 const mod={exports:{}};vm.runInNewContext(code,{exports:mod.exports,module:mod,require:n=>{assert(n in imports,n);return imports[n]},crypto:globalThis.crypto,URL,TextEncoder,Uint8Array,Date});
 return mod.exports.GET(new Request('https://test.invalid/api/ss-dispatch?hospital=planme&date='+date,{headers:{authorization:'Bearer test-token'}}));
}
for(const [status,reason] of [['pending','검수 결과가 아직 연결되지 않았습니다.'],['expired','검수 유효시간이 지났습니다.'],['pending','검수 서명 불일치']])test(`${reason}를 기준 변경으로 덮어쓰지 않는다`,async()=>{const r=await response({status,reason,ready:false,passed:0,total:1,receipt:null});assert.equal(r.reviewReason,reason);assert.equal(r.reason,reason);assert.equal(r.ready,false)});
test('실제 기준 변경은 계속 발송을 차단한다',async()=>{const r=await response({status:'valid',reason:'통과',ready:true,passed:1,total:1,receipt:{quality:{criteriaVersion:2},patients:[]}});assert.equal(r.ready,false);assert.match(r.reason,/운영 기준이 변경/)});
test('같은 기준으로 검수한 회차는 승인 가능한 상태를 유지한다',async()=>{const r=await response({status:'valid',reason:'통과',ready:true,passed:1,total:1,receipt:{quality:{criteriaVersion:3},patients:[]}});assert.equal(r.ready,true);assert.equal(r.reason,'통과')});
