// A signed result is evidence provenance, not proof of correctness.
// Require an independently exercised checker and batch-specific completion.
export const QUALITY_POLICY='ss-longabsence-v2';
export const FAULT_CASES=['wrong_patient','wrong_hospital','wrong_link','wrong_copy','missing_dashboard','optout','duplicate','timeout','interrupted','missing_result','expired_result','model_failure'] as const;
export type QualityEvidence={
 policy:string;runHash:string;completed:boolean;checkerVersion:string;templateVersion:string;
 startedAt:string;finishedAt:string;heartbeatAt:string;
 calibration:{at:string;checkerVersion:string;faults:Record<string,boolean>;validCases:number;validPassed:number};
 dataBasis:{mode:'current'|'available';sourceAsOf:string;policyRef:string;knownExclusionsCheckedAt:string};
 total:number;checked:number;unresolved:number;
 human:{required:boolean;reason:string;completed:boolean;reviewer?:string};
};
export function assessQuality(q:QualityEvidence|undefined,hash:string,total:number,at=Date.now()){
 const no=(reason:string)=>({ok:false,reason});
 if(!q||q.policy!==QUALITY_POLICY||q.runHash!==hash)return no('현재 제작본의 검수 실행 근거가 필요합니다.');
 const recent=(s:string,max:number)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=at&&at-Date.parse(s)<=max;
 if(!q.completed||q.total!==total||q.checked!==total||q.unresolved!==0)return no('전수 검수가 끝나지 않았거나 미해결 오류가 있습니다.');
 if(!q.checkerVersion||!q.templateVersion||!recent(q.finishedAt,2*3600000)||!recent(q.heartbeatAt,2*3600000)||!Number.isFinite(Date.parse(q.startedAt))||Date.parse(q.startedAt)>Date.parse(q.finishedAt))return no('검수 중단·지연 또는 실행 버전 확인이 필요합니다.');
 const c=q.calibration;
 if(!c||c.checkerVersion!==q.checkerVersion||!recent(c.at,24*3600000)||!FAULT_CASES.every(k=>c.faults?.[k]===true)||!Number.isInteger(c.validCases)||c.validCases<1||c.validPassed!==c.validCases)return no('검수기 자체시험이 미완료이거나 실패했습니다.');
 const d=q.dataBasis;
 if(!d||!['current','available'].includes(d.mode)||!/^\d{4}-\d{2}-\d{2}$/.test(d.sourceAsOf)||!Number.isFinite(Date.parse(d.sourceAsOf))||Date.parse(d.sourceAsOf)>at||!recent(d.knownExclusionsCheckedAt,2*3600000)||(d.mode==='available'&&d.policyRef!=='owner-available-emr-20260915'))return no('확보 자료 기준일과 현재 확인 가능한 제외·중복 대조 근거가 필요합니다.');
 if(!q.human||typeof q.human.required!=='boolean'||!q.human.reason||(q.human.required&&(!q.human.completed||!q.human.reviewer)))return no('자동 해소하지 못한 예외 검토가 남아 있습니다.');
 return {ok:true,reason:d.mode==='available'?'확보 자료 기준 · 최신 EMR 미확인 사실 유지':'최신 자료 기준'};
}
