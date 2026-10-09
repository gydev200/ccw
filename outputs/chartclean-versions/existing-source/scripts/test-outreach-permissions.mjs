import assert from 'node:assert/strict';
const base='http://localhost:5187';
async function login(username){const r=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'login',username,password:'LocalOutreach260917!'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const owner=await login('qa-outreach'),os=await login('qa-os'),dm=await login('qa-dm'),none=await login('qa-none');let checks=0;
async function api(cookie,body,origin=base){const r=await fetch(base+'/api/outreach',{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{d={error:raw}}return {r,d};}
assert.equal((await api(none)).r.status,403);checks++;
let state=(await api(owner)).d;
const body={kind:'quality',revision:state.revision,requestId:crypto.randomUUID(),data:{title:'no-permission',status:'미확인'}};
assert.equal((await api(os,body)).r.status,403);checks++;
assert.equal((await api(dm,{...body,kind:'call'})).r.status,403);checks++;
assert.equal((await api(owner,body,'https://other.example')).r.status,403);checks++;
let id=state.rows.find(r=>r.kind==='issue').id;
const stock={kind:'stock',revision:state.revision,data:{issueId:id,type:'입고',quantity:1,note:'local concurrent test'}};
const outcomes=await Promise.all([api(owner,{...stock,requestId:crypto.randomUUID()}),api(owner,{...stock,requestId:crypto.randomUUID()})]);assert.deepEqual(outcomes.map(x=>x.r.status).sort(),[200,409]);checks++;
const st=(await api(owner)).d;
const same={kind:'planning',revision:st.revision,requestId:crypto.randomUUID(),data:{title:'local idempotency test'}};const first=await api(owner,same),again=await api(owner,same);assert.equal(first.d.id,again.d.id);checks++;
const location=await api(os,{kind:'location',data:{shiftId:String(st.rows.find(r=>r.kind==='shift').id),lat:37,lng:127,accuracy:10,active:true},revision:st.revision,requestId:crypto.randomUUID()});assert.equal(location.r.status,403);checks++;
console.log(JSON.stringify({checks,passed:true,realMessagesSent:0,realLocationAccess:false}));
