import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import {emptyWallet,reduceWallet} from '../../../lib/settlement';
export const context=new AsyncLocalStorage<string>();
export const connection=new DatabaseSync(process.env.SETTLEMENT_DB||new URL('./demo.sqlite',import.meta.url).pathname);
connection.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY,kind TEXT,data TEXT)');
export const db=()=>({prepare(sql:string){return {bind(...args:any[]){return {async first(){return connection.prepare(sql).get(...args)},async all(){return {results:connection.prepare(sql).all(...args)}},async run(){const r=connection.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}},async all(){return {results:connection.prepare(sql).all()}}}}});
export class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
export async function member(){const role=context.getStore();if(role==='none')throw new HttpError(401,'로그인이 필요합니다.');return {id:'synthetic-owner',role:role||'DO'}}
export function owner(m:any){if(m.role!=='DO')throw new HttpError(403,'전무이사님만 처리할 수 있습니다.')}
export function origin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'이 화면에서 다시 시도해 주세요.')}
export const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const fail=(e:any)=>json({error:e.message},e.status||400);
for(const [id,name,multiplier] of [[90001,'가상 연세병원',1],[90002,'가상 미래의원',1.2],[90003,'플랜미의원 · 예제',1]] as const){
 if(!connection.prepare('SELECT id FROM records WHERE id=?').get(id)){
 connection.prepare('INSERT INTO records VALUES (?,?,?)').run(id,'customer',JSON.stringify({name}));
 let w=emptyWallet();const go=(c:any)=>w=reduceWallet(w,{...c,version:w.version,requestId:crypto.randomUUID()},'예시 데이터');
 go({action:'pricing',prices:{ATA:{sale:Math.round(23*multiplier),cost:13},SMS:{sale:Math.round(28*multiplier),cost:18},LMS:{sale:Math.round(55*multiplier),cost:45}},limit:1000000,note:'화면 검증용 예시 단가 · 실제 계약 아님'});
 go({action:'charge',amount:200000,ref:'DEMO-CHARGE-'+id,note:'가상 충전'});go({action:'reserve',channel:'LMS',count:1000,ref:'DEMO-SEND-'+id});go({action:'settle',holdId:'DEMO-SEND-'+id,success:900,actualCost:40500,note:'가상 최종 결과 900건 성공 / 100건 실패'});
 go({action:'reserve',channel:'SMS',count:200,ref:'DEMO-WAIT-'+id});connection.prepare('INSERT INTO settings VALUES (?,?)').run('service-settlement:v1:'+id,JSON.stringify(w));
 }
}
// Synthetic historical service transactions; never imported from real bank or contract data.
for(const hospitalId of [90001,90002,90003]){
 const key='service-settlement:v1:'+hospitalId;let w=JSON.parse(connection.prepare('SELECT value FROM settings WHERE key=?').get(key)!.value as string);
 if(!(w.trades||[]).some((t:any)=>t.ref==='DEMO-AUG-FIXED-'+hospitalId)){
 const add=(kind:string,extra:any)=>{const id=crypto.randomUUID();w=reduceWallet(w,{action:'trade',version:w.version,requestId:id,trade:{kind,date:'2026-09-01',serviceMonth:'2026-09',category:'fixed',amount:500000,party:hospitalId===90001?'가상 연세병원':hospitalId===90003?'플랜미의원 · 예제':'가상 미래의원',description:'가상 월 고정 서비스료',ref:'DEMO-'+id,evidence:'화면 검증용 가상 거래 · 실제 입출금 아님',...extra}},'예시 데이터');return id};
 const aug=add('invoice',{date:'2026-08-01',serviceMonth:'2026-08',ref:'DEMO-AUG-FIXED-'+hospitalId});add('receipt',{date:'2026-08-05',serviceMonth:'2026-08',invoiceId:aug,description:'8월 고정비 가상 입금'});
 const sep=add('invoice',{ref:'DEMO-SEP-FIXED-'+hospitalId});add('receipt',{date:'2026-09-04',amount:300000,invoiceId:sep,description:'9월 고정비 가상 일부 입금'});
 const blog=add('invoice',{category:'blog',amount:220000,description:'가상 블로그 제작 4편'});add('receipt',{category:'blog',amount:220000,invoiceId:blog,description:'가상 블로그 대금 입금'});add('expense',{category:'blog',amount:100000,party:'가상 콘텐츠 제작사',description:'가상 블로그 외주비 지급'});
 add('invoice',{category:'video',amount:700000,description:'가상 병원 소개 영상 제작'});add('receipt',{date:'2026-07-15',serviceMonth:'2026-07',category:'other',amount:100000,description:'과거 입금 가상 대조 대기'});
 connection.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(w),key);
 }
}
for(const hospitalId of [90001,90002,90003]){
 const key='service-settlement:v1:'+hospitalId;let w=JSON.parse(connection.prepare('SELECT value FROM settings WHERE key=?').get(key)!.value as string);
 if(!(w.costEntries||[]).some((t:any)=>t.ref==='DEMO-LABOR-'+hospitalId)){
  for(const cost of [{month:'2026-09',category:'fixed',type:'labor',amount:100000,ref:'DEMO-LABOR-'+hospitalId,basis:'가상 예시: 내부 응대·관리 4시간 × 내부 시간원가 25,000원'},{month:'2026-09',category:'fixed',type:'shared',amount:50000,ref:'DEMO-SHARED-'+hospitalId,basis:'가상 예시: 월 공통 운영비 중 해당 병원 몫 50,000원 · 실제 배부기준 아님'}])w=reduceWallet(w,{action:'cost',cost,version:w.version,requestId:crypto.randomUUID()},'예시 데이터');
  connection.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(w),key);
 }
}
