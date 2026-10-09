// One immutable production revision connects the selected patient, LMS, and both screens.
// This module does not send messages or treat a manually entered count as evidence.
export const PRODUCTION_CHECKS = ['identity','eligibility','freshness','lms','screen31','screen32','links','independentReview'] as const;
export type ProductionCheck = typeof PRODUCTION_CHECKS[number];
export type ProductionItem = {
  patientRef: string;
  hospital: string;
  sourceRevision: string;
  lms: string;
  screen31Revision: string;
  screen32Revision: string;
  patientLink: string;
  excluded: boolean;
  alreadySent: boolean;
};
export type ProductionProof = {
  patientRef: string;
  check: ProductionCheck;
  revision: string;
  status: 'passed'|'held';
  evidence: string;
  reviewer: string;
  checkedAt: string;
  expiresAt: string;
};
export async function productionRevision(hospital:string,day:string,items:ProductionItem[]){
  const canonical=JSON.stringify({hospital,day,items:items.map(p=>({
    patientRef:p.patientRef,hospital:p.hospital,sourceRevision:p.sourceRevision,
    lms:p.lms,screen31Revision:p.screen31Revision,screen32Revision:p.screen32Revision,
    patientLink:p.patientLink,excluded:p.excluded,alreadySent:p.alreadySent,
  }))});
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function reviewProduction(input:{hospital:string;revision:string;items:ProductionItem[];proofs:ProductionProof[];goal:number},now=new Date()){
  const {hospital,revision,items,proofs,goal}=input;
  const blockers:string[]=[];
  if(!Number.isSafeInteger(goal)||goal<1||goal>500)blockers.push('목표 인원 오류');
  if(items.length!==goal)blockers.push('목표 인원과 명단 불일치');
  if(new Set(items.map(p=>p.patientRef)).size!==items.length)blockers.push('대상 중복');
  if(!/^[a-f0-9]{64}$/.test(revision))blockers.push('제작본 확인값 없음');
  const rows=items.map(p=>{
    const reasons:string[]=[];
    if(!p.patientRef||p.hospital!==hospital)reasons.push('환자·병원 연결 불일치');
    if(p.excluded)reasons.push('제외 대상');
    if(p.alreadySent)reasons.push('기발송 대상');
    if(!p.sourceRevision)reasons.push('원자료 버전 없음');
    if(!p.lms.trim()||!p.patientLink||!p.lms.includes(p.patientLink))reasons.push('LMS·개인 링크 연결 미완료');
    if(!p.screen31Revision||!p.screen32Revision)reasons.push('3-1·3-2 제작 미완료');
    let validLink=false;
    try{const u=new URL(p.patientLink);validLink=u.protocol==='https:'&&!u.username&&!u.password;}catch{}
    if(!validLink)reasons.push('개인 링크 형식 오류');
    for(const check of PRODUCTION_CHECKS){
      const matching=proofs.filter(v=>v.patientRef===p.patientRef&&v.check===check&&v.revision===revision);
      // Conflicting evidence cannot be hidden by adding another pass entry.
      if(matching.length!==1){reasons.push(check+': 검수 근거 누락·중복');continue;}
      const v=matching[0],at=Date.parse(v.checkedAt),until=Date.parse(v.expiresAt);
      if(v.status!=='passed'||!v.evidence.trim()||!v.reviewer.trim()||!Number.isFinite(at)||!Number.isFinite(until)||at>now.getTime()||until<=now.getTime()||until<=at)reasons.push(check+': 보류·근거 만료');
    }
    return {patientRef:p.patientRef,passed:reasons.length===0,reasons};
  });
  return {revision,ready:blockers.length===0&&rows.length>0&&rows.every(r=>r.passed),passed:rows.filter(r=>r.passed).length,total:rows.length,blockers,rows};
}
// The server must call this with its persisted data before accepting approval or dispatch.
// Never trust a browser-supplied revision paired with different content.
export async function verifyProduction(input:Parameters<typeof reviewProduction>[0]&{day:string},now=new Date()){
  const actual=await productionRevision(input.hospital,input.day,input.items);
  const review=reviewProduction(input,now);
  if(actual!==input.revision){review.ready=false;review.blockers.push('검수 이후 제작본 변경');}
  return review;
}
export function canDispatchProduction(review:ReturnType<typeof reviewProduction>,approval:{revision:string;approvedBy:string;expiresAt:string}|null,revision:string,now=new Date()){
  return review.ready&&review.revision===revision&&!!approval&&approval.revision===revision&&!!approval.approvedBy.trim()&&Date.parse(approval.expiresAt)>now.getTime();
}
