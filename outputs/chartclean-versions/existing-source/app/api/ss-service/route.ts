import {db,member,owner,json,fail,HttpError,origin,createRecord,record} from '@/lib/server';
import {blankTask} from '@/lib/model';
export const dynamic='force-dynamic';
const CLINICS:Record<string,string>={floce:'플로체',planme:'플랜미'};
async function access(slug:string){
 if(!CLINICS[slug])throw new HttpError(400,'연결된 병원을 선택해 주세요.');
 const m=await member();
 if(m.role!=='DO'){
  const rows=await db().prepare("SELECT data FROM records WHERE org='SS' AND assignee=? AND kind='customer'").bind(m.person).all<any>();
  if(!rows.results.some((r:any)=>String(JSON.parse(r.data).name||'').includes(CLINICS[slug])))throw new HttpError(403,'이 병원에 배정된 계정만 볼 수 있습니다.');
 }
 return m;
}
export async function GET(req:Request){try{
 const slug=new URL(req.url).searchParams.get('hospital')||'';await access(slug);
 const response=await fetch('https://app-chenggyo.vercel.app/api/chaenggyeo/send/status?hospital='+slug,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new HttpError(502,'발송 기록을 불러오지 못했습니다. 다시 시도해 주세요.');
 const source:any=await response.json();if(!Array.isArray(source.batches))throw new HttpError(502,'발송 기록 형식이 변경되어 확인이 필요합니다.');
 const count=(v:any)=>Number.isSafeInteger(v)&&v>=0?v:0;
 // Never forward patient samples, tokens, or message text to Works.
 const batches=source.batches.map((b:any)=>({id:String(b.batchId),label:String(b.label||'이름 없는 묶음').slice(0,200),people:count(b.people),trial:b.dryRun!==false,status:String(b.status||''),sent:count(b.byStatus?.sent),pending:count(b.byStatus?.pending),excluded:count(b.byStatus?.skipped),failed:count(b.byStatus?.failed)}));
 return json({hospital:CLINICS[slug],slug,checkedAt:new Date().toISOString(),dailyGoal:30,batches,deliveryConfirmed:false});
}catch(e){if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))return fail(new HttpError(504,'발송 기록 서버의 응답이 늦어 조회가 중단됐습니다. 검수 만료와는 별개이며, 발송을 다시 요청하지 말고 기록 새로고침으로 결과를 확인해 주세요.'));return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const body:any=await req.json();const slug=String(body.hospital||'');const m=await access(slug);owner(m);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const key='ss-daily:'+slug+':'+date;
 const previous=await db().prepare('SELECT id FROM records WHERE dedup=?').bind(key).first<any>();
 if(previous){await record(previous.id,m);return json({id:previous.id,existing:true,date});}
 const clinic=CLINICS[slug];
 const data={...blankTask('SS'),assignee:'do',coordinator:'do',customer:clinic,title:clinic+' '+date+' 서비스 · 30명 목표',instruction:'매일 30명을 목표로 하되 최신 내원·예약·수신거부·기존 발송 이력을 대조합니다. 제외·보류·시연 대상과 이미 발송된 대상은 신규 대상으로 사용하지 않습니다. 병원별 승인된 문안과 환자 링크를 확인하고, 유효 대상이 부족하면 부족 인원과 이유를 보고합니다. 발송 후 제공사 접수와 실제 전달 결과를 구분하여 기록합니다.',criterion:'확정 대상·제외 사유·사용 문안·발송 묶음·제공사 접수/전달/실패 결과·환자 반응·다음 행동이 연결됨. 목표 미달을 임의 대상 추가로 채우지 않음.',start:date,due:date,phase:'반복 운영',repeat:'없음',series:'ss-daily:'+slug,status:'지시 등록',sourceUrl:'https://app-chenggyo.vercel.app/chaenggyeo/'+slug+'/staff',nextAction:'최신 대상 변동 확인 및 발송 기록 대조'};
 try{const id=await createRecord('task','SS','do',data,m,key);return json({id,date},201)}catch(e){const existing=await db().prepare('SELECT id FROM records WHERE dedup=?').bind(key).first<any>();if(existing)return json({id:existing.id,existing:true,date});throw e}
}catch(e){return fail(e)}}
