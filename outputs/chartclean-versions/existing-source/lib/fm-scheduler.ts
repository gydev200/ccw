import {reduceFinance,kstDate,type Finance} from './ccfm';
import {routineTemplates,validateRoutinePolicy} from './fm-routines';
import type {Member} from './model';
export function scheduledFinance(before:Finance,at:string,people:string[],unavailable:Set<string>){
 if(!before.routinePolicy?.enabled)return {ledger:before,created:0,reason:'paused'};
 const policy=validateRoutinePolicy(before.routinePolicy,people),date=kstDate(at);
 const time=new Date(Date.parse(at)+9*3600000).toISOString().slice(11,16);
 if(time<policy.time)return {ledger:before,created:0,reason:'before-time'};
 if(unavailable.has(policy.person))throw Error('자동 등록 담당자의 계정이 중지되었습니다. 담당자를 변경해 주세요.');
 let after=before;const actor={id:'fm-routine-worker',person:'do',role:'DO',active:1} as Member;
 for(const {cycle,dueDays} of policy.cycles){
  const templates=routineTemplates(cycle,date);if(templates.every(t=>(after.work||[]).some(w=>w.routineKey===t.key)))continue;
  const due=new Date(Date.parse(date+'T00:00:00Z')+dueDays*86400000).toISOString().slice(0,10);
  after=reduceFinance(after,{action:'ensureRoutines',cycle,date,due,person:policy.person,version:after.version,requestId:'auto:'+cycle+':'+templates[0].period+':'+after.version},actor,[],people,['DSS'],at);
 }
 return {ledger:after,created:(after.work?.length||0)-(before.work?.length||0),reason:after===before?'up-to-date':'registered'};
}
