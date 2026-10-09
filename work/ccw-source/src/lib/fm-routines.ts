import catalog from './fm-routine-catalog.json';
export const ROUTINE_CYCLES=[['daily','매일'],['weekly','매주'],['monthly','매월'],['quarterly','분기'],['halfyear','반기'],['yearly','매년'],['threeYear','3년']] as const;
export function routinePeriod(cycle:string,date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('기준 날짜를 확인해 주세요.');
 const y=date.slice(0,4),m=Number(date.slice(5,7));
 if(cycle==='daily')return date;
 if(cycle==='monthly')return date.slice(0,7);
 if(cycle==='quarterly')return y+'-Q'+Math.ceil(m/3);
 if(cycle==='halfyear')return y+'-H'+Math.ceil(m/6);
 if(cycle==='yearly')return y;
 if(cycle==='threeYear'){const start=Number(y)-Number(y)%3;return start+'~'+(start+2);}
 if(cycle==='weekly'){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
 throw Error('업무 주기를 선택해 주세요.');
}
export function routineTemplates(cycle:string,date:string){const period=routinePeriod(cycle,date);return catalog.filter(t=>t.cycle===cycle).map(t=>({...t,key:'routine:'+t.id+':'+period,period}));}

// Missing means not registered for this period; it does not imply a statutory deadline.
export function routineCoverage(work:readonly {routineKey?:string;status:string;due:string}[],date:string){
 return ROUTINE_CYCLES.map(([cycle,label])=>{
  const items=routineTemplates(cycle,date).map(t=>{
   const matches=work.filter(w=>w.routineKey===t.key);
   const w=matches.find(w=>w.status!=='취소')||matches[0];
   return {...t,status:w?.status||'미등록',due:w?.due||'',overdue:!!w&&!['완료','취소'].includes(w.status)&&!!w.due&&w.due<date};
  });
  return {cycle,label,period:routinePeriod(cycle,date),items,total:items.length,
   missing:items.filter(i=>i.status==='미등록').length,completed:items.filter(i=>i.status==='완료').length,
   cancelled:items.filter(i=>i.status==='취소').length,open:items.filter(i=>!['미등록','완료','취소'].includes(i.status)).length,
   overdue:items.filter(i=>i.overdue).length};
 });
}

export type RoutinePolicy={enabled:boolean;person:string;time:string;cycles:{cycle:string;dueDays:number}[]};
export const defaultRoutinePolicy=():RoutinePolicy=>({enabled:false,person:'do',time:'09:00',cycles:[]});
export function validateRoutinePolicy(raw:any,people:string[]):RoutinePolicy{
 if(!raw||typeof raw.enabled!=='boolean'||!people.includes(raw.person)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time)||!Array.isArray(raw.cycles)||raw.cycles.length>7)throw Error('자동 등록 기준을 확인해 주세요.');
 const seen=new Set<string>();const cycles=raw.cycles.map((r:any)=>{if(!ROUTINE_CYCLES.some(([c])=>c===r.cycle)||seen.has(r.cycle)||!Number.isInteger(r.dueDays)||r.dueDays<0||r.dueDays>366)throw Error('주기와 등록 후 점검일을 확인해 주세요.');seen.add(r.cycle);return {cycle:r.cycle,dueDays:r.dueDays}});
 if(raw.enabled&&!cycles.length)throw Error('자동 등록할 주기를 선택해 주세요.');
 return {enabled:raw.enabled,person:raw.person,time:raw.time,cycles};
}
