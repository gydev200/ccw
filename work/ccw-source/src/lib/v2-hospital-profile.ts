export const HOSPITAL_SERVICES=['장기미내원 관리','예약 맞춤 안내','진료 후 케어','상담 후 관리','검사 결과 알림'];
export const DEPARTMENTS=['재활의학과','정형외과','신경외과','마취통증의학과','내과','가정의학과','산부인과','소아청소년과','피부과','성형외과','이비인후과','안과','비뇨의학과','외과','정신건강의학과','치과','한의과'];
export const PREPARATION=['이지행정','서비스 준비','최초 EMR 업로드'];
export function blankProfile(){return {color:'#29486e',director:'',photo:'',logo:'',department:'',contact:'',address:'',emr:'',matchingReviewed:false,matchingUploadIds:[] as string[],previewReviewed:false,services:[] as string[],materials:[] as string[],steps:PREPARATION.map(name=>({name,complete:false,evidence:''})),notes:''};}
export type HospitalProfile=ReturnType<typeof blankProfile>;
export function validateProfile(raw:unknown,materialIds:string[],confirm=false):HospitalProfile {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('병원 설정을 확인해 주세요.');
  const input=raw as Record<string,unknown>;const result=blankProfile();
  for(const key of ['color','director','photo','logo','department','notes','contact','address','emr'] as const){
    const value=input[key]??(['contact','address','emr'].includes(key)?'':undefined);if(typeof value!=='string'||value.length>(['photo','logo'].includes(key)?220000:key==='notes'?3000:100))throw Error('입력 길이를 확인해 주세요.');result[key]=value.trim();
  }
  if(!/^#[0-9a-f]{6}$/i.test(result.color))throw Error('대표 색상을 선택해 주세요.');
  if(result.department&&!DEPARTMENTS.includes(result.department))throw Error('진료과를 선택해 주세요.');
  for(const key of ['photo','logo'] as const){const value=result[key];if(!value)continue;
    if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))continue;
    try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw Error('사진·로고는 이미지 파일 또는 HTTPS 주소를 사용해 주세요.');}
  }
  for(const key of ['services','materials'] as const){const values=input[key];const allowed=key==='services'?HOSPITAL_SERVICES:materialIds;
    if(!Array.isArray(values)||values.some(v=>typeof v!=='string'||!allowed.includes(v))||new Set(values).size!==values.length)throw Error('서비스·소재 선택을 확인해 주세요.');result[key]=values;
  }
  if(result.department!=='재활의학과'&&result.materials.length)throw Error('현재 소재는 재활의학과에만 등록되어 있습니다.');
  if(!Array.isArray(input.steps)||input.steps.length!==3)throw Error('세팅 진행을 확인해 주세요.');
  result.steps=input.steps.map((s,i)=>{if(!s||s.name!==PREPARATION[i]||typeof s.complete!=='boolean'||typeof s.evidence!=='string'||s.evidence.length>2000)throw Error('세팅 진행을 확인해 주세요.');if(s.complete&&!s.evidence.trim())throw Error('완료 항목에는 확인 근거를 기록해 주세요.');return {name:PREPARATION[i],complete:s.complete,evidence:s.evidence.trim()};});
  if(input.matchingUploadIds!==undefined&&(!Array.isArray(input.matchingUploadIds)||input.matchingUploadIds.length>2||input.matchingUploadIds.some(v=>typeof v!=='string'||!/[a-f0-9-]{36}/.test(v))))throw Error('리스트 검토 정보를 확인해 주세요.');result.matchingUploadIds=(input.matchingUploadIds||[]) as string[];
  for(const key of ['matchingReviewed','previewReviewed'] as const){if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('검토 상태를 확인해 주세요.');result[key]=input[key]===true;}
  if(confirm&&(!result.matchingReviewed||!result.previewReviewed))throw Error('소재 비교·매칭 검토와 최종 화면 확인을 완료해 주세요.');
  if(confirm&&(!result.director||!result.department||!result.logo||!result.photo||!result.services.length||result.steps.some(s=>!s.complete)))throw Error('원장 정보·사진·로고·진료과·제공 서비스와 세 가지 준비 완료를 확인해 주세요.');
  return result;
}
