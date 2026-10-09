import {member,origin,HttpError,fail} from '@/lib/server';
export const dynamic='force-dynamic';
const upstream='https://chartclean-account-vault.workspace-154307.chatgpt.site';
const base='/v2/electronic-approval';
const assetVersion=encodeURIComponent(process.env.VERCEL_URL||'local');
const assets=new Set(['','employee','director','app.js','approval-ui.js','style.css','wordmark.png','icon-192.png','manifest.webmanifest']);
const apis=new Set(['demo-start','state','preview-switch','logout','approval-draft','approval','approval-withdraw','approval-decision','attachment-upload','attachment-download','request','decision','reveal','account','archive','revoke']);
async function proxy(req:Request,{params}:{params:Promise<{path?:string[]}>}){
 try{
  const m=await member(true);if(m.mustChangePassword||m.workspaceVersion!=='v2'&&m.role!=='DO')throw new HttpError(403,'버전 2에서만 열 수 있습니다.');
  const {path=[]}=await params;const route=path.join('/');
  const api=path.length===2&&path[0]==='api'&&apis.has(path[1]);
  if(!(req.method==='GET'&&assets.has(route)||api&&((path[1]==='state'&&req.method==='GET')||(path[1]!=='state'&&req.method==='POST'))))throw new HttpError(404,'화면을 찾을 수 없습니다.');
  if(req.method==='POST')origin(req);
  const headers=new Headers();headers.set('Origin',upstream);
  const cookie=/(?:^|; )demo_session=([a-f0-9]+)/.exec(req.headers.get('cookie')||'');if(api&&cookie)headers.set('Cookie','demo_session='+cookie[1]);
  let body;if(req.method==='POST'){if(!req.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'요청 형식을 확인하세요.');headers.set('Content-Type','application/json');body=await req.text();if(body.length>4300000)throw new HttpError(413,'파일은 3MB 이내로 선택하세요.');}
  const res=await fetch(upstream+'/'+route,{method:req.method,headers,body,...(api?{cache:'no-store' as const}:{next:{revalidate:300}}),redirect:'error',signal:AbortSignal.timeout(25000)});
  const out=new Headers({'Content-Type':res.headers.get('content-type')||'application/octet-stream','Cache-Control':api?'no-store':'private, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  const setCookie=res.headers.get('set-cookie');if(setCookie?.startsWith('demo_session='))out.set('Set-Cookie',setCookie.replace(/Path=\//i,'Path='+base));
  if(api)return new Response(await res.arrayBuffer(),{status:res.status,headers:out});
  if(['app.js','approval-ui.js','style.css','employee','director',''].includes(route)){
   let text=await res.text();
   if(['','employee','director'].includes(route))text=text.replace('<html lang="ko"','<html class="embedded" lang="ko"').replace(/(src|href)="\//g,'$1="'+base+'/');
   if(['','employee','director'].includes(route))text=text.replace(/(app\.js|approval-ui\.js|style\.css)"/g,'$1?v='+assetVersion+'"');
   if(route==='app.js'){
    text=text.replace('throw Error(result.error);','throw Object.assign(Error(result.error),{status:res.status});');
    text=text.replace("await api('demo-start',{}); await refresh(false);","try{await refresh(false);}catch(e){if(e.status!==401)throw e;await api('demo-start',{});await refresh(false);}");

    text=text.replace('src="/wordmark.png"','src="'+base+'/wordmark.png"');
    text=text.replace("if(approvalBase&&location.pathname.endsWith('/employee')&&data.user.role!=='employee'){await api('preview-switch',{role:'employee'});await refresh(false);}","if(approvalBase){const requestedRole=location.pathname.endsWith('/director')?'director':'employee';if(data.user.role!==requestedRole){await api('preview-switch',{role:requestedRole});await refresh(false);}}");
    text=text.replace("tab ||= 'approvals'; render();",`const view=new URLSearchParams(location.search).get('view')||'all';tab=view==='history'?'requests':'approvals';approvalFilter=({inbox:'pending',compose:'all',history:'all'})[view]||view;if(view==='compose')editor={type:'approval'};render();`);
    text=text.replace(/\ninit\(\);/,`\nconst embeddedRender=render;render=function(){embeddedRender();parent.postMessage({type:'ccw-approval-view',view:editor?.type==='approval'?'compose':tab==='requests'?'history':data.user.role==='director'?(approvalFilter==='pending'?'inbox':'processed'):approvalFilter||'all'},location.origin);parent.postMessage({type:'ccw-approval-ready'},location.origin);};
window.addEventListener('message',async event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='ccw-approval-navigate')return;const view=event.data.view;if(!['all','draft','pending','approved','cancelled','history','compose','inbox','processed'].includes(view)||!data)return;try{const role=['inbox','processed'].includes(view)?'director':'employee';if(data.user.role!==role){await api('preview-switch',{role});await refresh(false);}editor=view==='compose'?{type:'approval'}:null;tab=view==='history'?'requests':'approvals';approvalFilter=({inbox:'pending',compose:'all',history:'all'})[view]||view;parent.postMessage({type:'ccw-approval-dirty',dirty:false},location.origin);render();}catch(e){toast(e.message);parent.postMessage({type:'ccw-approval-ready'},location.origin);}});
init();`);

   }
   if(route==='approval-ui.js')text=text.replace("(approvalFilter==='all'||r.status===approvalFilter)","(approvalFilter==='processed'?['approved','rejected','withdrawn'].includes(r.status):approvalFilter==='cancelled'?['rejected','withdrawn'].includes(r.status):approvalFilter==='all'||r.status===approvalFilter)");
   if(route==='style.css')text+='\n.embedded .topbar,.embedded .sidebar,.embedded .workspace-topbar,.embedded .approval-filters{display:none}.embedded .main{padding:8px 4px 24px}.embedded .compose-page{max-width:920px;margin-inline:auto}';
   return new Response(text,{status:res.status,headers:out});
  }
  return new Response(await res.arrayBuffer(),{status:res.status,headers:out});
 }catch(e){return fail(e);}
}
export const GET=proxy;export const POST=proxy;
