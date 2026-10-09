import {db,member,owner,record,json,fail,origin,now,HttpError} from '@/lib/server';
import {assertText,assertOrg,mayAssign,mayRecord,validUrl} from '@/lib/policy';
import humans from '@/lib/human-roster';
import {recordMentorSubmission} from '@/lib/mentor';
import {BADGE_PURCHASE_ID,BADGE_COMPARISON_REF,blankBrandPurchase,validateBrandDraft,validateBrandSubmission,canRecordTransfer,canClosePurchase,type BrandPurchase} from '@/lib/brand-purchase';
export const dynamic='force-dynamic';
const staff=[...humans.map(h=>h.id),'do','kyunghwa','parttime','parttime_am','parttime_pm','human-035f1152-71dc-42bc-972b-5f6ffbe3bf77','human-6d5d7680-9693-4df0-8aca-4389892bbe14'];
const kinds=['attendance','leave','payment','device','account','job','access','handover','profile'];
function manages(m:any){return m.role==='DO'}
function canRead(m:any,r:any){return m.role==='DO'||(manages(m)&&r.kind!=='job')||(r.person===m.person&&r.kind!=='handover'&&(r.org!=='DSS'||manages(m)||['attendance','leave','payment','profile','device','account'].includes(r.kind)))}
function text(v:any,label:string,required=false,max=5000){return assertText(v??'',label,max,required)}
function day(v:any){const s=text(v,'날짜',true,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('날짜를 확인해 주세요.');return s}
function kstDay(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10)}
function amount(v:any,max=1000000000){const n=Number(v);if(!Number.isFinite(n)||n<0||n>max)throw Error('숫자 범위를 확인해 주세요.');return n}
function parse(r:any){return {...r,data:JSON.parse(r.data),history:JSON.parse(r.history)}}
async function save(r:any,d:any,m:any,action:string){const h=[...r.history,{at:now(),actor:m.id,action,before:r.data,after:d}];const result=await db().prepare('UPDATE control_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(d),JSON.stringify(h),now(),r.id,r.version).run();if(!result.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');return json({ok:true})}
async function insert(kind:string,person:string,org:string,d:any,m:any,dedup?:string){const ts=now();const values=[kind,person,org,JSON.stringify(d),JSON.stringify([{at:ts,actor:m.id,action:'등록',after:d}]),dedup||null,ts,ts];const statement=kind==='attendance'?db().prepare("INSERT INTO control_entries (kind,person,org,data,history,dedup,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM control_entries WHERE kind='attendance' AND person=? AND json_extract(data,'$.end')='')").bind(...values,person):db().prepare('INSERT INTO control_entries (kind,person,org,data,history,dedup,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(...values);const out=await statement.run();if(!out.meta.changes)throw new HttpError(409,'이전 근무가 아직 끝나지 않았습니다. 해당 기록에서 퇴근해 주세요.');return json({id:out.meta.last_row_id},201)}
export async function GET(){try{const m=await member();const out=await db().prepare('SELECT * FROM control_entries ORDER BY id DESC').all<any>();const taskRows=await db().prepare("SELECT id,kind,org,assignee,data,version FROM records WHERE kind='task'").all<any>();const taskMap=new Map(taskRows.results.map(t=>[t.id,t]));const visible=out.results.filter(r=>canRead(m,r)&&(r.kind!=='job'||(taskMap.has(JSON.parse(r.data).taskId)&&mayRecord(m,taskMap.get(JSON.parse(r.data).taskId)!))));const bridge=m.role==='DO'?await db().prepare("SELECT value FROM settings WHERE key='mac_bridge'").first<any>():null;return json({people:humans.filter(h=>m.role==='DO'||h.id===m.person).map(h=>({id:h.id,name:h.name,grade:h.grade})),bridge:bridge?JSON.parse(bridge.value):null,rows:visible.map(r=>({...parse(r),taskVersion:r.kind==='job'?taskMap.get(JSON.parse(r.data).taskId)?.version:undefined})),canManage:manages(m),isDO:m.role==='DO',today:kstDay()})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();const raw=await req.text();if(raw.length>50000)throw Error('내용이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='clockIn'){
  const date=kstDay();const dedup=`attendance:${m.id}:${date}`;const old=await db().prepare('SELECT id FROM control_entries WHERE dedup=?').bind(dedup).first();if(old)return json({ok:true,existing:true});
  try{return await insert('attendance',m.person,'DSS',{date,start:now(),end:'',breaks:[],status:'근무 중',note:''},m,dedup)}catch(e){const exists=await db().prepare('SELECT id FROM control_entries WHERE dedup=?').bind(dedup).first();if(exists)return json({ok:true,existing:true});throw e}
 }
 if(b.action==='purchaseDraft'){
  owner(m);const existing=await db().prepare("SELECT id FROM control_entries WHERE kind='payment' AND json_extract(data,'$.purchase.id')=?").bind(BADGE_PURCHASE_ID).first<any>();
  if(existing)return json({id:existing.id,existing:true});
  return insert('payment',m.person,'DO',{title:'직원 사원증·줄 제작',payee:'업체 미정',amount:0,due:'',reason:'브랜드 사원증 초판 발주 준비',proof:BADGE_COMPARISON_REF,comparisonRef:BADGE_COMPARISON_REF,status:'비교견적 준비',purchase:blankBrandPurchase()},m,'purchase:'+BADGE_PURCHASE_ID);
 }
 if(b.action==='create'){
  const kind=String(b.kind);if(!kinds.includes(kind)||kind==='attendance')throw Error('등록 종류를 확인해 주세요.');const a=b.data||{};let person=m.person;let org='DSS';let d:any={};
  if(['device','account','profile','handover'].includes(kind)){if(!manages(m))throw new HttpError(403,'DSS 담당 업무입니다.');person=text(a.person,'담당자',true);if(!staff.includes(person))throw Error('담당자를 확인해 주세요.');}
  if(kind==='leave'){d={start:day(a.start),end:day(a.end),hours:amount(a.hours,744),type:text(a.type,'휴가 구분',true),reason:text(a.reason,'사유'),status:'DO 판단 대기'};if(d.start>d.end||!d.hours)throw Error('휴가 기간과 시간을 확인해 주세요.');}
  if(kind==='payment'){d={title:text(a.title,'지출명',true),payee:text(a.payee,'지급 대상',true),amount:amount(a.amount),due:day(a.due),reason:text(a.reason,'사용 목적',true),proof:text(a.proof,'근거 주소'),status:'DO 판단 대기'};if(!d.amount||!validUrl(d.proof))throw Error('금액과 근거 주소를 확인해 주세요.');}
  if(kind==='device'){d={title:text(a.title,'기기명',true),type:text(a.type,'기기 역할',true),os:text(a.os,'운영체제',true),location:text(a.location,'위치'),policy:'ERP·AI·승인된 업무 사이트',status:'연결 전',evidence:''};}
  if(kind==='account'){d={title:text(a.title,'서비스명',true),login:text(a.login,'업무 계정 식별자',true),recovery:'DO 관리',device:text(a.device,'사용 기기'),purpose:text(a.purpose,'업무 범위',true),status:'회수 준비 필요',evidence:''};}
  if(kind==='profile'){owner(m);d={title:text(a.title,'표시 이름',true),joined:day(a.joined),contract:text(a.contract,'고용 구분',true),hours:amount(a.hours,168),leaveHours:amount(a.leaveHours,10000),note:text(a.note,'근무 기준'),status:'재직'};}
  if(kind==='handover'){owner(m);d={title:text(a.title,'회수 사유',true),erp:false,mac:false,ai:false,files:false,recovery:false,status:'회수 진행',evidence:''};}
  if(kind==='access'){org=assertOrg(a.org);if(!mayAssign(org,m.person))throw new HttpError(403,'해당 조직에 요청할 수 없습니다.');d={url:text(a.url,'필요한 사이트',true),reason:text(a.reason,'업무상 필요',true),until:day(a.until),status:'DO 판단 대기'};if(!validUrl(d.url))throw Error('사이트 주소를 확인해 주세요.');}
  if(kind==='job'){
   const t=await record(Number(a.taskId),m);if(t.kind!=='task'||['완료','보류','등록 판단 대기'].includes(t.data.status))throw Error('진행 중인 업무번호가 필요합니다.');org=t.org;
   d={taskId:t.id,title:t.data.title,type:text(a.type,'제작 구분',true),instruction:text(a.instruction,'AI 지시',true,20000),machine:text(a.machine,'맥서버 계정·기기'),result:'',proof:'',status:'맥서버 배정 요청',connection:'미연결 · 실제 실행은 별도 기록'};
  }
  if(kind==='profile'){const old=await db().prepare("SELECT id FROM control_entries WHERE kind='profile' AND person=?").bind(person).first();if(old)throw Error('이미 근무 기준이 있습니다. 기존 기록에서 수정해 주세요.');}return insert(kind,person,org,d,m,kind==='profile'?'profile:'+person:undefined);
 }
 const rawEntry=await db().prepare('SELECT * FROM control_entries WHERE id=?').bind(Number(b.id)).first<any>();if(!rawEntry||!canRead(m,rawEntry))throw new HttpError(404,'기록을 찾을 수 없습니다.');const r=parse(rawEntry);if(r.version!==Number(b.version))throw new HttpError(409,'다른 변경이 먼저 저장됐습니다.');const d={...r.data};
 if(String(b.action).startsWith('purchase')){
  owner(m);if(r.kind!=='payment'||d.purchase?.id!==BADGE_PURCHASE_ID)throw new HttpError(400,'브랜드 구매건을 확인해 주세요.');
  const p:BrandPurchase={...d.purchase};
  if(['purchaseEdit','purchaseRevise'].includes(b.action)){
   const revise=b.action==='purchaseRevise';
   if(revise){if(d.status!=='승인'||p.order)throw Error('발주 전 승인된 구매건만 변경 후 재상신할 수 있습니다.');}
   else if(!['비교견적 준비','반려'].includes(d.status))throw Error('결재 상신 후에는 비교견적을 수정할 수 없습니다.');
   const x=b.purchase||{};p.design=text(x.design,'디자인 상태',true,2000);p.spec=text(x.spec,'제작 규격',true,2000);p.reorderVersion=text(x.reorderVersion,'재주문 버전',true,100);
   if(!Array.isArray(x.quotes)||x.quotes.length!==3)throw Error('비교업체 3곳을 등록해 주세요.');
   p.quotes=x.quotes.map((q:any)=>({vendor:text(q.vendor,'업체명',false,200),status:String(q.status||'문의대기'),supply:amount(q.supply||0),vat:amount(q.vat||0),shipping:amount(q.shipping||0),quoteRef:text(q.quoteRef,'견적 근거',false,1000),receivedDate:text(q.receivedDate,'견적 수취일',false,10),validUntil:text(q.validUntil,'견적 유효기간',false,10),publicReference:text(q.publicReference,'공개가격 참고',false,1000)}));
   p.recommended=x.recommended===null||x.recommended===''?null:Number(x.recommended);validateBrandDraft(p);d.purchase=p;
   if(revise){const choice=validateBrandSubmission(p);d.payee=choice.vendor;d.amount=choice.amount;d.due=day(b.due);d.proof=p.quotes[p.recommended!].quoteRef;d.status='DO 판단 대기';d.decision='';d.decidedAt='';d.revisionReason=text(b.reason,'변경·재상신 사유',true,1000);return save(r,d,m,'승인 후 변경 · 재상신');}
   d.status='비교견적 준비';return save(r,d,m,'브랜드 규격·3곳 비교견적 갱신');
  }
  if(b.action==='purchaseSubmit'){
   if(d.status!=='비교견적 준비')throw Error('비교견적 준비 기록을 선택해 주세요.');
   const choice=validateBrandSubmission(p);d.payee=choice.vendor;d.amount=choice.amount;d.due=day(b.due);d.proof=p.quotes[p.recommended!].quoteRef;d.status='DO 판단 대기';d.purchase=p;return save(r,d,m,'비용보고·지출결의 상신');
  }
  if(b.action==='purchaseOrder'){
   if(d.status!=='승인')throw Error('전무 승인 후에만 발주를 기록할 수 있습니다.');validateBrandSubmission(p);p.order={ref:text(b.ref,'실제 발주 근거',true,1000),date:day(b.date)};d.purchase=p;d.status='발주 기록';return save(r,d,m,'승인 후 실제 발주 근거 기록');
  }
  if(b.action==='purchaseInvoice'){
   if(!p.order||!['발주 기록','지급 기록','수령 검수'].includes(d.status))throw Error('발주 기록을 먼저 확인해 주세요.');
   const total=amount(b.amount);if(!total)throw Error('계산서 금액을 확인해 주세요.');const expected=p.quotes[p.recommended!].supply+p.quotes[p.recommended!].vat;
   const differenceReason=text(b.differenceReason,'금액 차이 사유',total!==expected,1000);
   p.invoice={number:text(b.number,'세금계산서 승인번호',true,200),ref:text(b.ref,'계산서 수취 근거',true,1000),date:day(b.date),amount:total,differenceReason};d.purchase=p;if(!p.bank)d.status='계산서 수취';return save(r,d,m,'세금계산서 실제 수취 확인');
  }
  if(b.action==='purchaseBank'){
   if(!p.order||!['발주 기록','계산서 수취','수령 검수'].includes(d.status))throw Error('전무 승인·발주 기록 후에만 이체 결과를 남길 수 있습니다.');
   p.bank={accountVerificationRef:text(b.accountVerificationRef,'업체 계좌 등록·검증 근거',true,1000),transferRef:text(b.transferRef,'법인 이체번호',true,200),transferDate:day(b.transferDate),amount:amount(b.amount),invoiceAfterReason:text(b.invoiceAfterReason,'계산서 후수취 거래조건·예외근거',false,1000),invoiceDueDate:p.invoice?'':day(b.invoiceDueDate)};
   canRecordTransfer(p);if(p.bank.amount!==d.amount)throw Error('실제 이체액과 승인액이 다릅니다. 차액을 먼저 검토해 주세요.');
   const duplicate=await db().prepare("SELECT id FROM control_entries WHERE kind='payment' AND id<>? AND json_extract(data,'$.purchase.bank.transferRef')=?").bind(r.id,p.bank.transferRef).first();if(duplicate)throw Error('이미 다른 구매건에 사용된 이체번호입니다.');
   d.purchase=p;d.paidAt=now();d.status='지급 기록';return save(r,d,m,'법인 계좌이체 결과·증빙 기록');
  }
  if(b.action==='purchaseReceive'){
   if(!p.order||!['발주 기록','계산서 수취','지급 기록'].includes(d.status))throw Error('발주 후 수령 검수를 기록해 주세요.');p.receipt={date:day(b.date),inspectionRef:text(b.ref,'수령·품질 검수 근거',true,1000)};d.purchase=p;if(!p.bank)d.status='수령 검수';return save(r,d,m,'수령 검수 결과 기록');
  }
  if(b.action==='purchaseClose'){
   canClosePurchase(p);if(d.status!=='지급 기록'&&d.status!=='수령 검수')throw Error('지급·수령 검수 상태를 확인해 주세요.');d.status='완료';return save(r,d,m,'계산서·이체·검수 대조 후 마감');
  }
  throw Error('지원하지 않는 브랜드 구매 동작입니다.');
 }
 if(b.action==='profileUpdate'){owner(m);if(r.kind!=='profile')throw Error('직원 근무 기준을 선택해 주세요.');d.hours=amount(b.hours,168);d.leaveHours=amount(b.leaveHours,10000);d.note=text(b.note,'변경 근거',true);return save(r,d,m,'근무 기준 수정');}
 if(b.action==='clock'){
  if(r.kind!=='attendance'||r.person!==m.person)throw new HttpError(403,'본인 근태만 기록할 수 있습니다.');if(d.end)throw Error('이미 퇴근한 기록입니다.');const breaks=[...d.breaks];const last=breaks.at(-1);
  if(b.choice==='휴게 시작'){if(last&&!last.end)throw Error('이미 휴게 중입니다.');breaks.push({start:now(),end:''});d.status='휴게 중';}
  else if(b.choice==='휴게 종료'){if(!last||last.end)throw Error('진행 중인 휴게가 없습니다.');last.end=now();d.status='근무 중';}
  else if(b.choice==='퇴근'){if(last&&!last.end)last.end=now();d.end=now();d.status='퇴근';}
  else throw Error('근태 동작을 확인해 주세요.');d.breaks=breaks;return save(r,d,m,b.choice);
 }
 if(b.action==='correction'){
  if(r.kind!=='attendance')throw Error('근태 기록을 선택해 주세요.');if(m.role!=='DO'){if(r.person!==m.person)throw new HttpError(403,'본인 기록만 요청할 수 있습니다.');d.correction=text(b.note,'정정 요청',true);d.correctionStatus='DO 판단 대기';return save(r,d,m,'근태 정정 요청');}
  const start=text(b.start,'수정 출근',true),end=text(b.end,'수정 퇴근',true);if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))throw Error('수정 시각을 확인해 주세요.');if(new Date(Date.parse(start)+9*3600000).toISOString().slice(0,10)!==d.date)throw Error('출근일이 달라지는 정정은 기존 기록에 적용할 수 없습니다. 근무일을 확인해 주세요.');d.start=new Date(start).toISOString();d.end=new Date(end).toISOString();d.breaks=[];d.correctedBreakMinutes=amount(b.breakMinutes,1440);if(d.correctedBreakMinutes*60000>Date.parse(end)-Date.parse(start))throw Error('휴게시간을 확인해 주세요.');d.status='퇴근';d.correctionStatus='DO 정정 완료';d.correctionNote=text(b.note,'정정 근거',true);return save(r,d,m,'DO 근태 정정');
 }
 if(b.action==='decision'){
  owner(m);if(!['leave','payment','access'].includes(r.kind)||d.status!=='DO 판단 대기')throw Error('판단 대기 기록을 선택해 주세요.');if(!['승인','반려'].includes(b.choice))throw Error('판단을 선택해 주세요.');d.status=b.choice;d.decision=text(b.note,'판단 내용',true);d.decidedAt=now();return save(r,d,m,'DO '+b.choice);
 }
 if(b.action==='cancel'){
  if(!['leave','payment','access'].includes(r.kind)||(r.person!==m.person&&m.role!=='DO')||!['DO 판단 대기','승인'].includes(d.status))throw Error('취소 가능한 본인 요청인지 확인해 주세요.');d.status='취소';d.cancelReason=text(b.note,'취소 사유',true);return save(r,d,m,'요청 취소');
 }
 if(b.action==='paid'){
  if(d.purchase)throw Error('브랜드 구매건은 계좌·계산서 검증 후 구매 흐름에서 이체 기록을 남겨 주세요.');
  if(r.kind!=='payment'||!manages(m)||d.status!=='승인')throw new HttpError(403,'승인된 지출을 DSS가 기록할 수 있습니다.');d.proof=text(b.proof,'실제 지급 증빙 주소',true);if(!validUrl(d.proof))throw Error('증빙 주소를 확인해 주세요.');d.paidAt=now();d.status='지급 기록';d.note=text(b.note,'실제 지급 내용',true);return save(r,d,m,'지급 증빙 기록');
 }
 if(b.action==='jobUpdate'){
  if(r.kind!=='job')throw Error('제작 요청을 선택해 주세요.');const task=await record(d.taskId,m);if(!['작업 중','수정 중','결과 보고','중단'].includes(b.status))throw Error('작업 상태를 확인해 주세요.');d.result=text(b.note,'실행·수정·결과 기록',true,20000);d.proof=text(b.proof,'결과 위치');if(d.proof&&!validUrl(d.proof))throw Error('결과 주소를 확인해 주세요.');d.status=b.status;
  if(b.status==='결과 보고'){
   if(task.version!==Number(b.taskVersion))throw new HttpError(409,'원래 지시가 변경됐습니다. 최신 내용을 확인해 주세요.');if(['완료','보류','등록 판단 대기'].includes(task.data.status))throw Error('결과를 받을 수 없는 업무 상태입니다.');
   const td={...task.data,result:d.result,resultUrl:d.proof,revision:task.data.revision+1,approvedRevision:null,execution:'',status:'DO 판단 대기',waitFor:'DO',waitSince:now()};recordMentorSubmission(td,task,m.person,now(),'맥 제작 결과 보고');const history=[...r.history,{at:now(),actor:m.id,action:'AI 제작 결과·DO 보고',after:d}];
   const result=await db().batch([
    db().prepare('UPDATE records SET data=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM control_entries WHERE id=? AND version=?)').bind(JSON.stringify(td),now(),task.id,task.version,r.id,r.version),
    db().prepare('UPDATE control_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=? AND changes()>0').bind(JSON.stringify(d),JSON.stringify(history),now(),r.id,r.version),
    db().prepare('INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0').bind(task.id,task.org,m.id,'AI 제작 결과·DO 보고',JSON.stringify({text:d.result,url:d.proof,revision:td.revision}),now())]);if(!result[0].meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다.');return json({ok:true});
  }
  return save(r,d,m,'AI 제작 '+b.status);
 }
 if(b.action==='deviceUpdate'){
  if(!manages(m)||!['device','account'].includes(r.kind))throw new HttpError(403,'DSS 담당 업무입니다.');const allowed=r.kind==='device'?['연결 전','설정 진행','업무용 설정 확인','회수 완료']:['회수 준비 필요','회사 소유 확인','회수 완료'];if(!allowed.includes(b.status))throw Error('상태를 확인해 주세요.');d.status=b.status;d.evidence=text(b.note,'실제 확인 근거',true);return save(r,d,m,'기기·계정 확인 기록');
 }
 if(b.action==='handover'){
  owner(m);if(r.kind!=='handover')throw Error('회수 기록을 선택해 주세요.');const keys=['erp','mac','ai','files','recovery'];if(!keys.includes(b.key))throw Error('회수 항목을 확인해 주세요.');const note=text(b.note,'회수 확인 근거',true);
  if(b.key==='erp'&&r.person==='do')throw Error('DO 계정은 회수할 수 없습니다.');
  d[b.key]=true;d.evidence=note;d.status=keys.every(k=>d[k])?'회수 완료':'회수 진행';if(b.key==='erp'){const ts=now(),h=[...r.history,{at:ts,actor:m.id,action:'ERP 접근 중지',before:r.data,after:d}];const out=await db().batch([db().prepare('UPDATE control_entries SET data=?,history=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(d),JSON.stringify(h),ts,r.id,r.version),db().prepare("UPDATE members SET active=0 WHERE person=? AND role!='DO' AND changes()>0").bind(r.person)]);if(!out[0].meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 계정은 중지하지 않았습니다.');return json({ok:true})}return save(r,d,m,b.key==='erp'?'ERP 접근 중지':'외부 회수 확인 기록');
 }
 throw Error('처리할 동작을 확인해 주세요.');
}catch(e){return fail(e)}}
