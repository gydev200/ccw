import {db,member,origin,json,fail,HttpError,now} from '@/lib/server';
import {mayOrg} from '@/lib/policy';
import reference from '@/lib/setup-reference.json';

export async function GET(){try{
 const m=await member();if(!mayOrg(m,'SS'))throw new HttpError(403,'SS 세팅 권한이 필요합니다.');
 // Shared setup directory contains names and categories only, not customer reviews or tasks.
 const rows=await db().prepare("SELECT id,json_extract(data,'$.name') AS alias,json_extract(data,'$.setupName') AS name,json_extract(data,'$.setupGroup') AS category,json_extract(data,'$.setupOrder') AS position FROM records WHERE kind='customer' AND json_extract(data,'$.setupGroup') IS NOT NULL ORDER BY position,id").all<{id:number,alias:string,name:string,category:string,position:number}>();
 const saved=await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'setup-details:%'").all<{key:string,value:string}>();
 const edits=new Map(saved.results.map(r=>[Number(r.key.split(':')[1]),JSON.parse(r.value)]));
 return json({canEdit:m.role==='DO'||m.person==='kyunghwa',hospitals:rows.results.map(h=>{const edit=edits.get(h.id);const ref=reference.rows.find(r=>[h.alias,h.name].some(n=>String(n).replace(/\s/g,'').includes(r.alias.replace(/\s/g,''))))||{};return {...h,name:edit?.fields?.hospitalName||h.name,category:edit?.fields?.setupGroup||h.category,revision:edit?.revision||0,updatedAt:edit?.updatedAt||null,reference:{...ref,...edit?.fields}}})});
}catch(e){return fail(e)}}

const fields=['hospitalName','setupGroup','vendor','emr','remoteInstalled','memo','lunch','remoteTime','remoteTimeConfirmed','integration','currentStatus','paymentDue','contracted','contractDate','startDate','setupMonths','setupEnd','setupFee','depositDay','includedMessages','taxDate','contact','service','nextAction','pwDocumentAvailable'];
export async function POST(req:Request){try{
 origin(req);const m=await member();if(!mayOrg(m,'SS')||(m.role!=='DO'&&m.person!=='kyunghwa'))throw new HttpError(403,'세팅 정보 수정 권한이 없습니다.');
 const raw=await req.text();if(raw.length>12000)throw new HttpError(413,'입력 내용이 너무 깁니다.');const b=JSON.parse(raw);
 if(!Number.isSafeInteger(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0||!b.fields||typeof b.fields!=='object'||Array.isArray(b.fields)||!Object.keys(b.fields).length||Object.keys(b.fields).some(f=>!fields.includes(f)))throw new HttpError(400,'수정할 항목을 확인해 주세요.');
 const clinic=await db().prepare("SELECT id FROM records WHERE id=? AND kind='customer' AND json_extract(data,'$.setupGroup') IS NOT NULL").bind(b.id).first();if(!clinic)throw new HttpError(404,'세팅 병원을 찾지 못했습니다.');
 const values:Record<string,string|boolean>={};
 const options:Record<string,string[]>={setupGroup:['계약 후 세팅','계약 전 세팅','기타 영업 중'],remoteInstalled:['','⭕','❌','▲'],integration:['','⭕','❌'],contracted:['','⭕','❌']};
 for(const [field,input] of Object.entries(b.fields)){let value:any=input;if(['remoteTimeConfirmed','pwDocumentAvailable'].includes(field)){if(typeof value!=='boolean')throw new HttpError(400,'상태를 선택해 주세요.');}else{if(typeof value!=='string'||value.length>(field==='memo'?5000:500))throw new HttpError(400,'입력 내용을 확인해 주세요.');value=value.trim();}if(options[field]&&!options[field].includes(value))throw new HttpError(400,'항목 값을 선택해 주세요.');if(field==='hospitalName'&&!value)throw new HttpError(400,'병원명을 입력해 주세요.');values[field]=value;}
 const key='setup-details:'+b.id,row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();const previous=row?JSON.parse(row.value):{revision:0,fields:{}};
 if(previous.revision!==b.revision)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 목록을 새로고침한 후 다시 수정해 주세요.');
 const next={revision:previous.revision+1,fields:{...previous.fields,...values},updatedAt:now(),updatedBy:m.person};
 const change=row?db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(next),key,row.value):db().prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind(key,JSON.stringify(next));
 const result=await db().batch([change,db().prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT ?,'SS',?,'세팅 정보 수정',?,? WHERE changes()>0").bind(b.id,m.id,JSON.stringify({fields:Object.keys(values),before:previous.fields,after:values}),next.updatedAt)]);
 if(result[0].meta.changes!==1)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 수정해 주세요.');
 return json({saved:true,...next});
}catch(e){return fail(e)}}
