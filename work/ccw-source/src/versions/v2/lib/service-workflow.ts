import {refreshOnboarding} from './hospital-onboarding';
export const CHECKS=[
 ['identity','환자·병원·연락처 일치'],['freshness','최신 내원·예약 변동 대조'],['permission','연락 목적·수신거부·보류 대조'],['duplicate','기존 발송·후속 연락 간격 대조'],['clinical','진료 근거와 맞춤 문구 일치'],['link','개인 링크·본인확인·예약 흐름 확인'],['content','콘텐츠 적합성·병원 정보 확인'],['delivery','발신번호·문구 버전·명단 묶음 확인']
] as const;
export const PROGRAM_SETUP=[
 {purpose:'장기미내원 차트를 정리하고 연락 가능한 전체 대상에게 꾸준히 안내합니다.',source:'최종 내원일·진료 이력·연락 동의·기존 발송·예약 변동',timing:'월·주·일 혼합 배분과 후속 연락 간격'},
 {purpose:'예약 환자에게 병원과 환자 상황에 맞는 안내를 3회 제공합니다.',source:'예약 일시·진료 항목·변경·취소·환자별 준비사항',timing:'예약 확인·전일·당일 3회 시점'},
 {purpose:'진료 후 상태를 확인하고 필요한 다음 예약으로 이어갑니다.',source:'실제 진료·시술일·병원 승인 주의사항·다음 예약',timing:'진료 항목별 상태 확인·후속 예약 시점'},
 {purpose:'상담 내용을 정리하고 당일 맞춤 요약과 후속 상담으로 연결합니다.',source:'상담 내용·관심 항목·미해결 질문·병원 승인 설명',timing:'상담 당일 요약·추가 질문 응대·후속 연락'},
 {purpose:'검사 결과 도착을 안내하고 결과 확인 예약을 연결합니다.',source:'검사 의뢰·결과 도착 상태·의료진 확인·예약 정보',timing:'결과 도착 확인 후 안내·예약 메시지와 중복 조정'}
];
export const blankChecks=()=>CHECKS.map(([id])=>({id,status:'미확인',evidence:'',reviewer:'',checkedAt:''}));
export function validateChecks(raw:any){if(raw==null)return blankChecks();if(!Array.isArray(raw)||raw.length!==CHECKS.length)throw Error('검수 항목 8개를 확인해 주세요.');return CHECKS.map(([id],i)=>{const r=raw[i];if(!r||r.id!==id||!['미확인','확인 중','통과','보류'].includes(r.status))throw Error('검수 항목·상태가 올바르지 않습니다.');for(const key of ['evidence','reviewer','checkedAt'])if(typeof r[key]!=='string'||r[key].length>2000)throw Error('검수 기록 형식을 확인해 주세요.');if(r.status==='통과'&&(!r.evidence.trim()||!r.reviewer.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt)||!Number.isFinite(Date.parse(r.checkedAt))||new Date(r.checkedAt).toISOString().slice(0,10)!==r.checkedAt))throw Error('통과에는 검수 근거·확인자·유효한 확인일이 필요합니다.');return {id,status:r.status,evidence:r.evidence,reviewer:r.reviewer,checkedAt:r.checkedAt};});}
export function readySummary(c:any){const checks=c?.checks||blankChecks();const passed=checks.filter((x:any)=>x.status==='통과'&&x.evidence?.trim()&&x.reviewer?.trim()&&x.checkedAt).length;const ready=passed===8&&!!c?.message?.trim()&&!!c?.messageVersion?.trim()&&Number(c?.stages?.[2]?.count)>0;return {passed,ready};}
export function validateSetup(raw:any){const out:any={};for(const k of ['source','timing','tone','frequency','intensity','responseOwner','exception','basis']){const v=raw?.[k]??'';if(typeof v!=='string'||v.length>4000)throw Error('프로그램 세팅 입력을 확인해 주세요.');out[k]=v;}return out;}
export function invalidateChangedChecks(next:any,previous:any){if(!next||!previous)return next;const sourceChanged=['emrFiles','emrPatients','emrAsOf','emrBasis','emrReceivedAt','emrSyncNote'].some(k=>(next[k]||'')!==(previous[k]||''));return {...next,onboarding:refreshOnboarding(next.onboarding,previous.onboarding,sourceChanged),cycles:next.cycles.map((c:any)=>{const old=previous.cycles?.find((p:any)=>p.date===c.date&&p.service===c.service);if(!old)return c;const changed=sourceChanged||['message','messageVersion','settings','stages'].some(k=>JSON.stringify(c[k]??(k==='settings'?{}:''))!==JSON.stringify(old[k]??(k==='settings'?{}:'')));return changed?{...c,checks:blankChecks()}:c;})};}
