import {newestOutreach} from './outreach';
import {OP_ACTIVITIES} from './os-roles';

export const OP_QUEUE_STATES=['전체','10분 초과','10분 이내','전달 시각 확인','기한 경과','오늘 재연락','일정 미등록','다음 일정','처리 기록','연락 중지'] as const;
export function opFirstContact(visit:any,calls:any[],now=Date.now()){
 const deliveredAt=visit.data.deliveredAt||'',deliveredMs=Date.parse(deliveredAt);
 const valid=Number.isFinite(deliveredMs)&&deliveredMs<=now;
 const first=valid?[...calls].filter(c=>Date.parse(c.data.calledAt||c.created_at||'')>=deliveredMs).sort((a,b)=>Date.parse(a.data.calledAt||a.created_at)-Date.parse(b.data.calledAt||b.created_at)||a.id-b.id)[0]:undefined;
 const deadline=valid?deliveredMs+600000:null;
 const elapsed=first?Date.parse(first.data.calledAt||first.created_at)-deliveredMs:null;
 return {deliveredAt,deadline,first,elapsed,within:first?.data.calledAt&&elapsed!==null?elapsed<=600000:null,state:first?'처리 기록':!valid?'전달 시각 확인':now>deadline!?'10분 초과':'10분 이내'};
}
export function koreaDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});}
export function opControl(rows:any[],hospitals:any[],issueId:number,date:string,now=Date.now()){
 const sorted=newestOutreach(rows),issue=sorted.filter(r=>Number(r.data.issueId)===issueId);
 const calls=issue.filter(r=>r.kind==='call'&&r.data.journey!=='A');
 const latest=new Map<string,any>(),global=new Map<string,any>(),visits=new Map<string,any>();
 for(const r of sorted)if(r.kind==='call'&&!global.has(r.data.hospitalId))global.set(r.data.hospitalId,r);
 for(const r of calls)if(!latest.has(r.data.hospitalId))latest.set(r.data.hospitalId,r);
 for(const r of issue)if(r.kind==='delivery'&&!visits.has(r.data.hospitalId))visits.set(r.data.hospitalId,r);
 for(const [id,r] of visits)if(r.data.status!=='전달')visits.delete(id);
 const byId=new Map(hospitals.map(h=>[h.id,h]));
 const queue=[...visits].map(([id,visit])=>{
  const contact=opFirstContact(visit,calls.filter(r=>r.data.hospitalId===id),now),call=contact.first?latest.get(id):undefined,last=global.get(id),h=byId.get(id)||{id,name:'병원 원본 확인 필요'};
  const stopped=last?.data.doNotContact==='연락 중지';
  const state=stopped?'연락 중지':!call?contact.state:call.data.nextDate?(call.data.nextDate<date?'기한 경과':call.data.nextDate===date?'오늘 재연락':'다음 일정'):call.data.nextAction||['부재','재연락 요청'].includes(call.data.outcome)?'일정 미등록':'처리 기록';
  const shift=sorted.find(r=>r.kind==='shift'&&String(r.id)===String(visit.data.shiftId));
  return {hospital:h,visit,call,contact,dm:shift?.data.worker||visit.assignee||'',state,owner:call?.data.owner||call?.assignee||'',nextDate:call?.data.nextDate||'',nextAction:stopped?'연락 중지 · 병원의 재개 요청 근거 확인':call?.data.nextAction||(!call?'전달 후 10분 이내 소식지 소개·행사·EMR 신청 안내':'다음 행동 미등록')};
 }).sort((a,b)=>{
  const rank=(s:string)=>OP_QUEUE_STATES.indexOf(s as any);
  return rank(a.state)-rank(b.state)||(a.contact.first&&b.contact.first?a.nextDate.localeCompare(b.nextDate):(a.contact.deadline||Infinity)-(b.contact.deadline||Infinity))||String(a.hospital.name).localeCompare(String(b.hospital.name),'ko');
 });
 const daily=calls.filter(r=>koreaDate(r.created_at||r.updated_at||'')===date);
 const count=(outcomes:string[],source=calls)=>new Set(source.filter(r=>outcomes.includes(r.data.outcome)).map(r=>r.data.hospitalId)).size;
 const emr=new Set(sorted.filter(r=>r.kind==='document'&&r.data.name==='EMR'&&r.data.status==='수령 확인'&&visits.has(r.data.hospitalId)).map(r=>r.data.hospitalId)).size;
 const owners=[...new Set([...queue.map(q=>q.owner),...daily.map(r=>r.data.owner||r.assignee||'')])];
 const workload=owners.map(owner=>{
  const assigned=queue.filter(q=>q.owner===owner),records=daily.filter(r=>(r.data.owner||r.assignee||'')===owner);
  return {owner,records:records.length,contacted:new Set(records.map(r=>r.data.hospitalId)).size,urgent:assigned.filter(q=>['10분 초과','10분 이내','기한 경과','오늘 재연락'].includes(q.state)).length,unscheduled:assigned.filter(q=>['전달 시각 확인','일정 미등록'].includes(q.state)).length,remaining:assigned.filter(q=>!['처리 기록','연락 중지'].includes(q.state)).length};
 });
 return {queue,daily,calls,visits:visits.size,contacted:queue.filter(q=>q.contact.first).length,within:queue.filter(q=>q.contact.within===true).length,late:queue.filter(q=>q.contact.within===false).length,unknown:queue.filter(q=>q.contact.first&&q.contact.within===null).length,count,emr,workload,purposes:OP_ACTIVITIES.map(purpose=>({purpose,count:new Set(calls.filter(r=>r.data.bStep===purpose).map(r=>r.data.hospitalId)).size})),dailyEvent:count(['행사 참여 신청'],daily),dailyEmr:count(['EMR 분석 신청'],daily),event:count(['행사 참여 신청']),emrRequest:count(['EMR 분석 신청'])};
}
