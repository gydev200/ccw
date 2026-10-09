import {createRecord,db,fail,HttpError,json,member,origin,updateRecord} from '@/lib/server';

export const dynamic='force-dynamic';
const KIND='management_board';
const FIELDS:Record<string,string[]>={
 territory:['title','dbValue','assignment','fairness','contributions','compensation','evaluation','bDefinition','aDefinition','nextAction'],
 wording:['title','region','situation','wording','testPlan','testResult','evidence','nextRevision'],
 meeting:['title','meetingDate','agenda','findings','nextAction'],
 factory:['title','channel','input','production','review','evidenceRef','timeCost','nextAction'],
 order:['title','hospital','channel','brief','due','resultRef','nextAction'],
 exit:['title','path','buyer','interest','evidence','valuation','successCriteria','weeklyAction'],
 skill:['title','situation','opening','question','response','testResult','nextAction'],
 seminar:['title','week','hospitalId','hospitalName','application','attendance','materialRequest','meeting','aEntry','contract','paymentAmount','paymentRef','paymentEvidence','paidAt','nextAction'],
};
const text=(value:unknown,key:string,required=false)=>{if(typeof value!=='string'||value.length>4000||(required&&!value.trim()))throw new HttpError(400,`${key}을 확인해 주세요.`);return value.trim()};
function permitted(m:any,category:string,write=false){
 if(m.role==='DO')return true;
 const access=m.access?.orgs||[];
 if(['territory','exit'].includes(category))return false;
 if(['wording','meeting','skill','seminar'].includes(category))return access.includes('OS');
 if(category==='order')return access.includes('SS')||access.includes('CA');
 if(category==='factory')return !write&&(access.includes('SS')||access.includes('CA'));
 return false;
}
export async function GET(){try{
 const m=await member();
 const rows=(await db().prepare('SELECT id,version,assignee,data,created_at,updated_at FROM records WHERE kind=? ORDER BY id DESC LIMIT 400').bind(KIND).all<any>()).results
  .map(r=>({...r,data:JSON.parse(r.data)})).filter(r=>permitted(m,r.data.category));
 return json({rows,canWrite:Object.keys(FIELDS).filter(k=>permitted(m,k,true)),isDO:m.role==='DO'});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();const raw=await req.text();if(raw.length>30000)throw new HttpError(413,'한 번에 입력할 수 있는 범위를 넘었습니다.');
 const b=JSON.parse(raw),category=String(b.category||'');if(!FIELDS[category]||!permitted(m,category,true))throw new HttpError(403,'이 입력판의 작성 권한이 없습니다.');
 const input=b.data||{},data:any={category,status:text(input.status||'초안','상태'),author:m.person};
 for(const key of FIELDS[category])data[key]=text(input[key]||'',key,key==='title'||(category==='seminar'&&['week','hospitalId'].includes(key)));
 if(!['초안','검토 중','실행 근거 확인','보류','완료'].includes(data.status))throw new HttpError(400,'상태를 확인해 주세요.');
 if(['territory','exit'].includes(category)&&data.status==='완료')throw new HttpError(400,'확정·실행 증빙 전까지 완료로 표시하지 않습니다.');
 if(category==='wording'&&data.status==='실행 근거 확인'&&(!data.evidence||!data.testResult))throw new HttpError(400,'시험 결과의 통화·현장 근거를 연결해 주세요.');
 if(category==='factory'&&!['블로그','인스타그램','영상','공통'].includes(data.channel))throw new HttpError(400,'생산 채널을 선택해 주세요.');
 if(category==='factory'&&data.status==='완료'&&(!data.review||!data.evidenceRef))throw new HttpError(400,'제작 완료는 1인 검수 내용과 결과 근거가 필요합니다.');
 if(category==='order'&&data.status==='완료'&&!data.resultRef)throw new HttpError(400,'주문 완료는 결과·검수 근거가 필요합니다.');
 if(category==='exit'&&!['매각','상장','지속경영'].includes(data.path))throw new HttpError(400,'EXIT 경로를 선택해 주세요.');
 if(category==='seminar'){
  if(!['1','2'].includes(data.week))throw new HttpError(400,'1주차 또는 2주차를 선택해 주세요.');
  if(!/^[\w-]{1,80}$/.test(data.hospitalId))throw new HttpError(400,'병원번호는 영문·숫자·하이픈으로 입력해 주세요.');
  for(const key of ['application','attendance','materialRequest','meeting','aEntry','contract'])if(!['미확인','예','아니오'].includes(data[key]))throw new HttpError(400,`${key} 상태를 확인해 주세요.`);
  if(['paymentAmount','paymentRef','paymentEvidence','paidAt'].some(key=>data[key])){const amount=Number(data.paymentAmount);if(!Number.isSafeInteger(amount)||amount<1||!data.paymentRef||!data.paymentEvidence||!/^\d{4}-\d{2}-\d{2}$/.test(data.paidAt))throw new HttpError(400,'실제 입금은 원 단위 금액·고유 거래번호·입금 근거·입금일이 모두 필요합니다.');}
  if(data.status==='완료'&&data.contract!=='예')throw new HttpError(400,'계약 근거 없이 완료로 표시하지 않습니다.');
 }
 if(b.id){
  const row=await db().prepare('SELECT * FROM records WHERE id=? AND kind=?').bind(Number(b.id),KIND).first<any>();if(!row)throw new HttpError(404,'원본을 찾지 못했습니다.');
  const prior=JSON.parse(row.data);if(prior.category!==category)throw new HttpError(409,'분류가 다른 원본입니다.');
  if(m.role!=='DO'&&prior.author!==m.person)throw new HttpError(403,'작성자 본인의 기록만 수정할 수 있습니다.');
  if(row.version!==b.version)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 최신 내용을 확인해 주세요.');
  data.author=prior.author;const updated=await updateRecord(row,data,m,'경영 입력판 수정',{category,before:prior,after:data});return json({id:updated.id,version:updated.version});
 }
 if(typeof b.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestId))throw new HttpError(400,'저장 요청을 다시 시작해 주세요.');
 const dedup=`management-board:${b.requestId}`;
 const found=await db().prepare('SELECT id,version FROM records WHERE dedup=?').bind(dedup).first<any>();if(found)return json({id:found.id,version:found.version,repeated:true});
 const id=await createRecord(KIND,category==='factory'||category==='exit'||category==='territory'?'DO':category==='order'?'SS':'OS',m.person,data,m,dedup);return json({id,version:1});
}catch(e){return fail(e)}}
