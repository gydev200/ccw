export type Reconciliation={id:string;date:string;opening:number;actual:number;expected:number;difference:number;evidence:string;reason:string;person:string;due:string;at:string;actor:string;sourceVersion:number;cashSnapshot:string};
export function cashSnapshot(report:any){return JSON.stringify(report.allCashRows.filter((r:any)=>r.date===report.date).map((r:any)=>({id:r.id,date:r.date,cash:r.cash,ref:r.ref,label:r.label,origin:r.origin})).sort((a:any,b:any)=>a.id.localeCompare(b.id)))}
export function makeReconciliation(c:any,report:any,people:string[],meta:{id:string;at:string;actor:string;sourceVersion:number}):Reconciliation{
 for(const k of ['opening','actual'])if(typeof c[k]!=='number'||!Number.isSafeInteger(c[k])||c[k]<0)throw Error('확인 잔액은 0 이상의 정수로 입력해 주세요.');
 const expected=c.opening+report.net,difference=c.actual-expected;if(!Number.isSafeInteger(expected)||!Number.isSafeInteger(difference))throw Error('금액 범위를 확인해 주세요.');
 if(typeof c.evidence!=='string'||!c.evidence.trim()||c.evidence.length>2000)throw Error('전일·당일 현금과 전체 계좌 잔액의 확인 근거가 필요합니다.');
 const reason=typeof c.reason==='string'?c.reason.trim():'';if(reason.length>2000)throw Error('차이 사유가 너무 깁니다.');
 const person=typeof c.person==='string'?c.person:'',due=typeof c.due==='string'?c.due:'';
 if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw Error('처리일을 확인해 주세요.');
 if(difference&&(!reason||!people.includes(person)||!due||due<report.date))throw Error('잔액 차이의 사유·담당·처리일을 지정해 주세요.');
 return {...meta,date:report.date,opening:c.opening,actual:c.actual,expected,difference,evidence:c.evidence.trim(),reason,person,due,cashSnapshot:cashSnapshot(report)};
}
export function reconciliationStatus(history:Reconciliation[],report:any){
 const latest=[...history].reverse().find(r=>r.date===report.date);
 if(!latest)return {state:'missing' as const,label:'오늘 잔액 대조 없음',record:null};
 if(latest.cashSnapshot!==cashSnapshot(report))return {state:'stale' as const,label:'원장 변경 후 재대조 필요',record:latest};
 return {state:latest.difference?'difference' as const:'matched' as const,label:latest.difference?'잔액 차이 확인 필요':'기록 기준 잔액 일치',record:latest};
}
