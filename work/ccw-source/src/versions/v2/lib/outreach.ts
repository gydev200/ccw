import {OP_ACTIVITIES} from './os-roles';
export const B_CALL_PURPOSES=[...OP_ACTIVITIES,'일반 연락','B1 레퍼런스','B2 맞춤 제안','EMR 요청'];
export const A_CALL_PURPOSES=['분석 결과 설명','계약 후속','서류 보완'];
export const OUTREACH_KINDS=['issue','building','shift','delivery','call','document','trial','planning','quality','kpi','location','stock','target','connection'] as const;
export type OutreachKind=typeof OUTREACH_KINDS[number];
export const KIND_ORG:Record<OutreachKind,string>={issue:'PM',building:'DM',shift:'DM',delivery:'DM',call:'OS',document:'OS',trial:'OS',planning:'PM',quality:'PM',kpi:'PM',location:'DM',stock:'DM',target:'DM',connection:'OS'};
export function canWrite(m:any,k:string){if(m.role==='DO')return true;const orgs=m.access?.orgs||[];return (['building','shift','delivery','location','stock','target'].includes(k)?orgs.includes('DM')||orgs.includes('OS'):['call','document','trial','connection'].includes(k)?orgs.includes('OS'):orgs.includes('PM'));}
export function canRead(m:any){return m.active===1&&(m.role==='DO'||(m.access?.orgs||[]).some((o:string)=>['DM','OS','PM','SS'].includes(o)));}
const text=(v:any,n=4000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>n)throw Error('입력 길이와 형식을 확인해 주세요.');return v.trim();};
const count=(v:any,max=100000)=>{if(v===''||v==null)return 0;v=Number(v);if(!Number.isSafeInteger(v)||v<0||v>max)throw Error('수량은 0 이상의 정수로 입력해 주세요.');return v;};
const date=(v:any)=>{v=text(v,10);if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v).toISOString().slice(0,10)!==v))throw Error('날짜를 확인해 주세요.');return v;};
const url=(v:any)=>{v=text(v,2000);if(v){const u=new URL(v);if(u.protocol!=='https:')throw Error('자료 주소는 https 주소로 입력해 주세요.');}return v;};
export function validateOutreach(kind:string,raw:any,prev:any=null){
 if(!OUTREACH_KINDS.includes(kind as any)||!raw||typeof raw!=='object')throw Error('업무 종류와 내용을 확인해 주세요.');const d:any={};
 const specs:Record<string,string[]>={issue:['title','topic','focus','copy','offer','questions','answers','status','owner','period'],building:['buildingId','stairs','elevator','office','entrance','notes','owner','focus'],shift:['title','worker','mode','equipment','status','clusters'],delivery:['hospitalId','buildingId','shiftId','status','recipient','notes','interests'],call:['hospitalId','outcome','recipient','reaction','usedCopy','nextAction','owner','bStep','reference','doNotContact','interests','receiptStatus'],document:['hospitalId','name','status','missing','owner','sourceName','notes'],trial:['hospitalId','status','owner','result','expectation','contractRef','nextAction'],planning:['title','category','brief','status','owner','result'],quality:['title','scope','criteria','status','evidence','owner','action','versionLabel'],kpi:['title','org','unit','basis','owner','action'],stock:['type','note'],target:['buildingId','cluster','owner','status','notes'],location:['shiftId'],connection:['hospitalId']};
 for(const k of specs[kind])d[k]=text(raw[k]);
 if(kind==='shift'){
  d.workerType=text(raw.workerType,10);if(d.workerType&&!['직원','긱'].includes(d.workerType))throw Error('인력 구분을 확인해 주세요.');
  d.startTime=text(raw.startTime,5);d.endTime=text(raw.endTime,5);
  for(const value of [d.startTime,d.endTime])if(value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('근무 시간을 확인해 주세요.');
  if(!!d.startTime!==!!d.endTime||d.startTime&&d.endTime<=d.startTime)throw Error('같은 작업일의 시작·종료 시간을 함께 입력하고 순서를 확인해 주세요.');
 }
 if(['issue','shift','delivery','call','stock'].includes(kind))d.issueId=count(raw.issueId);
 for(const k of ({issue:['number','printQuantity'],shift:['quantity','returned'],delivery:['quantity'],stock:['quantity'],trial:['sampleTarget','accepted','delivered','failed'],kpi:['target','actual']} as any)[kind]||[])d[k]=count(raw[k]);
 for(const k of ['date','due','nextDate','receivedAt','contractDate','start','end'].filter(k=>k in raw))d[k]=date(raw[k]);
 for(const k of ['url','reviewUrl','resultUrl','contractUrl'].filter(k=>k in raw))d[k]=url(raw[k]);
 if(kind==='issue'){if(!d.title||!d.number)throw Error('소식지 호수와 제목을 입력해 주세요.');if(!['기획','제작 중','검수 중','배포 가능','종료'].includes(d.status))throw Error('제작 상태를 선택해 주세요.');if(d.status==='배포 가능'&&(!d.topic||!d.copy||!d.url))throw Error('배포 전 소식지 원본·핵심 내용·연락 카피가 필요합니다.');}
 if(kind==='delivery'){if(!d.issueId||!d.hospitalId||!['예정','도착','전달','미전달','재방문'].includes(d.status))throw Error('회차·병원·배포 상태를 확인해 주세요.');if(d.status==='전달'&&(!d.quantity||!d.shiftId))throw Error('전달 부수와 투입 인력을 지정해 주세요.');if(['미전달','재방문'].includes(d.status)&&!d.notes)throw Error('미전달·재방문 사유를 기록해 주세요.');}
 if(kind==='call'){
  d.calledAt=text(raw.calledAt,40);if(d.calledAt){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(d.calledAt)||!Number.isFinite(Date.parse(d.calledAt)))throw Error('실제 전화 시각을 확인해 주세요.');d.calledAt=new Date(d.calledAt).toISOString();}
  if(d.receiptStatus&&!['미확인','수령 확인','미수령','원장 전달 확인'].includes(d.receiptStatus))throw Error('소식지 수령 확인 상태를 선택해 주세요.');
  d.journey=text(raw.journey||'B');d.trialId=count(raw.trialId);
  if(!['B','A'].includes(d.journey))throw Error('B콜의 업무 단계를 확인해 주세요.');
  if(!d.hospitalId||!d.reaction||!d.outcome||!d.usedCopy)throw Error('병원·사용 카피·반응·연락 결과를 기록해 주세요.');
  if(d.journey==='B'&&(!d.issueId||d.trialId))throw Error('B콜은 소식지 회차를 지정해 주세요. A 업무는 A 후속 연락에서 기록합니다.');
  if(d.journey==='A'&&(!d.trialId||d.issueId))throw Error('A 후속 B콜은 A 진행 기록에 연결합니다. 소식지 회차를 임의로 붙일 수 없습니다.');
  if(!(d.journey==='A'?A_CALL_PURPOSES:B_CALL_PURPOSES).includes(d.bStep))throw Error('연락 목적을 선택해 주세요.');
  if(d.bStep!=='일반 연락'&&!d.reference)throw Error('전달 자료 또는 제안 근거를 기록해 주세요.');
 }
 if(kind==='document'){if(!d.hospitalId||!d.name||!['요청 전','요청','보완 필요','수령 확인'].includes(d.status))throw Error('서류 이름과 상태를 확인해 주세요.');if(d.status==='수령 확인'&&(!d.receivedAt||!d.sourceName||!d.url))throw Error('실제 수령일·파일명·보관 위치가 필요합니다. 환자 원문은 입력하지 마세요.');}
 if(kind==='trial'){if(!d.hospitalId||!d.sampleTarget||d.sampleTarget<30||d.sampleTarget>100)throw Error('샘플 목표는 30~100명입니다.');if(d.delivered+d.failed>d.accepted||d.accepted>d.sampleTarget)throw Error('발송·수신 집계의 분모를 확인해 주세요.');if(!['준비','검수','승인 대기','발송 결과','계약 협의','계약 체결'].includes(d.status))throw Error('A 진행 단계를 확인해 주세요.');if(['승인 대기','발송 결과','계약 협의','계약 체결'].includes(d.status)&&!d.reviewUrl)throw Error('샘플 검수 근거를 연결해 주세요.');if(['발송 결과','계약 협의','계약 체결'].includes(d.status)&&(!d.resultUrl||!d.result))throw Error('실제 발송 결과와 근거를 연결해 주세요.');if(d.status==='계약 체결'&&(!d.contractDate||!d.contractRef||!d.contractUrl))throw Error('계약일·계약번호·서명본 근거가 필요합니다.');}
 if(kind==='shift'){if(!d.worker||!d.date||!['도보','자전거'].includes(d.mode)||!d.issueId)throw Error('작업일·인력·이동 방식·소식지를 지정해 주세요.');if(d.returned>d.quantity)throw Error('반납량은 인계량 이하여야 합니다.');}
 if(kind==='stock'&&(!d.issueId||!d.quantity||!['입고','폐기'].includes(d.type)||!d.note))throw Error('회차·수량·입고/폐기 근거를 입력해 주세요.');
 if(['planning','quality','kpi'].includes(kind)&&!d.title)throw Error('업무 제목을 입력해 주세요.');
 if(kind==='kpi'&&d.actual&&!d.basis)throw Error('실적을 입력할 때는 출처·집계 기준이 필요합니다.');
 if(kind==='quality'&&prev&&['criteria','scope','versionLabel'].some(k=>prev[k]!==d[k]))d.status='미확인';
 if(kind==='quality'&&d.status==='통과'&&(!d.criteria||!d.evidence||!d.versionLabel))throw Error('품질 통과는 기준·근거·확인 버전이 필요합니다.');
 if(kind==='location'){for(const k of ['lat','lng','accuracy']){d[k]=Number(raw[k]);if(!Number.isFinite(d[k]))throw Error('위치 값을 확인해 주세요.');}if(Math.abs(d.lat)>90||Math.abs(d.lng)>180||d.accuracy<0)throw Error('위치 범위를 확인해 주세요.');d.active=raw.active===true;}
 if(prev&&['delivery','call','document','trial'].includes(kind)&&prev.hospitalId!==d.hospitalId)throw Error('기록의 병원은 변경할 수 없습니다.');
 if(prev&&['delivery','call','shift','stock'].includes(kind)&&prev.issueId!==d.issueId)throw Error('기록의 소식지 회차는 변경할 수 없습니다.');
 return d;
}
export function stockTotals(rows:any[],issueId:number){const list=rows.filter(r=>r.data.issueId===issueId);const received=list.filter(r=>r.kind==='stock'&&r.data.type==='입고').reduce((s,r)=>s+r.data.quantity,0);const wasted=list.filter(r=>r.kind==='stock'&&r.data.type==='폐기').reduce((s,r)=>s+r.data.quantity,0);const delivered=list.filter(r=>r.kind==='delivery'&&r.data.status==='전달').reduce((s,r)=>s+r.data.quantity,0);const held=list.filter(r=>r.kind==='shift').reduce((s,r)=>s+r.data.quantity-r.data.returned-list.filter(x=>x.kind==='delivery'&&String(x.data.shiftId)===String(r.id)&&x.data.status==='전달').reduce((n,x)=>n+x.data.quantity,0),0);return {received,wasted,delivered,held,warehouse:received-wasted-delivered-held,total:received-wasted-delivered};}

export function callEvidence(d:any,rows:any[]){
 const issue=d.issueId?rows.find(r=>r.kind==='issue'&&r.id===d.issueId):null;
 if(d.journey==='A'){
  const trial=rows.find(r=>r.kind==='trial'&&r.id===d.trialId&&r.data.hospitalId===d.hospitalId);
  if(!trial)throw Error('같은 병원의 A 진행 기록을 먼저 저장한 뒤 후속 연락을 연결해 주세요.');
  return {issueVersion:null,issueTitle:'',copySnapshot:d.usedCopy,deliveryId:null,trialVersion:trial.version,trialStatus:trial.data.status,trialEvidence:{reviewUrl:trial.data.reviewUrl||'',resultUrl:trial.data.resultUrl||'',contractRef:trial.data.contractRef||''}};
 }
 if(!issue)throw Error('소식지 회차를 먼저 저장해 주세요.');
 const delivery=visitedDelivery(rows,d.hospitalId,d.issueId);
 if(!delivery)throw Error('같은 소식지 회차의 DM 실제 방문 기록이 있어야 B콜을 연결할 수 있습니다.');
 return {issueVersion:issue.version,issueTitle:issue.data.title,copySnapshot:d.usedCopy,deliveryId:delivery.id,deliverySnapshot:{status:delivery.data.status,visitedAt:delivery.data.visitedAt||'',deliveredAt:delivery.data.deliveredAt||'',recipient:delivery.data.recipient||'',notes:delivery.data.notes||'',interests:delivery.data.interests||''}};
}

// Scheduled visits are never contact evidence. Use the newest saved record, not array order.
export function newestOutreach(rows:any[]){return [...rows].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))||Number(b.id)-Number(a.id));}
export function visitedDelivery(rows:any[],hospitalId:string,issueId:number){return newestOutreach(rows).find(r=>r.kind==='delivery'&&r.data.hospitalId===hospitalId&&r.data.issueId===issueId&&['도착','전달','미전달','재방문'].includes(r.data.status));}
export function hospitalInterests(rows:any[],hospitalId:string){return newestOutreach(rows).find(r=>['delivery','call'].includes(r.kind)&&r.data.hospitalId===hospitalId&&r.data.interests?.trim());}
