import {db,member,json,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){try{const m=await member(true);let previewAccount;
 if(m.role==='DO')previewAccount=await db().prepare("SELECT m.person,m.label,m.active FROM settings s JOIN members m ON m.id=json_extract(s.value,'$.memberId') WHERE s.key='credential:ccw32'").first();
 return json({version:m.workspaceVersion||'existing',previewPath:'/v2',previewAccount,previewReadOnly:true});
}catch(e){return fail(e)}}
