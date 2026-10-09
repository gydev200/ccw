import {recordCost,type CostEntry} from './cost-accounting';
import {newTrade,tradeState,type Trade} from './service-transactions';
export type Channel='ATA'|'SMS'|'LMS';
export const channels:Channel[]=['ATA','SMS','LMS'];
export type Price={sale:number;cost:number};
export type Entry={id:string;at:string;actor:string;kind:string;amount:number;cost:number;ref:string;note:string};
export type Hold={id:string;channel:Channel;count:number;price:Price;amount:number;status:'reserved'|'settled'|'cancelled';success?:number;cost?:number;at:string};
export type TopupRequest={id:string;amount:number;payer:string;at:string;actor:string;status:"pending"|"confirmed"|"rejected";resolvedAt?:string;reason?:string;};
export type CollectionPlan={invoiceId:string;dueDate:string;owner:string;nextContact:string;nextAction:string;basis:string;actor:string;at:string};
export type Wallet={collectionPlans?:CollectionPlan[];topups?:TopupRequest[];costEntries?:CostEntry[];trades?:Trade[];version:number;balance:number;reserved:number;limit:number;prices:Partial<Record<Channel,Price>>;events:Entry[];holds:Hold[];requests:Record<string,string>};
export function emptyWallet():Wallet{return {version:0,balance:0,reserved:0,limit:1000000,prices:{},events:[],holds:[],requests:{}}}
function integer(value:unknown,label:string,max=1000000000){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)throw Error(label+'은 허용 범위의 정수로 입력해 주세요.');return value}
function required(value:unknown,label:string,max=300){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+'을 입력해 주세요.');return value.trim()}
export function settlementMonth(at:string){return new Date(new Date(at).getTime()+9*3600000).toISOString().slice(0,7)}
export function summary(w:Wallet,month:string){const rows=w.events.filter(e=>settlementMonth(e.at)===month);const revenue=rows.filter(e=>e.kind==='usage').reduce((n,e)=>n+e.amount,0);const cost=rows.filter(e=>e.kind==='usage').reduce((n,e)=>n+e.cost,0);return {available:w.balance-w.reserved,balance:w.balance,reserved:w.reserved,revenue,cost,margin:revenue-cost,charged:rows.filter(e=>e.kind==='charge').reduce((n,e)=>n+e.amount,0),refunded:rows.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.amount,0)}}
export function reduceWallet(previous:Wallet,command:any,actor:string,at=new Date().toISOString()):Wallet{
 const c=command||{},id=required(c.requestId,'요청 번호',100),fingerprint=JSON.stringify({...c,version:undefined});
 if(previous.requests[id]){if(previous.requests[id]!==fingerprint)throw Error('같은 요청 번호의 내용이 다릅니다. 새 요청으로 등록해 주세요.');return previous}
 if(c.version!==previous.version)throw Error('다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 확인해 주세요.');
 if(previous.events.length>=5000)throw Error('원장 보관 한도에 도달했습니다. 관리자에게 원장 분리 보관을 요청해 주세요.');
 const w:Wallet=structuredClone(previous);let event:Entry={id,actor,at,kind:c.action,amount:0,cost:0,ref:'',note:''};
 if(c.action==='requestTopup'){
  const amount=integer(c.amount,'충전 신청 금액',10000000);if(amount<10000||amount%1000)throw Error('충전은 1만원 이상, 1천원 단위로 신청해 주세요.');
  if((w.topups||[]).filter(t=>t.status==='pending').length>=5)throw Error('대기 중인 충전 신청을 먼저 확인해 주세요.');
  if((w.topups||[]).length>=1000)throw Error('충전 신청 보관 한도에 도달했습니다.');
  w.topups=[...(w.topups||[]),{id,amount,payer:required(c.payer,'입금자명',80),actor,at,status:'pending'}];event.amount=amount;event.note='병원 충전 신청';
 }else if(c.action==='rejectTopup'){
  const t=(w.topups||[]).find(t=>t.id===c.topupId&&t.status==='pending');if(!t)throw Error('처리할 충전 신청이 없습니다.');
  t.status='rejected';t.resolvedAt=at;t.reason=required(c.reason,'반려 사유');event.note=t.reason;event.ref=t.id;
 }else if(c.action==='cost'){
  if((w.costEntries||[]).length>=1000)throw Error('원가 배부 기록 보관 한도입니다.');
  const cost=recordCost(w,{...c.cost,id},actor,at);w.costEntries=[...(w.costEntries||[]),cost];event.ref=cost.ref;event.note=cost.type+' 원가 배부 · '+cost.basis;
 }else if(c.action==='voidCost'){
  const cost=(w.costEntries||[]).find(x=>x.id===c.costId&&!x.voidedAt);if(!cost)throw Error('정정할 유효한 배부 기록이 없습니다.');
  cost.voidReason=required(c.reason,'정정 사유');cost.voidedAt=at;cost.voidedBy=actor;event.ref=cost.ref;event.note=cost.voidReason;
 }else if(c.action==='trade'){
  if((w.trades||[]).length>=3000)throw Error('거래 원장 보관 한도입니다. 관리자에게 분리 보관을 요청해 주세요.');
  const trade=newTrade(w.trades||[],{...c.trade,id},actor,at);
  if((w.costEntries||[]).some(e=>e.ref===trade.ref)||w.events.some(e=>['charge','refund'].includes(e.kind)&&e.ref===trade.ref))throw Error('발송 충전·환불 원장에 이미 있는 거래번호입니다. 이중 등록하지 마세요.');
  w.trades=[...(w.trades||[]),trade];event.ref=trade.ref;event.note=trade.kind+' · '+trade.description;
 }else if(c.action==='collectionPlan'){
  const invoice=tradeState(w.trades||[]).invoices.find(t=>t.id===c.invoiceId);
  if(!invoice)throw Error('유효한 청구서를 선택해 주세요.');
  function date(v:any,label:string,optional=false){if(optional&&(v===''||v===undefined))return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(label+'을 확인해 주세요.');return v;}
  const plan:CollectionPlan={invoiceId:invoice.id,dueDate:date(c.dueDate,'약정 수금일',true),owner:required(c.owner,'수금 담당자',80),nextContact:date(c.nextContact,'다음 확인일'),nextAction:required(c.nextAction,'다음 행동',500),basis:required(c.basis,'약정 확인·변경 근거',1000),actor,at};
  if((w.collectionPlans||[]).length>=3000)throw Error('수금계획 이력 보관 한도입니다.');
  w.collectionPlans=[...(w.collectionPlans||[]),plan];event.ref=invoice.ref;event.note='수금계획 변경 · '+plan.basis;
 }else if(c.action==='pricing'){
  const prices:any={};for(const channel of channels){const p=c.prices?.[channel];if(!p)throw Error('모든 채널의 판매단가와 원가가 필요합니다.');prices[channel]={sale:integer(p.sale,'판매단가',10000),cost:integer(p.cost,'발송원가',10000)};if(!prices[channel].sale)throw Error('판매단가는 1원 이상이어야 합니다.')}
  w.prices=prices;w.limit=integer(c.limit,'월 사용 한도');event.note=required(c.note,'단가 적용 근거')+' · '+JSON.stringify({prices,limit:w.limit});
 }else if(c.action==='charge'||c.action==='refund'){
  const amount=integer(c.amount,'금액');if(!amount)throw Error('금액은 1원 이상이어야 합니다.');event.ref=required(c.ref,'결제·환불 확인 번호');
  if((w.costEntries||[]).some(t=>t.ref===event.ref)||(w.trades||[]).some(t=>t.ref===event.ref)||w.events.some(e=>e.kind===c.action&&e.ref===event.ref))throw Error('이미 등록한 확인 번호입니다.');
  if(c.action==='refund'&&amount>w.balance-w.reserved)throw Error('발송 확보 금액을 제외한 사용 가능 잔액보다 큽니다.');
  if(c.action==='charge'&&c.topupId){const t=(w.topups||[]).find(t=>t.id===c.topupId&&t.status==='pending');if(!t||t.amount!==amount)throw Error('대기 중인 신청 금액과 입금 확인 금액이 일치해야 합니다.');t.status='confirmed';t.resolvedAt=at;}
  w.balance+=c.action==='charge'?amount:-amount;integer(w.balance,'총 잔액');event.amount=amount;event.note=required(c.note,'확인 근거');
 }else if(c.action==='reserve'){
  const channel=c.channel as Channel,price=w.prices[channel];if(!channels.includes(channel)||!price)throw Error('병원의 적용 단가를 먼저 등록해 주세요.');
  const count=integer(c.count,'발송 건수',100000);if(!count)throw Error('발송 건수는 1건 이상이어야 합니다.');const amount=count*price.sale;
  if(amount>w.balance-w.reserved)throw Error('충전금이 부족합니다. 충전 후 다시 요청해 주세요.');
  const month=settlementMonth(at);if(summary(w,month).revenue+w.reserved+amount>w.limit)throw Error('월 사용 한도를 초과합니다. 한도를 확인해 주세요.');
  event.ref=required(c.ref,'발송 요청 번호');if(w.holds.some(h=>h.id===event.ref))throw Error('이미 등록한 발송 요청 번호입니다.');
  w.reserved+=amount;w.holds.push({id:event.ref,channel,count,price:{...price},amount,status:'reserved',at});event.amount=amount;event.note=channel+' '+count+'건 발송금 확보';
 }else if(c.action==='settle'||c.action==='cancel'){
  const h=w.holds.find(h=>h.id===c.holdId);if(!h||h.status!=='reserved')throw Error('처리할 발송금 확보 기록이 없습니다.');event.ref=h.id;w.reserved-=h.amount;
  if(c.action==='cancel'){h.status='cancelled';event.amount=h.amount;event.note='발송 전 취소 · 확보 금액 전액 해제'}
  else {const success=integer(c.success,'최종 성공 건수',h.count),actualCost=integer(c.actualCost,'확정 공급원가');event.note=required(c.note,'발송 결과·원가 확인 근거');
   h.status='settled';h.success=success;h.cost=actualCost;event.kind='usage';event.amount=success*h.price.sale;event.cost=actualCost;w.balance-=event.amount;
  }
 }else throw Error('지원하지 않는 정산 요청입니다.');
 if(w.balance<0||w.reserved<0||w.reserved>w.balance)throw Error('잔액 검증에 실패했습니다.');
 w.events.push(event);w.requests[id]=fingerprint;w.version++;if(new TextEncoder().encode(JSON.stringify(w)).length>1500000)throw Error('원장 보관 용량에 도달했습니다. 관리자에게 원장 분리 보관을 요청해 주세요.');return w;
}
