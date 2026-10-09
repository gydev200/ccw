import {member,owner,db,record,createRecord,updateRecord,origin,json,fail,now,HttpError} from '@/lib/server';
import {assertText,mayRecord} from '@/lib/policy';
import {newSeat,seatDay,canReadSeat,addAppointment} from '@/lib/seats';
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export async function GET(req:Request){try{const m=await member();const selected=seatDay(new URL(req.url).searchParams.get('date')||today());const out=await db().prepare("SELECT * FROM records WHERE kind IN ('seat','task') ORDER BY id DESC").all<any>();const tasks=out.results.filter(r=>r.kind==='task'&&mayRecord(m,r)).map(r=>({...r,data:JSON.parse(r.data)}));const seats=out.results.filter(r=>r.kind==='seat').map(r=>({...r,data:JSON.parse(r.data)})).filter(r=>canReadSeat(m,r.data,today())).map(r=>({...r,data:{...r.data,appointments:m.role==='DO'?r.data.appointments:r.data.appointments.filter((a:any)=>a.person===m.person),taskIds:(r.data.taskIds||[]).filter((id:number)=>tasks.some(t=>t.id===id))}}));return json({seats,tasks,date:selected,isDO:m.role==='DO'})}catch(e){return fail(e)}}
export async function POST(req:Request){try{origin(req);const m=await member();const raw=await req.text();if(raw.length>30000)throw Error('입력 내용이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='create'){owner(m);const d=newSeat(b.data);return json({id:await createRecord('seat',d.org,'do',d,m)},201)}
 const r:any=await db().prepare("SELECT * FROM records WHERE id=? AND kind='seat'").bind(Number(b.id)).first();if(!r)throw new HttpError(404,'자리를 찾을 수 없습니다.');r.data=JSON.parse(r.data);if(!canReadSeat(m,r.data,today()))throw new HttpError(403,'이 자리에 접근할 권한이 없습니다.');if(r.version!==Number(b.version))throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 다시 불러와 주세요.');let d={...r.data};
 if(b.action==='appoint'){owner(m);d=addAppointment(d,b);}
 else if(b.action==='end'){owner(m);const end=seatDay(b.end);const a=d.appointments.find((x:any)=>x.id===b.appointmentId);if(!a||end<a.start||end>a.end)throw Error('기존 배정 기간 안의 종료일을 입력해 주세요.');const note=assertText(b.note,'조기 종료·인계 사유',3000,true);d.appointments=d.appointments.map((x:any)=>x.id===a.id?{...x,end,previousEnd:x.end,endedAt:now(),endNote:note}:x);}
 else if(b.action==='link'){owner(m);const task=await record(Number(b.taskId),m);if(task.kind!=='task'||task.org!==r.org)throw Error('같은 조직의 업무만 연결할 수 있습니다.');d.taskIds=[...new Set([...(d.taskIds||[]),task.id])];}
 else if(b.action==='handover'){const text=assertText(b.text,'인계 내용·자료 위치',10000,true);d.handover=[...(d.handover||[]),{id:crypto.randomUUID(),at:now(),actor:m.person,text}];}
 else throw Error('처리할 동작을 확인해 주세요.');
 await updateRecord(r,d,m,'자리 '+b.action,{before:r.data,after:d});return json({ok:true});
}catch(e){return fail(e)}}
