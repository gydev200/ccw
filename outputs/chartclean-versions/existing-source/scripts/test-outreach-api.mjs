import assert from 'node:assert/strict';
const base='http://localhost:5187';let cookie='';let checks=0;
async function req(path='',body){const r=await fetch(base+'/api/'+(path||'outreach'),{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});const data=await r.json();return {r,data};}
const login=await req('auth',{action:'login',username:'qa-outreach',password:'LocalOutreach260917!'});assert.equal(login.r.status,200,JSON.stringify(login.data));cookie=login.r.headers.get('set-cookie').split(';')[0];
const get=async()=>{const {r,data}=await req();assert.equal(r.status,200,JSON.stringify(data));return data};
async function save(kind,data,record,expect=200,rev){const s=await get();const out=await req('',{kind,data,id:record?.id,version:record?.version,revision:rev??s.revision,requestId:crypto.randomUUID()});assert.equal(out.r.status,expect,JSON.stringify(out.data));checks++;if(expect===200)return (await get()).rows.find(r=>r.id===out.data.id);return out;}
let issue=await save('issue',{number:999,title:'[로컬 검증용] 소식지',topic:'소식지 내용',copy:'이번 호 소식입니다.',url:'https://example.com/qa',status:'배포 가능',date:'2026-09-17'});
await save('shift',{issueId:issue.id,date:'2026-09-17',worker:'do',mode:'도보',quantity:10,returned:0},null,400);
await save('stock',{issueId:issue.id,type:'입고',quantity:10,note:'로컬 검증 입고'});
let shift=await save('shift',{issueId:issue.id,date:'2026-09-17',worker:'do',mode:'도보',quantity:10,returned:0});
const {data:cat}=await req('outreach?catalog=1');const h=cat.buildings[0].hospitals[0];assert.equal(cat.sourceCount,3500);checks++;
let delivery=await save('delivery',{issueId:issue.id,hospitalId:h.id,shiftId:String(shift.id),status:'전달',quantity:1,notes:'로컬 전달 검증'});
assert.ok(delivery.data.deliveredAt);checks++;
await save('delivery',{issueId:issue.id,hospitalId:h.id,shiftId:String(shift.id),status:'전달',quantity:1},null,400);
await save('delivery',{issueId:issue.id,hospitalId:cat.buildings[0].hospitals[1].id,shiftId:String(shift.id),status:'전달',quantity:20},null,400);
let call=await save('call',{issueId:issue.id,hospitalId:h.id,usedCopy:'이번 호 소식입니다.',reaction:'분석 관심',outcome:'관심',bStep:'일반 연락',doNotContact:'계속 소통'});assert.equal(call.data.deliveryId,delivery.id);checks++;
await save('document',{hospitalId:h.id,name:'EMR',status:'수령 확인'},null,400);
await save('trial',{hospitalId:h.id,sampleTarget:30,status:'준비'},null,400);
let doc=await save('document',{hospitalId:h.id,name:'EMR',status:'수령 확인',sourceName:'local-qa.csv',url:'https://example.com/local-file',receivedAt:'2026-09-17'});
assert.ok((await get()).customers.some(c=>c.sourceId===h.id&&c.stage==='A'));checks++;
let trial=await save('trial',{hospitalId:h.id,sampleTarget:30,status:'준비',accepted:0,delivered:0,failed:0});
await save('trial',{...trial.data,status:'계약 체결'},trial,400);
const snapshot=await get();await save('planning',{title:'로컬 기획',category:'광고 기획',brief:'검증',status:'기획'});
await save('planning',{title:'오래된 수정'},null,409,snapshot.revision);
await save('quality',{title:'근거 없는 통과',status:'통과'},null,400);
const orig=await req('',{kind:'stock',revision:(await get()).revision,requestId:crypto.randomUUID(),data:{issueId:issue.id,type:'입고',quantity:1,note:'경합'}});assert.equal(orig.r.status,200);checks++;
const oldCopy=call.data.copySnapshot;issue=await save('issue',{...issue.data,copy:'새 카피'},issue);assert.equal(issue.data.status,'검수 중');assert.equal((await get()).rows.find(r=>r.id===call.id).data.copySnapshot,oldCopy);checks+=2;
const anon=await fetch(base+'/api/outreach');assert.equal(anon.status,401);checks++;
console.log(JSON.stringify({checks,passed:true,sourceHospitals:cat.sourceCount,realMessagesSent:0}));
