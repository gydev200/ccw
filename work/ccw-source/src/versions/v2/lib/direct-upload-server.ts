import 'server-only';
import {db,bucket,HttpError} from './server';
export async function restoreUploadRequest(req:Request,memberId:string){
 if(!req.headers.get('content-type')?.startsWith('application/json'))return req;
 const raw=await req.text();if(raw.length>12000)throw new HttpError(413,'첨부 요청이 너무 큽니다.');
 const b=JSON.parse(raw);if(b.action!=='uploaded')return new Request(req.url,{method:'POST',headers:req.headers,body:raw});
 if(!Array.isArray(b.uploads)||!b.uploads.length||b.uploads.length>6)throw new HttpError(400,'첨부를 확인해 주세요.');
 const form=new FormData();let total=0;
 for(const [name,value] of Object.entries(b.fields||{})){if(!['recordId','version'].includes(name)||typeof value!=='string')throw new HttpError(400,'첨부 대상 확인 필요');form.append(name,value);}
 for(const id of b.uploads){
  if(typeof id!=='string'||! /^[0-9a-f-]{36}$/.test(id))throw new HttpError(400,'첨부 번호 확인 필요');
  const key='upload-stage:'+id;const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();
  if(!row)throw new HttpError(404,'첨부 준비 정보가 없습니다.');const stage=JSON.parse(row.value);
  if(stage.memberId!==memberId||stage.expiresAt<Date.now()||stage.used)throw new HttpError(403,'첨부 권한 또는 유효시간 확인 필요');
  total+=stage.size;if(total>30*1024*1024)throw new HttpError(413,'첨부 합계는 30MB 이하입니다.');
  const obj=await bucket().get(stage.key);if(!obj)throw new HttpError(409,'파일 업로드 완료 후 다시 시도해 주세요.');
  if(obj.size!==stage.size)throw new HttpError(400,'첨부 크기가 일치하지 않습니다.');
  const bytes=await obj.arrayBuffer();
  const claim=await db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify({...stage,used:true}),key,row.value).run();if(!claim.meta.changes)throw new HttpError(409,'이미 처리된 첨부입니다.');
  form.append(b.field==='files'?'files':'file',new File([bytes],stage.name,{type:stage.type}));
  await bucket().delete(stage.key);
  await db().prepare('DELETE FROM settings WHERE key=?').bind(key).run();
 }
 const headers=new Headers(req.headers);headers.delete('content-type');headers.delete('content-length');
 return new Request(req.url,{method:'POST',headers,body:form});
}
