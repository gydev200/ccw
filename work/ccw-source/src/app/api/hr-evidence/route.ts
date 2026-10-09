import {db,member,json,fail,HttpError} from '@/lib/server';
import {hrManagerAllowed} from '@/lib/dss-navigation';
export const dynamic='force-dynamic';
const kinds={logs:['academy_log'],reviews:['academy_attempt','academy_review','academy_metric']} as const;
export async function GET(req:Request){try{
 const m=await member();if(!hrManagerAllowed(m))throw new HttpError(403,'인사 담당 계정에서만 확인할 수 있습니다.');
 const view=new URL(req.url).searchParams.get('view');if(view!=='logs'&&view!=='reviews')throw new HttpError(400,'기록 종류를 확인해 주세요.');
 const selected=kinds[view];const placeholders=selected.map(()=>'?').join(',');
 const rows=(await db().prepare(`SELECT id,kind,person,data,updated_at FROM hr_entries WHERE kind IN (${placeholders}) ORDER BY updated_at DESC,id DESC LIMIT 200`).bind(...selected).all<any>()).results;
 return json({rows:rows.map(r=>{const d=JSON.parse(r.data);return {id:r.id,kind:r.kind,person:r.person,title:String(d.title||d.org||'기록'),date:String(d.date||d.start||''),status:String(d.status||''),taskRef:String(d.taskRef||''),evidence:String(d.evidence||''),updatedAt:r.updated_at}})});
 }catch(e){return fail(e)}}
