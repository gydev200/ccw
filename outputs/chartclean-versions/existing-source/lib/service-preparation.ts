import {validateServiceReview,SERVICES} from './service-review';
import {blankOnboarding} from './hospital-onboarding';
const profileKeys=['emrVendor','collectionMethod','collectionSchedule','securityBasis'];
const text=(v:any,max=2000)=>{if(typeof v!=='string'||v.length>max)throw Error('준비 계획의 글자 수·형식을 확인하세요.');return v.trim()};
const append=(old:string,next:string)=>!next||old?.includes(next)?old||'':old?old+'\n'+next:next;
/** Preparation only. Imported files cannot assert completion, receipt, consent or send approval. */
export function mergeServicePreparation(input:any,clinicName:string,review:any){
 if(!input||input.schema!=='ccw.service-preparation.v1'||input.clinicName!==clinicName)throw Error('선택한 병원의 준비 계획 파일이 아닙니다.');
 if(Object.keys(input).some(k=>!['schema','clinicName','profile','servicePlans','collectionActions','serviceActions'].includes(k)))throw Error('허용되지 않은 항목입니다. 환자 자료·키·완료 기록은 가져올 수 없습니다.');
 const onboarding=structuredClone(review.onboarding||blankOnboarding());
 if(!input.profile||Object.keys(input.profile).some(k=>!profileKeys.includes(k)))throw Error('수집 정보 항목 오류');
 for(const k of profileKeys)onboarding[k]=append(onboarding[k],text(input.profile[k]||'',k==='emrVendor'||k==='collectionSchedule'?200:2000));
 const plans={...review.servicePlans};if(!input.servicePlans||Object.keys(input.servicePlans).some(k=>!SERVICES.includes(k)))throw Error('서비스 항목 오류');
 for(const [name,p] of Object.entries<any>(input.servicePlans)){
  if(!p||Object.keys(p).some(k=>!['hospitalNeed','ourWork','next','assignee','collaborator','due'].includes(k)))throw Error('준비 항목 오류');
  const old=plans[name]||{};plans[name]={};for(const k of ['hospitalNeed','ourWork','next'])plans[name][k]=append(old[k],text(p[k]||''));
  for(const k of ['assignee','collaborator','due'])plans[name][k]=old[k]||text(p[k]||'',k==='due'?10:100);
 }
 if(!Array.isArray(input.collectionActions)||input.collectionActions.length!==7)throw Error('수집 준비 7단계를 확인하세요.');
 onboarding.collection=onboarding.collection.map((s:any,i:number)=>({...s,nextAction:append(s.nextAction,text(input.collectionActions[i]))}));
 if(!Array.isArray(input.serviceActions)||input.serviceActions.length!==5)throw Error('5개 서비스 준비를 확인하세요.');
 onboarding.services=onboarding.services.map((s:any,i:number)=>{const actions=input.serviceActions[i];if(!Array.isArray(actions)||actions.length!==5)throw Error('서비스 5단계를 확인하세요.');return {...s,steps:s.steps.map((step:any,j:number)=>({...step,nextAction:append(step.nextAction,text(actions[j]))}))}});
 return validateServiceReview({...review,onboarding,servicePlans:plans});
}
