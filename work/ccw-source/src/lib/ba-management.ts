export const BA_SERVICES=['진료 후 케어','예약 맞춤 안내','검사 결과 알림','상담 후 안내','장기미내원 관리','CTI','해외환자 번역'] as const;
export const BA_STAGES=['B1 준비','B1 전달','B2 요청','B2 맞춤 제작','B2 검수','B2 전달','EMR 인수 협의','SS 인계'] as const;
export const BA_REQUEST_TYPES=['기본 이식','병원별 맞춤','서비스 추가','모노디맨드'] as const;
export type BAData={slug:string;services:string[];stage:string;requestType:string;request:string;nextAction:string;due:string;sourceVersion:number;reviewRound:number;reviewStatus:string;editorUrl:string;bCall:string;cCall:string;reviewedBy:string;reviewedAt:string};
const short=(v:any,n=2000)=>{if(typeof v!=='string'||v.length>n)throw Error('입력 길이와 형식을 확인해 주세요.');return v.trim()};
export function validateBA(raw:any,previous:BAData|null,actor:{id:string;role:string},slugs:string[]):BAData{
 if(!raw||typeof raw!=='object'||!slugs.includes(raw.slug)||!BA_STAGES.includes(raw.stage)||!BA_REQUEST_TYPES.includes(raw.requestType))throw Error('병원·진행 단계·요청 종류를 확인해 주세요.');
 if(!Array.isArray(raw.services)||!raw.services.length||raw.services.some((x:any)=>!BA_SERVICES.includes(x)))throw Error('관련 서비스를 선택해 주세요.');
 const data:any={services:[...new Set(raw.services)],slug:raw.slug,stage:raw.stage,requestType:raw.requestType};
 for(const k of ['request','nextAction','due','editorUrl','bCall','cCall'])data[k]=short(raw[k]||'',k==='due'?10:k==='editorUrl'?1500:4000);
 if(data.due&&(!/^20\d{2}-\d{2}-\d{2}$/.test(data.due)||!Number.isFinite(Date.parse(data.due))||new Date(data.due).toISOString().slice(0,10)!==data.due))throw Error('기한을 확인해 주세요.');
 if(data.editorUrl){const u=new URL(data.editorUrl);if(u.origin!=='https://chartclean-b2.happyshs747.chatgpt.site'||u.pathname!=='/chaenggyeo/sales-preview-admin'||u.searchParams.get('clinic')!==data.slug)throw Error('해당 병원의 B2 관리자 주소만 연결할 수 있습니다.');}
 data.sourceVersion=Number(raw.sourceVersion||0);if(!Number.isInteger(data.sourceVersion)||data.sourceVersion<0)throw Error('편집본 버전을 확인해 주세요.');
 data.reviewRound=raw.reviewRound;if(!Number.isInteger(data.reviewRound)||data.reviewRound<1||data.reviewRound>999)throw Error('검수 차수는 1~999 사이 정수입니다.');
 if(previous&&data.reviewRound<previous.reviewRound)throw Error('이전 검수 차수로 되돌릴 수 없습니다.');
 if(!['미검수','검수 중','보완 필요','통과'].includes(raw.reviewStatus))throw Error('검수 상태를 확인해 주세요.');
 const changed=!!previous&&['slug','services','requestType','request','editorUrl','reviewRound','sourceVersion'].some(k=>JSON.stringify(data[k])!==JSON.stringify((previous as any)[k]));
 data.reviewStatus=changed?'미검수':raw.reviewStatus;
 if(data.reviewStatus==='통과'&&actor.role!=='DO')throw Error('검수 통과 확정은 DO 권한이 필요합니다.');
 if(data.reviewStatus==='통과'&&(!data.editorUrl||!data.request||!data.sourceVersion))throw Error('검수 근거로 맞춤 요청과 확인한 편집본 주소를 기록해 주세요.');
 data.reviewedBy=data.reviewStatus==='통과'?actor.id:'';data.reviewedAt=data.reviewStatus==='통과'?new Date().toISOString():'';
 if(['B2 전달','SS 인계'].includes(data.stage)&&data.reviewStatus!=='통과')throw Error('검수 통과 후 전달·인계 단계로 이동해 주세요.');
 return data;
}
export function blankBA(slug:string):BAData{return {slug,services:[...BA_SERVICES.slice(0,5)],stage:'B2 요청',requestType:'기본 이식',request:'',nextAction:'',due:'',sourceVersion:0,reviewRound:1,reviewStatus:'미검수',editorUrl:'',bCall:'',cCall:'',reviewedBy:'',reviewedAt:''};}
