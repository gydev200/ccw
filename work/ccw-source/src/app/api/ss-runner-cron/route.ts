import {env} from '@/lib/runtime';
import {db,json} from '@/lib/server';
import {checkReceipt} from '@/lib/ss-dispatch';

export const dynamic='force-dynamic';
export const maxDuration=60;

const safeEqual=(a:string,b:string)=>{
 const bytes=(s:string)=>new TextEncoder().encode(s);
 const x=bytes(a),y=bytes(b);let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
};

export async function GET(req:Request){
 const secret=env.CRON_SECRET;
 if(!secret)return json({error:'Vercel CRON_SECRET 설정이 필요합니다.'},503);
 if(!safeEqual(req.headers.get('authorization')||'',`Bearer ${secret}`))return json({error:'인증 실패'},401);
 const store=db(),now=new Date().toISOString(),heartbeat={at:now,version:'ss-runner-cron-v1',host:'vercel-cron',actualSendEnabled:false};
 await store.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('ss-runner:heartbeat',JSON.stringify(heartbeat)).run();
 const pending=await store.prepare("SELECT key,value FROM settings WHERE key LIKE 'ss-job:%' AND key NOT LIKE '%:history:%' ORDER BY key LIMIT 25").all<any>();
 let claimed=0,held=0,skipped=0;
 for(const item of pending.results){
  let job:any;try{job=JSON.parse(item.value)}catch{skipped++;continue}
  if(job.status!=='queued'||!['floce','planme'].includes(job.hospital)||!/^\d{4}-\d{2}-\d{2}$/.test(job.date)||job.service!==5){skipped++;continue}
  const lease=crypto.randomUUID(),running={...job,status:'running',lease,startedAt:now,updatedAt:now,stage:'제작 자료와 발송 전 조건 확인'};
  const lock=await store.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(running),item.key,item.value).run();
  if(!lock.meta.changes){skipped++;continue}claimed++;
  try{
   const k=`ss-production:${job.hospital}:${job.date}`;
   const [runRecord,policyRecord,reviewRecord]=await Promise.all([
    store.prepare('SELECT value FROM settings WHERE key=?').bind(k).first<{value:string}>(),
    store.prepare('SELECT value FROM settings WHERE key=?').bind(`ss-policy:${job.hospital}:5`).first<{value:string}>(),
    store.prepare('SELECT value FROM settings WHERE key=?').bind(k+':review').first<{value:string}>(),
   ]);
   const run=runRecord?JSON.parse(runRecord.value):null;
   const policy=policyRecord?JSON.parse(policyRecord.value):null;
   const steps:any[]=[{title:'서버 실행기 연결',passed:true,detail:'Vercel Cron이 작업을 인수했습니다.'}];
   steps.push({title:'운영 기준 확인',passed:!!policy,detail:policy?`기준 버전 ${policy.version} · 기준 ${policy.criteriaVersion||1}`:'병원별 장기미내원 기준을 찾지 못했습니다.'});
   steps.push({title:'제작 회차 연결',passed:!!run,detail:run?`${run.rows?.length||0}명 제작 회차가 연결됐습니다.`:'해당 날짜의 제작 회차가 없습니다.'});
   let complete=!!run&&Array.isArray(run.rows)&&run.rows.length>0;
   if(complete){
    const hasMissing=run.rows.some((p:any)=>!p.screen31?.title||!p.screen31?.body||!p.screen32?.title||!p.screen32?.body||!p.linkStatus||!Array.isArray(p.issues)||p.issues.length>0);
    steps.push({title:'환자별 화면·링크·제작 오류',passed:!hasMissing,detail:hasMissing?'누락 화면·링크 또는 미해결 제작 오류가 있습니다.':'구조상 필수 화면과 링크 필드가 채워졌습니다. 실제 환자별 열람 검증은 별도 증빙이 필요합니다.'});
    complete=complete&&!hasMissing;
   }
   const proof=reviewRecord?JSON.parse(reviewRecord.value):null;
   const proofCheck=run?await checkReceipt(run,proof,env.SS_REVIEW_KEY):null;
   const proofMatches=!!proofCheck?.ready;
   steps.push({title:'서명된 독립 검수 결과',passed:proofMatches,detail:proofMatches?proofCheck.reason:proofCheck?.reason||'검수 자료가 없습니다.'});
   steps.push({title:'최신 발송·수신거부 대조',passed:false,detail:'현재 실행기에는 이 회차의 환자 참조를 과거 발송·수신거부 원장과 대조하는 연결이 없습니다.'});
   const reason=!run?'제작 회차를 먼저 연결해야 합니다.':!complete?'환자별 화면·링크 또는 제작 오류를 보완해야 합니다.':!proofMatches?'실제 환자 화면 확인과 독립 검수 후 서명 결과를 연결해야 합니다.':'최신 발송·수신거부 원장 대조 연결이 없어 검수 보류입니다.';
   const finished={...running,status:'held',stage:'자동 사전점검 완료 · 발송 검수 보류',reason,steps,updatedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),actualSent:0};
   const saved=await store.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(finished),item.key,JSON.stringify(running)).run();
   if(saved.meta.changes)held++;
  }catch(e){
   const failed={...running,status:'held',stage:'실행 오류 · 작업 보존',reason:e instanceof Error?e.message:'실행 오류',updatedAt:new Date().toISOString(),actualSent:0};
   await store.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(failed),item.key,JSON.stringify(running)).run();held++;
  }
 }
 return json({ok:true,heartbeat:now,claimed,held,skipped,actualSendEnabled:false});
}
