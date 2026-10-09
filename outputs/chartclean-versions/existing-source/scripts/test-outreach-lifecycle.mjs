import assert from 'node:assert/strict';
const base='http://localhost:5187';let cookie='';let checks=0;
async function req(path='outreach',body){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {r,data:await r.json()};}
const login=await req('auth',{action:'login',username:'qa-outreach',password:'LocalOutreach260917!'});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];
const get=async()=>(await req()).data;
async function save(kind,data,record,expect=200){const s=await get();const out=await req('outreach',{kind,data,id:record?.id,version:record?.version,revision:s.revision,requestId:crypto.randomUUID()});assert.equal(out.r.status,expect,JSON.stringify(out.data));checks++;return (await get()).rows.find(r=>r.id===out.data.id);}
const s=await get(),original=s.rows.find(r=>r.kind==='call'),trial=s.rows.find(r=>r.kind==='trial');assert.ok(original&&trial,'Run API fixture tests first');
await save('call',{...original.data,doNotContact:'연락 중지',reaction:'로컬 검증: 병원 요청으로 중지'});
await save('call',{...original.data,doNotContact:'계속 소통'},null,400);
await save('call',{...original.data,doNotContact:'연락 재개 확인',reaction:'로컬 검증: 병원의 재연락 요청 확인'});
await save('call',{...original.data,doNotContact:'계속 소통'});
await save('trial',{...trial.data,status:'계약 체결',reviewUrl:'https://example.com/local-review',resultUrl:'https://example.com/local-results',result:'로컬 시험 자료만 사용',contractDate:'2026-09-17',contractRef:'LOCAL-ONLY',contractUrl:'https://example.com/local-contract'},trial);
assert.equal((await get()).customers.find(c=>c.sourceId===trial.data.hospitalId).stage,'S');checks++;
await save('call',{...original.data,doNotContact:'계속 소통'});
assert.equal((await get()).customers.find(c=>c.sourceId===trial.data.hospitalId).stage,'S');checks++;
console.log(JSON.stringify({checks,passed:true,realMessagesSent:0,realContractsSigned:0}));
