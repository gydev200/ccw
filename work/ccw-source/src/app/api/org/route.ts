import {member,owner,record,db,createRecord,updateRecord,json,fail,origin,now,HttpError} from '@/lib/server';
import {validateMetric} from '@/lib/org-management';
import {assertText} from '@/lib/policy';
export async function POST(req:Request){try{origin(req);const m=await member();const raw=await req.text();if(raw.length>40000)throw Error('입력 내용이 너무 큽니다.');const b=JSON.parse(raw);
 if(b.action==='metricCreate'){owner(m);const d=validateMetric(b.data);return json({id:await createRecord('metric',d.org,d.assignee,d,m)},201)}
 const r=await record(Number(b.id),m);if(r.kind!=='metric')throw Error('경영지표를 선택해 주세요.');if(r.version!==Number(b.version))throw new HttpError(409,'다른 입력이 먼저 저장됐습니다. 새로고침해 주세요.');
 if(b.action==='metricEdit'){owner(m);const d=validateMetric(b.data);if((r.data.observations||[]).length)throw Error('측정값이 있는 기준은 바꾸지 않습니다. 다음 기간의 기준을 새로 등록해 주세요.');return json(await updateRecord(r,d,m,'경영 기준 수정',{before:r.data,after:d}))}
 if(b.action==='observe'){const value=Number(b.value),date=String(b.date);if(!Number.isFinite(value)||b.value==='')throw Error('측정값을 입력해 주세요.');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<r.data.start||date>r.data.end||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('기준 적용 기간 안의 측정일을 입력해 주세요.');const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);if(date>today)throw Error('미래의 실적은 입력할 수 없습니다.');const evidence=assertText(b.evidence,'실제 측정 근거',5000,true),improvement=assertText(b.improvement||'','차이의 원인·개선 행동',5000);const observations=[...(r.data.observations||[]),{date,value,evidence,improvement,at:now(),actor:m.id}];return json(await updateRecord(r,{...r.data,observations},m,'경영지표 실적 입력',{date,value,evidence,improvement}))}
 throw Error('처리할 동작을 확인해 주세요.');
}catch(e){return fail(e)}}
