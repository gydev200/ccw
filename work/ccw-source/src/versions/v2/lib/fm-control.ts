import type { Finance, Source } from './ccfm';
import type { Wallet } from './settlement';
import { collectionRows, unallocatedReceipts } from './collection-status';
import { activeTrades } from './service-transactions';
import { costRows } from './cost-accounting';
export const RESERVE_KINDS = [['vat','부가세'],['corporate','법인세·지방소득세'],['retirement','퇴직급여']] as const;
export type Reserve = {kind:string; target:number|null; funded:number|null; date:string; due:string; evidence:string};
export type Contract = {id:string; hospitalId:number; title:string; amount:number; start:string; end:string; billDay:number; receiveDay:number; taxDay:number; receiveOffset:number; taxOffset:number; prefix:string; owner:string; evidence:string; taxNeeded:boolean};
export type Commitment = {id:string; title:string; amount:number; due:string; evidence:string};
export type Control = {contracts:Contract[]; budgets?:{month:string;income:number;outflow:number;evidence:string}[]; reserves:Reserve[]; cash:{amount:number;date:string;evidence:string}|null; commitments:Commitment[]; history:{at:string;actor:string;action:string;detail:string}[]};
export const emptyControl=():Control=>({contracts:[],reserves:[],cash:null,commitments:[],history:[]});
const money=(n:unknown,optional=false):number|null=>{if(optional&&n===null)return null;if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('금액은 0 이상 1조원 이하 정수로 입력해 주세요.');return n;};
function text(v:unknown,label:string,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+'을 확인해 주세요.');return v.trim();}
function date(v:unknown){const s=text(v,'날짜',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('유효한 날짜를 입력해 주세요.');return s;}
function month(v:unknown){const s=text(v,'대상 월',7);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(s))throw Error('대상 월은 2000~2099년으로 입력해 주세요.');return s;}
export function scheduledDate(period:string,day:number,offset=0){const [y,m]=period.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
export function updateControl(before:Control|undefined,c:any,actor:string,at:string,today:string,people:string[]):Control{
 const s=structuredClone(before||emptyControl());let detail='';
 if(s.history.length>=5000)throw Error('변경 기록 보관 한도입니다. 자료를 백업해 주세요.');
 if(c.kind==='cash'){
  const d=date(c.item?.date);if(d>today)throw Error('잔액 확인일은 오늘 이후일 수 없습니다.');
  s.cash={amount:money(c.item.amount)!,date:d,evidence:text(c.item.evidence,'전체 계좌 잔액 확인 근거')};detail='전체 계좌 잔액 '+s.cash.amount+'원';
 }else if(c.kind==='reserve'){
  const x=c.item||{};if(!RESERVE_KINDS.some(([k])=>k===x.kind))throw Error('준비금 종류를 확인해 주세요.');const d=date(x.date);if(d>today)throw Error('확인일은 오늘 이후일 수 없습니다.');
  const row:Reserve={kind:x.kind,target:money(x.target,true),funded:money(x.funded,true),date:d,due:x.due?date(x.due):'',evidence:text(x.evidence,'산정 및 확보 근거')};
  s.reserves=s.reserves.filter(r=>r.kind!==row.kind).concat(row);detail=JSON.stringify(row);
 }else if(c.kind==='contract'){
  const x=c.item||{};const id=text(x.id,'계약 번호',80);if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('계약 번호는 영문·숫자·밑줄·붙임표로 입력해 주세요.');
  if(!Number.isSafeInteger(x.hospitalId)||x.hospitalId<1||!people.includes(x.owner))throw Error('거래처와 담당자를 선택해 주세요.');
  for(const k of ['billDay','receiveDay','taxDay'])if(!Number.isInteger(x[k])||x[k]<1||x[k]>31)throw Error('약정일은 1~31일로 입력해 주세요.');
  for(const k of ['receiveOffset','taxOffset'])if(![0,1,2].includes(x[k]))throw Error('당월·다음 달·두 달 뒤 중 선택해 주세요.');
  const start=month(x.start),end=x.end?month(x.end):'';if(end&&end<start)throw Error('계약 종료 월이 시작 월보다 빠릅니다.');
  const prefix=text(x.prefix,'청구번호 앞부분',80);if(s.contracts.some(r=>r.id!==id&&r.hospitalId===x.hospitalId&&r.prefix===prefix))throw Error('같은 거래처에 같은 청구번호 기준이 있습니다.');
  if(typeof x.taxNeeded!=='boolean')throw Error('계산서 대상 여부를 확인해 주세요.');
  const row:Contract={id,hospitalId:x.hospitalId,title:text(x.title,'계약명',200),amount:money(x.amount)!,start,end,billDay:x.billDay,receiveDay:x.receiveDay,taxDay:x.taxDay,receiveOffset:x.receiveOffset,taxOffset:x.taxOffset,prefix,owner:x.owner,evidence:text(x.evidence,'계약 근거'),taxNeeded:x.taxNeeded};
  if(!row.amount)throw Error('계약금액은 1원 이상이어야 합니다.');if(s.contracts.length>=500&&!s.contracts.some(r=>r.id===id))throw Error('계약 보관 한도입니다.');s.contracts=s.contracts.filter(r=>r.id!==id).concat(row);detail=JSON.stringify(row);
 }else if(c.kind==='commitment'){
  const x=c.item||{},row={id:text(x.id,'지급 예정 번호',80),title:text(x.title,'지급 내용',200),amount:money(x.amount)!,due:date(x.due),evidence:text(x.evidence,'지급 근거')};if(s.commitments.length>=500&&!s.commitments.some(r=>r.id===row.id))throw Error('지급 예정 보관 한도입니다.');s.commitments=s.commitments.filter(r=>r.id!==row.id).concat(row);detail=JSON.stringify(row);
 }else if(c.kind==='budget'){
  const x=c.item||{},row={month:month(x.month),income:money(x.income)!,outflow:money(x.outflow)!,evidence:text(x.evidence,'목표·예산 근거')};s.budgets=(s.budgets||[]).filter(b=>b.month!==row.month).concat(row);detail=JSON.stringify(row);
 }else if(c.kind==='removeCommitment'){
  const id=text(c.id,'지급 예정 번호',80);if(!s.commitments.some(r=>r.id===id))throw Error('지급 예정 기록을 찾지 못했습니다.');detail=id+' / '+text(c.reason,'제외 근거');s.commitments=s.commitments.filter(r=>r.id!==id);
 }else throw Error('지원하지 않는 재무 관리 작업입니다.');
 s.history.push({at,actor,action:c.kind,detail});return s;
}
export type Hospital = {id:number;name:string;wallet:Wallet};
export function controlReport(ledger:Finance,hospitals:Hospital[],asOf:string){
 date(asOf);const control=ledger.control||emptyControl(),period=asOf.slice(0,7);
 const reserves=RESERVE_KINDS.map(([kind,label])=>{const r=control.reserves.find(r=>r.kind===kind);return {kind,label,...r,target:r?.target??null,funded:r?.funded??null,stale:!!r&&r.date!==asOf,gap:r?.target!=null&&r.funded!=null?Math.max(0,r.target-r.funded):null};});
 const reserveUnknown=reserves.some(r=>r.target===null||r.funded===null||r.stale);
 const reserved=reserves.reduce((n,r)=>n+Math.max(r.target||0,r.funded||0),0);
 const funded=reserves.reduce((n,r)=>n+(r.funded||0),0);
 const obligations=control.contracts.flatMap(c=>{
  const h=hospitals.find(h=>h.id===c.hospitalId);const trades=activeTrades((h?.wallet.trades||[]).filter(t=>t.date<=asOf));const out=[];
  // All registered contract months remain visible until the source records show completion.
  for(let p=c.start;p<=period&&(!c.end||p<=c.end);p=scheduledDate(p,1,1).slice(0,7)){
   const ref=c.prefix+'-'+p,invoice=trades.find(t=>t.kind==='invoice'&&t.ref===ref);
   const sourceKey=invoice?'settlement:'+c.hospitalId+':trade:'+invoice.id:'';
   const taxWork=sourceKey?(ledger.work||[]).find(w=>w.kind==='invoice'&&w.sourceKey===sourceKey&&w.status==='외부 발행 확인'&&w.externalNumber&&w.evidence):undefined;
   const bill=scheduledDate(p,c.billDay),receive=scheduledDate(p,c.receiveDay,c.receiveOffset),tax=scheduledDate(p,c.taxDay,c.taxOffset);
   out.push({key:c.id+':'+p,contract:c,hospital:h?.name||'거래처 #'+c.hospitalId,period:p,ref,sourceKey,bill,receive,tax,billed:!!invoice,taxIssued:!!taxWork,taxNeeded:c.taxNeeded,amountMismatch:!!invoice&&invoice.amount!==c.amount,invoiceId:invoice?.id});
  }return out;
 });
 const currentHospitals=hospitals.map(h=>({...h,wallet:{...h.wallet,trades:(h.wallet.trades||[]).filter(t=>t.date<=asOf)}}));
 const collections=collectionRows(currentHospitals,asOf),unallocated=unallocatedReceipts(currentHospitals);
 const openWork=(ledger.work||[]).filter(w=>!['완료','취소','외부 발행 확인','수취 확인'].includes(w.status));
 const costs=currentHospitals.flatMap(h=>costRows(h.wallet,period).filter(r=>r.revenue||r.external||r.labor||r.shared).map(r=>({...r,hospital:h.name,hospitalId:h.id,complete:r.externalRecorded&&r.laborRecorded&&r.sharedRecorded})));
 const future=new Date(asOf+'T00:00:00Z');future.setUTCDate(future.getUTCDate()+30);const end=future.toISOString().slice(0,10);
 const payable=control.commitments.filter(p=>p.due<=end).reduce((n,p)=>n+p.amount,0);
 const cashValid=!!control.cash&&control.cash.date===asOf&&funded<=control.cash.amount;
 return {asOf,period,control,reserves,reserveUnknown,reserved,funded,cashValid,available:cashValid&&!reserveUnknown?control.cash!.amount-reserved-payable:null,payable,
  missingBills:obligations.filter(o=>!o.billed&&o.bill<=asOf),missingTax:obligations.filter(o=>o.taxNeeded&&!o.taxIssued&&o.tax<=asOf),obligations,collections,unallocated,openWork,costs,
  overdue:collections.filter(r=>r.status.kind==='overdue'),dueToday:collections.filter(r=>r.status.kind==='today'),
  overdueWork:openWork.filter(w=>w.due&&w.due<asOf),
  noDue:collections.filter(r=>r.status.kind==='unknown'),mismatches:obligations.filter(o=>o.amountMismatch)};
}
export function financialBrief(r:ReturnType<typeof controlReport>){const won=(n:number|null)=>n===null?'확인 필요':n.toLocaleString('ko-KR')+'원';return [r.asOf+' 재무 담당 보고',
 '확인 계좌잔액: '+(r.cashValid?won(r.control.cash!.amount):'오늘 전체 계좌잔액 확인 필요'),
 '준비금·30일 지급예정 제외 후: '+won(r.available),
 '청구 기한 경과·당일 '+r.missingBills.length+'건 / 계산서 확인 필요 '+r.missingTax.length+'건',
 '연체 미수 '+won(r.overdue.reduce((n,x)=>n+x.due,0))+' / 오늘 수금 '+won(r.dueToday.reduce((n,x)=>n+x.due,0)),
 ...r.reserves.map(x=>x.label+': 필요 '+won(x.target)+' / 확보 '+won(x.funded)+' / 부족 '+won(x.gap)+(x.stale?' (오늘 재확인 필요)':'')),
 '지급 예정(기한 경과 포함 30일): '+won(r.payable),
 '기한 지난 업무 '+r.overdueWork.length+'건 / 미배정 입금 '+r.unallocated.length+'건',
 '등록 원장과 입력 근거 기준입니다. 미등록 거래는 포함되지 않습니다.'].join('\n');}
