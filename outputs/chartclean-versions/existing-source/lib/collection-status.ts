import {tradeState,receivableStatus} from './service-transactions';
import type {Wallet} from './settlement';

export function collectionRows(hospitals:{id:number;name:string;wallet:Wallet}[],date:string){
 return hospitals.flatMap(h=>tradeState(h.wallet.trades||[]).invoices.filter(t=>t.due>0).map(t=>{
  const plan=(h.wallet.collectionPlans||[]).filter(p=>p.invoiceId===t.id).at(-1);
  const dueDate=plan?plan.dueDate:t.dueDate;
  const status=receivableStatus({...t,dueDate},date);
  const followupLate=!!plan&&plan.nextContact<date;
  return {hospitalId:h.id,hospital:h.name,invoiceId:t.id,ref:t.ref,due:t.due,dueDate,status,plan,followupLate};
 })).sort((a,b)=>{
  const rank=(x:typeof a)=>x.status.kind==='overdue'?0:x.status.kind==='unknown'?1:x.followupLate?2:x.status.kind==='today'?3:4;
  return rank(a)-rank(b)||b.status.days-a.status.days||b.due-a.due||a.hospital.localeCompare(b.hospital);
 });
}

export function unallocatedReceipts(hospitals:{id:number;name:string;wallet:Wallet}[]){
 return hospitals.flatMap(h=>tradeState(h.wallet.trades||[]).receipts.filter(r=>r.unallocated>0).map(r=>({hospitalId:h.id,hospital:h.name,receiptId:r.id,ref:r.ref,date:r.date,amount:r.unallocated}))).sort((a,b)=>a.date.localeCompare(b.date)||a.hospitalId-b.hospitalId||a.receiptId.localeCompare(b.receiptId));
}
