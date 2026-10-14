import {db,member,origin,json,fail,HttpError} from '@/lib/server';
import {supabaseAdmin} from '@/lib/supabase-adapter';
export async function POST(req:Request){try{
 origin(req);const m=await member();const raw=await req.text();if(raw.length>2000)throw new HttpError(413,'첨부 정보를 확인해 주세요.');const b=JSON.parse(raw);
 if(typeof b.name!=='string'||!b.name||b.name.length>300||typeof b.type!=='string'||b.type.length>150||!Number.isSafeInteger(b.size)||b.size<=0||b.size>40*1024*1024)throw new HttpError(400,'파일당 40MB 이하로 첨부해 주세요.');
 const count=await db().prepare("SELECT count(*) AS n FROM settings WHERE key LIKE 'upload-stage:%' AND json_extract(value,'$.memberId')=? AND CAST(json_extract(value,'$.expiresAt') AS INTEGER)>?").bind(m.id,Date.now()).first<{n:number}>();if((count?.n||0)>=30)throw new HttpError(429,'첨부 준비가 많습니다. 기존 첨부를 완료해 주세요.');
 const id=crypto.randomUUID(),key='incoming/'+id;const {data,error}=await supabaseAdmin().storage.from(process.env.SUPABASE_FILES_BUCKET||'chartclean-works-private').createSignedUploadUrl(key,{upsert:false});
 if(error||!data)throw new HttpError(503,'첨부 저장소 확인 필요');
 await db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('upload-stage:'+id,JSON.stringify({memberId:m.id,key,name:b.name,type:b.type,size:b.size,expiresAt:Date.now()+2*60*60*1000})).run();
 return json({id,url:data.signedUrl});
}catch(e){return fail(e)}}
