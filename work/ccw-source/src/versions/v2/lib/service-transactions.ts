export type TradeKind='invoice'|'credit'|'receipt'|'refund'|'expense'|'apply'|'reversal';
export type Category='fixed'|'blog'|'video'|'message'|'other';
export type Trade={id:string;kind:TradeKind;category:Category;date:string;serviceMonth:string;amount:number;ref:string;evidence:string;party:string;description:string;dueDate?:string;invoiceId?:string;receiptId?:string;targetId?:string;recordedAt:string;actor:string};
export const categories:Record<Category,string>={fixed:'월 고정 서비스료',blog:'블로그',video:'영상',message:'발송비 별도 정산',other:'기타'};
export const tradeKinds:Record<TradeKind,string>={invoice:'청구',credit:'청구 감액',receipt:'병원 입금',refund:'병원에 환불',expense:'외주·제작비 지급',apply:'입금 연결',reversal:'기록 정정'};
export function activeTrades(rows:Trade[]){const reversed=new Set(rows.filter(t=>t.kind==='reversal').map(t=>t.targetId));return rows.filter(t=>t.kind!=='reversal'&&!reversed.has(t.id))}
export function tradeState(rows:Trade[]){const active=activeTrades(rows),invoices=active.filter(t=>t.kind==='invoice').map(t=>{const billed=t.amount-active.filter(x=>x.kind==='credit'&&x.invoiceId===t.id).reduce((n,x)=>n+x.amount,0);const paid=active.filter(x=>x.invoiceId===t.id&&['receipt','apply','refund'].includes(x.kind)).reduce((n,x)=>n+(x.kind==='refund'?-x.amount:x.amount),0);return {...t,billed,paid,due:billed-paid}});const receipts=active.filter(t=>t.kind==='receipt').map(t=>{const refunded=active.filter(x=>x.kind==='refund'&&x.receiptId===t.id).reduce((n,x)=>n+x.amount,0);const allocated=(t.invoiceId?t.amount:0)+active.filter(x=>x.kind==='apply'&&x.receiptId===t.id).reduce((n,x)=>n+x.amount,0);const allocatedRefund=active.filter(x=>x.kind==='refund'&&x.receiptId===t.id&&x.invoiceId).reduce((n,x)=>n+x.amount,0);return {...t,remaining:t.amount-refunded,unallocated:t.amount-allocated-refunded+allocatedRefund}});return {active,invoices,receipts,due:invoices.reduce((n,t)=>n+Math.max(0,t.due),0),overpaid:invoices.reduce((n,t)=>n+Math.max(0,-t.due),0),unallocated:receipts.reduce((n,t)=>n+t.unallocated,0)}}
export function financeSummary(rows:Trade[],month:string){const state=tradeState(rows),period=state.active.filter(t=>t.date.startsWith(month));return {...state,billed:period.filter(t=>t.kind==='invoice'||t.kind==='credit').reduce((n,t)=>n+(t.kind==='credit'?-t.amount:t.amount),0),received:period.filter(t=>t.kind==='receipt').reduce((n,t)=>n+t.amount,0),refunded:period.filter(t=>t.kind==='refund').reduce((n,t)=>n+t.amount,0),expenses:period.filter(t=>t.kind==='expense').reduce((n,t)=>n+t.amount,0)}}
function text(v:any,label:string,max=300){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+'을 입력해 주세요.');return v.trim()}
export function newTrade(rows:Trade[],raw:any,actor:string,now:string):Trade{
 const kind=raw.kind as TradeKind;if(!Object.keys(tradeKinds).includes(kind))throw Error('거래 구분을 확인해 주세요.');
 const date=text(raw.date,'실제 거래일',10),today=new Date(new Date(now).getTime()+9*3600000).toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)throw Error('실제 거래일은 오늘 이전의 올바른 날짜로 입력해 주세요.');
 const category=raw.category as Category;if(!categories[category])throw Error('서비스 항목을 선택해 주세요.');const amount=raw.amount;if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000000)throw Error('거래 금액은 1원 이상 10억원 이하의 정수로 입력해 주세요.');
 const t:Trade={id:raw.id,kind,date,category,amount,ref:text(raw.ref,'중복 대조용 거래번호',100),evidence:text(raw.evidence,'증빙 위치·확인 근거',1000),party:text(raw.party,'거래 상대'),description:text(raw.description,'거래 내용'),serviceMonth:text(raw.serviceMonth,'서비스 대상 월',7),recordedAt:now,actor};
 if(kind==='invoice'&&raw.dueDate){
  if(typeof raw.dueDate!=='string'||!validDate(raw.dueDate))throw Error('계약상 수금일을 올바른 날짜로 입력해 주세요.');
  t.dueDate=raw.dueDate;
 }
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.serviceMonth))throw Error('서비스 대상 월을 확인해 주세요.');
 if(rows.some(x=>x.ref===t.ref))throw Error('이미 기록한 거래번호입니다. 원본과 대조해 주세요.');
 const state=tradeState(rows),{active}=state;
 const invoice=state.invoices.find(x=>x.id===raw.invoiceId),receipt=state.receipts.find(x=>x.id===raw.receiptId);
 if(raw.invoiceId&&!['credit','receipt','refund','apply'].includes(kind))throw Error('이 거래에는 청구서를 연결할 수 없습니다.');
 if(raw.receiptId&&!['refund','apply'].includes(kind))throw Error('이 거래에는 입금을 연결할 수 없습니다.');
 if(raw.invoiceId){if(!invoice)throw Error('유효한 청구서를 선택해 주세요.');if(invoice.category!==category||invoice.serviceMonth!==t.serviceMonth)throw Error('연결 청구서와 서비스 항목·대상 월이 다릅니다.');t.invoiceId=invoice.id}
 if(raw.receiptId){if(!receipt)throw Error('유효한 입금 기록을 선택해 주세요.');t.receiptId=receipt.id}
 if(kind==='invoice'&&category==='fixed'&&active.some(x=>x.kind==='invoice'&&x.category==='fixed'&&x.serviceMonth===t.serviceMonth))throw Error('해당 월의 고정비 청구가 이미 있습니다. 기존 기록을 확인해 주세요.');
 if(kind==='credit'&&(!invoice||amount>invoice.billed))throw Error('청구 감액은 남은 청구 금액 이내로 입력해 주세요.');
 if(kind==='receipt'&&invoice&&amount>Math.max(0,invoice.due))throw Error('청구 미수금보다 큽니다. 초과 입금은 청구서 미지정으로 기록한 뒤 필요한 금액만 연결해 주세요.');
 if(kind==='apply'&&(!invoice||!receipt||amount>receipt.unallocated||amount>Math.max(0,invoice.due)))throw Error('입금 미연결 금액과 청구 미수금 이내에서 연결해 주세요.');
 if(kind==='refund'){
  if(!receipt||amount>receipt.remaining)throw Error('해당 입금의 환불 가능한 금액을 초과합니다.');
  const assigned=invoice?((receipt.invoiceId===invoice.id?receipt.amount:0)+active.filter(x=>x.kind==='apply'&&x.receiptId===receipt.id&&x.invoiceId===invoice.id).reduce((n,x)=>n+x.amount,0)-active.filter(x=>x.kind==='refund'&&x.receiptId===receipt.id&&x.invoiceId===invoice.id).reduce((n,x)=>n+x.amount,0)):receipt.unallocated;
  if(amount>assigned)throw Error('선택한 청구서에 연결된 입금 또는 미연결 입금 범위를 초과합니다.');
 }
 if(kind==='reversal'){
  const target=active.find(x=>x.id===raw.targetId);if(!target)throw Error('정정할 유효한 거래를 선택해 주세요.');
  if(active.some(x=>x.invoiceId===target.id||x.receiptId===target.id)||(target.kind==='apply'&&active.some(x=>x.kind==='refund'&&x.receiptId===target.receiptId)))throw Error('연결된 입금·감액·환불 기록을 먼저 정정해 주세요.');
  t.targetId=target.id;t.amount=target.amount;t.category=target.category;t.serviceMonth=target.serviceMonth;
 }
 return t;
}

export function clinicVisibleTrades(rows:Trade[]){const costs=new Set(rows.filter(t=>t.kind==='expense').map(t=>t.id));return rows.filter(t=>t.kind!=='expense'&&!(t.kind==='reversal'&&costs.has(t.targetId||'')))}

function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function receivableStatus(invoice:{due:number;dueDate?:string},asOf:string){
 if(!validDate(asOf))throw Error('수금 조회 기준일을 확인해 주세요.');
 if(invoice.due<=0)return {label:invoice.due<0?'초과 수납':'수납 완료',days:0,kind:'closed'};
 if(!invoice.dueDate||!validDate(invoice.dueDate))return {label:'수금일 확인 필요',days:0,kind:'unknown'};
 const days=Math.floor((Date.parse(asOf)-Date.parse(invoice.dueDate))/86400000);
 return days>0?{label:`연체 ${days}일`,days,kind:'overdue'}:days===0?{label:'오늘 수금',days:0,kind:'today'}:{label:'수금 예정',days:0,kind:'scheduled'};
}
