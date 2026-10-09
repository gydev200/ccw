import {member,record,createRecord,updateRecord,db,json,fail,origin,HttpError,owner} from '@/lib/server';
import {mayOrg} from '@/lib/policy';
import {blankPackage,validatePackage,normalizeHospital} from '@/lib/ba-package';
import clinics from '@/lib/ba-clinics.json';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{origin(req);const m=await member();if(!mayOrg(m,'OS'))throw new HttpError(403,'OS 접근 권한이 필요합니다.');const text=await req.text();if(text.length>120000)throw Error('입력 내용이 너무 큽니다.');const body=JSON.parse(text);
 if(body.action==='create'){
  owner(m);if(typeof body.name!=='string'||!body.name.trim()||body.name.length>150)throw Error('병원 이름을 입력해 주세요.');const name=body.name.trim(),key=normalizeHospital(name);
  const all=await db().prepare("SELECT * FROM records WHERE kind='customer' AND org='OS'").all<any>();const existing=all.results.find((r:any)=>normalizeHospital(JSON.parse(r.data).name||'')===key);if(existing)return json(await record(existing.id,m));
  const clinic=clinics.find(c=>normalizeHospital(c.name)===key);const pack=blankPackage(clinic?.slug||'');pack.request=clinic?.requests.join('\n')||'';
  const data={name,org:'OS',assignee:'do',stage:clinic?'B2':'B1',service:'미정',nextAction:clinic?'B 체험·검수':'공식 채널·진료 주제 확인',due:'',notes:'',sourceUrl:clinic?.url||'',baPackage:pack};
  let id:number;try{id=await createRecord('customer','OS','do',data,m,'ba-hospital:'+key);}catch(e){const r=await db().prepare('SELECT id FROM records WHERE dedup=?').bind('ba-hospital:'+key).first<any>();if(!r)throw e;id=r.id;}return json(await record(id,m),201);
 }
 const r=await record(Number(body.id),m);if(r.kind!=='customer'||r.org!=='OS')throw new HttpError(403,'OS 병원 기록을 선택해 주세요.');if(r.version!==body.version)throw new HttpError(409,'다른 담당자의 변경이 있습니다. 다시 불러온 후 저장해 주세요.');
 const expectedSlug=r.data.baPackage?.slug||r.data.ba?.slug||clinics.find(c=>normalizeHospital(c.name)===normalizeHospital(r.data.name))?.slug||'';if(body.package?.slug!==expectedSlug)throw Error('병원명과 체험 병원 연결이 일치하지 않습니다.');const pack=validatePackage(body.package,r.data.baPackage||null,m.id,clinics.map(c=>c.slug));return json(await updateRecord(r,{...r.data,stage:pack.a.summary&&['B','B1','B2','OS 후속 연락'].includes(r.data.stage)?'A':r.data.stage,baPackage:pack},m,'B·A 제작 및 검수 기록 저장',{before:r.data.baPackage||null,after:pack}));
 }catch(e){return fail(e)}}
