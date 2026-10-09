import {validateOnboarding} from './hospital-onboarding';
import {validateReporting} from './hospital-reporting';
import {validateChecks,validateSetup} from './service-workflow';
import {validateOperations} from './service-operations';
export const REVIEW_STAGES=['대상 분류','우선순위 선정','맞춤 준비','검수','발송 승인 대기'];
export const SERVICES=['장기미내원 관리','예약 맞춤 안내','진료 후 케어','상담 후 관리','검사 결과 알림','CTI · 구상','해외환자 번역 · 구상'];
export const SERVICE_PRIORITY=[2,1,4,3,0,5,6] as const;
export const koreaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function blankCycle(date=koreaDate()){return {date,service:SERVICES[0],setupStatus:'현황 확인 필요',target:'30',owner:'',nextAction:'',message:'',messageVersion:'',evidence:'',stages:REVIEW_STAGES.map(name=>({name,count:'',held:'',rule:'',sort:'',status:'미확인',note:''}))};}
export function initialReview(name:string):any{
 const floce=/플로체|플로츠/.test(name),planme=/플랜미/.test(name);const cycle=blankCycle('2026-09-14');
 if(floce||planme){cycle.setupStatus='세팅·운영 병행';cycle.nextAction='최신 내원·예약·수신거부 변동 확인 및 환자 화면 검수';cycle.evidence='2026-09-14 기존 발송 기록·선정 자료 대조. 아래 숫자는 당일 발송 실적이 아님.';
 cycle.stages[0]={name:REVIEW_STAGES[0],count:planme?'37':'154',held:'',rule:planme?'기존 중간 후보에서 운영 등록·발송 이력 대조 후 미등록 후보':'완료 진료·연락처·기존 제외 조건 대조. 9월 11일 분석본',sort:'기존 선정 자료 순서',status:'추가 확인',note:'자료 기준일 이후 변경 확인 필요'};
 cycle.stages[1]={name:REVIEW_STAGES[1],count:planme?'30':'21',held:planme?'4':'9',rule:planme?'결제 변경만 있는 방문·경과 방문·대리 방문·제품 불명확 4명 보류. 3명 순위 대기':'시술·기기 치료 근거가 있는 후보 선정. 부족 9명',sort:planme?'기존 후보 순서: 과거 시술 항목 단가 높은 순':'시술일과 최종 내원일 일치 우선 → 최근 내원 순',status:'추가 확인',note:'확정 발송 대상이 아닌 예비 선정'};
 cycle.stages[2]={name:REVIEW_STAGES[2],count:planme?'':'21',held:'',rule:'환자·진료 근거·문구·개인 링크·콘텐츠 연결 대조',sort:'선정 순서 유지',status:planme?'미확인':'진행 중',note:planme?'신규 개인 화면·링크 생성 전':'저장 검토본 일치 확인. 현재 환자 화면 최종 확인 전'};
 cycle.stages[3]={name:REVIEW_STAGES[3],count:'',held:'',rule:'최신 변동·연락 목적·문구·개인 화면·반응 연결 확인',sort:'미확인·보류 항목 먼저',status:'추가 확인',note:'검수 완료 인원 미확정'};
 cycle.stages[4]={name:REVIEW_STAGES[4],count:'0',held:'',rule:'최종 명단·문구·링크·검수 결과를 제시하고 대표 발송 허락',sort:'승인된 묶음별',status:'미확인',note:'실제 발송 승인 전'};}
 const cycles=SERVICES.slice(0,5).map((service,i)=>{if(i===0&&(floce||planme))return cycle;const c=blankCycle('2026-09-14');c.service=service;c.target='';c.nextAction='기본 계약 서비스의 세팅·운영 상태 확인';c.evidence='기본 유료 서비스 1~5번 전체 포함 · 대표님 지시. 구현 및 실제 운영 여부는 별도 확인.';return c;});
 return {emrFiles:floce?'11':'',emrPatients:floce?'2729':planme?'22878':'',emrAsOf:floce?'2026-09-08':planme?'2026-07-09':'',emrBasis:floce?'2026-09-11 시술 중심 선정 자료의 원본 환자 수':planme?'2026-07-09까지 제공된 EMR 분석본':'',sourceCheckedAt:(floce||planme)?'2026-09-14':'',cycles};
}
export function validateServiceReview(raw:any){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('서비스 검수 내용을 확인해 주세요.');
 const txt=(v:any,max=2000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('검수 입력 길이와 형식을 확인해 주세요.');return v};
 const count=(v:any)=>{const s=txt(v,10);if(s!==''&&!/^\d{1,8}$/.test(s))throw Error('인원은 0 이상의 정수로 입력해 주세요.');return s};
 const date=(v:any)=>{const s=txt(v,10);if(s&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s))throw Error('날짜를 확인해 주세요.');return s};
 if(!Array.isArray(raw.cycles)||raw.cycles.length>90)throw Error('운영 회차는 최대 90개까지 저장할 수 있습니다.');
 const seen=new Set();const cycles=raw.cycles.map((c:any)=>{const day=date(c.date);if(!day||!SERVICES.includes(c.service))throw Error('회차 날짜와 서비스를 확인해 주세요.');const key=day+c.service;if(seen.has(key))throw Error('같은 날짜·서비스 회차가 이미 있습니다.');seen.add(key);
 if(!Array.isArray(c.stages)||c.stages.length!==5)throw Error('검수 단계를 확인해 주세요.');
 if(!['현황 확인 필요','세팅 중','세팅·운영 병행','운영 중','보류','종료'].includes(c.setupStatus))throw Error('프로그램 상태를 확인해 주세요.');
 return {checks:validateChecks(c.checks),settings:validateSetup(c.settings),date:day,service:c.service,setupStatus:c.setupStatus,target:count(c.target),owner:txt(c.owner,100),nextAction:txt(c.nextAction),message:txt(c.message,6000),messageVersion:txt(c.messageVersion,200),evidence:txt(c.evidence),stages:c.stages.map((s:any,i:number)=>{if(!['미확인','진행 중','추가 확인','확인 완료'].includes(s.status))throw Error('검수 상태를 확인해 주세요.');return {name:REVIEW_STAGES[i],count:count(s.count),held:count(s.held),rule:txt(s.rule),sort:txt(s.sort),status:s.status,note:txt(s.note)}})};});
 const servicePlans:Record<string,any>={};for(const [k,v] of Object.entries(raw.servicePlans||{})){if(!SERVICES.includes(k))throw Error('서비스 준비 항목 오류');const p:any=v;if(!p||typeof p!=='object')throw Error('준비 계획 형식 오류');servicePlans[k]={hospitalNeed:txt(p.hospitalNeed),ourWork:txt(p.ourWork),next:txt(p.next),assignee:txt(p.assignee,100),collaborator:txt(p.collaborator,100),due:date(p.due)}};
 return {servicePlans,onboarding:validateOnboarding(raw.onboarding),reporting:validateReporting(raw.reporting),emrPullTime:txt(raw.emrPullTime,100),emrReceivedAt:txt(raw.emrReceivedAt,100),emrSyncNote:txt(raw.emrSyncNote),emrFiles:count(raw.emrFiles),emrPatients:count(raw.emrPatients),emrAsOf:date(raw.emrAsOf),emrBasis:txt(raw.emrBasis),sourceCheckedAt:date(raw.sourceCheckedAt),operations:validateOperations(raw.operations),cycles};
}
