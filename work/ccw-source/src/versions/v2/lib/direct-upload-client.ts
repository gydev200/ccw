'use client';
export function uploadForm(url:string,form:FormData){
 const files:File[]=[];const fields:Record<string,string>={};let field='file';
 for(const [name,value] of form.entries()){if(value instanceof File){files.push(value);field=name;}else fields[name]=value;}
 return uploadAttachments(url,files,fields,field);
}
export async function uploadAttachments(url:string,files:File[],fields:Record<string,string>={},field='file'){
 const uploads:string[]=[];
 for(const file of files){
  const prepare=await fetch('/api/file-transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,type:file.type,size:file.size})});
  const ticket=await prepare.json() as {id:string;url:string;error?:string};if(!prepare.ok)throw Error(ticket.error||'첨부 준비 실패');
  const body=new FormData();body.append('cacheControl','0');body.append('',file);
  const uploaded=await fetch(ticket.url,{method:'PUT',headers:{'x-upsert':'false'},body});
  if(!uploaded.ok)throw Error('첨부 원본을 올리지 못했습니다. 다시 시도해 주세요.');uploads.push(ticket.id);
 }
 return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'uploaded',uploads,fields,field})});
}
