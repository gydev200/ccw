type SeminarRow={created_at?:string;data:{week?:string;hospitalId?:string;application?:string;attendance?:string;materialRequest?:string;meeting?:string;aEntry?:string;contract?:string;paymentAmount?:string;paymentRef?:string;paymentEvidence?:string;paidAt?:string}};

export function seminarSummary(rows:SeminarRow[]){
 const payments=new Map<string,{amount:number;week:string}>();
 for(const row of [...rows].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')))){
  const data=row.data,amount=Number(data.paymentAmount),hospitalId=String(data.hospitalId||'').trim().toUpperCase(),paymentRef=String(data.paymentRef||'').trim();
  if(hospitalId&&paymentRef&&data.paymentEvidence&&String(data.paidAt||'').startsWith('2026-10-')&&Number.isSafeInteger(amount)&&amount>0){
   const key=hospitalId+'|'+paymentRef;
   if(!payments.has(key))payments.set(key,{amount,week:String(data.week||'')});
  }
 }
 const byWeek=(week:string)=>{
  const group=rows.filter(row=>row.data.week===week);
  const hospitalId=(row:SeminarRow)=>String(row.data.hospitalId||'').trim().toUpperCase();
  const count=(field:keyof SeminarRow['data'])=>new Set(group.filter(row=>row.data[field]==='예').map(hospitalId).filter(Boolean)).size;
  return {hospitals:new Set(group.map(hospitalId).filter(Boolean)).size,application:count('application'),attendance:count('attendance'),materialRequest:count('materialRequest'),meeting:count('meeting'),aEntry:count('aEntry'),contract:count('contract'),paid:[...payments.values()].filter(payment=>payment.week===week).reduce((sum,payment)=>sum+payment.amount,0)};
 };
 return {week1:byWeek('1'),week2:byWeek('2'),paid:[...payments.values()].reduce((sum,payment)=>sum+payment.amount,0)};
}
