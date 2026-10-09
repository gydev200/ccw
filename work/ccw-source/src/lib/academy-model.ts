import content from './academy-content.json';
export const ACADEMY=content;
export const MODULES=content.modules;
export const KPI_TEMPLATES=[
 {org:'PPM',title:'완료 기준을 충족한 결과',numerator:'기준을 충족해 확인받은 결과 수',denominator:'검토한 결과 수'},
 {org:'DM',title:'전달 결과 증빙 완결',numerator:'필수 증빙이 갖춰진 전달 건수',denominator:'완료 또는 예외로 기록한 방문 건수'},
 {org:'OS',title:'약속한 후속 업무 이행',numerator:'약속 기한 안에 처리한 후속 업무 수',denominator:'해당 기간 처리 기한이 온 후속 업무 수'},
 {org:'SS',title:'운영 결과와 인계 확인',numerator:'결과·예외·인계가 확인된 운영 회차 수',denominator:'확인 대상 운영 회차 수'},
 {org:'CA',title:'승인본과 최종본 대조',numerator:'게시 전 승인본 대조를 마친 결과 수',denominator:'게시 승인 대상 결과 수'},
 {org:'DSS',title:'마감 증빙과 미결 관리',numerator:'증빙 또는 미결 담당·기한을 확인한 항목 수',denominator:'해당 기간 마감 대상 항목 수'}
];
export const REVIEW_DIMENSIONS=['완료 기준','기한·인계','품질·오류 대응','기록·개선'];
export function periodRange(kind:string,date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('날짜를 확인해 주세요.');
 const d=new Date(date+'T00:00:00Z'),iso=(x:Date)=>x.toISOString().slice(0,10);
 if(kind==='daily')return {start:date,end:date};
 if(kind==='weekly'){const n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n);const start=iso(d);d.setUTCDate(d.getUTCDate()+6);return {start,end:iso(d)}}
 if(kind==='monthly')return {start:date.slice(0,7)+'-01',end:iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)))};
 throw Error('일일·주간·월간 중 선택해 주세요.');
}
export function scoreSummary(questions:any[],answers:any,marks:any={}){
 return [...new Set(questions.map(q=>q.module))].map(module=>{const qs=questions.filter(q=>q.module===module),written=qs.filter(q=>q.type==='written');const objective=qs.filter(q=>q.type==='choice').reduce((s,q)=>s+(answers[q.id]===q.answer?q.points:0),0);const pending=written.some(q=>!Number.isInteger(marks[q.id]?.score));const earned=objective+written.reduce((s,q)=>s+(marks[q.id]?.score??0),0);const max=qs.reduce((s,q)=>s+q.points,0);return {module,objective,objectiveMax:qs.filter(q=>q.type==='choice').reduce((s,q)=>s+q.points,0),earned:pending?null:earned,max,pending}});
}
