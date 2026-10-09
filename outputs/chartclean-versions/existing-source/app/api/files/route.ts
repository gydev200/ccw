import {member,record,db,bucket,now,json,fail,origin,HttpError} from '@/lib/server';
import {restoreUploadRequest} from '@/lib/direct-upload-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const m=await member();const id=new URL(req.url).searchParams.get('id');const f=await db().prepare('SELECT * FROM files WHERE id = ?').bind(id).first<any>();if(!f)throw new HttpError(404,'파일을 찾을 수 없습니다.');await record(f.record_id,m);const obj=await bucket().get(id!);if(!obj)throw new HttpError(404,'파일이 없습니다.');return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 origin(req);const m=await member();req=await restoreUploadRequest(req,m.id);const max=11*1024*1024;if(Number(req.headers.get('content-length')||0)>max)throw Error('첨부는 10MB 이하로 등록해 주세요.');
 if(!req.body)throw Error('파일을 선택해 주세요.');const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('첨부는 10MB 이하로 등록해 주세요.');}chunks.push(value)}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}const form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const r=await record(Number(form.get('recordId')),m);if(r.kind!=='task')throw Error('업무를 선택해 주세요.');if(['완료','보류'].includes(r.data.status)||(r.data.status==='등록 판단 대기'&&!r.data.customRequest))throw Error('진행 중인 업무에 첨부해 주세요.');if(r.version!==Number(form.get('version')))throw new HttpError(409,'업무가 변경됐습니다. 새로고침 후 다시 첨부해 주세요.');
 const file=form.get('file');if(!(file instanceof File)||file.size>10*1024*1024||!file.size)throw Error('10MB 이하의 파일을 선택해 주세요.');const id=crypto.randomUUID();await bucket().put(id,file.stream());const ts=now();const data={...r.data,approvedRevision:null,execution:''};if(data.revision>0)data.status='DO 판단 대기';
 try{const out=await db().batch([
 db().prepare('UPDATE records SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(data),ts,r.id,r.version),
 db().prepare('INSERT INTO files (id,record_id,org,name,type,size,actor,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes() > 0').bind(id,r.id,r.org,file.name.slice(0,300),file.type,file.size,m.id,ts),
 db().prepare('INSERT INTO events (record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes() > 0').bind(r.id,r.org,m.id,'첨부 등록 · 현재 결과 재판단',JSON.stringify({id,name:file.name}),ts)
 ]);if(!out[0].meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 첨부해 주세요.');}catch(e){await bucket().delete(id);throw e}return json({id,name:file.name},201)
}catch(e){return fail(e)}}
