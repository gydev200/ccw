from pathlib import Path
import shutil, json
root=Path(__file__).parent/'ccw-source/src'
def edit(path,old,new):
 p=root/path;s=p.read_text(encoding='utf-8');assert old in s,path;p.write_text(s.replace(old,new),encoding='utf-8')
(root/'lib/workspace-version.ts').write_text("export function workspaceVersion(username:string,person:string){return username==='ccw32'&&person==='kyunghwa'?'v2':'existing';}\n",encoding='utf-8')
edit('lib/server.ts',"import { env }", "import {headers} from 'next/headers';\nimport {workspaceVersion} from './workspace-version';\nimport { env }")
edit('lib/server.ts',"const access=await db()", "const credentialIndex=await db().prepare('SELECT value FROM settings WHERE key=?').bind('credential-member:'+m.id).first<any>();const version=workspaceVersion(credentialIndex?.value||'',m.person);if(version==='v2'&&!allowPasswordChange){const method=(await headers()).get('x-ccw-method');if(method&&method!=='GET'&&method!=='HEAD')throw new HttpError(403,'버전 2 검수 화면입니다. 운영 데이터 변경은 DO 화면에서 진행해 주세요.');}const access=await db()")
edit('lib/server.ts',"return {...m,access:","return {...m,role:version==='v2'&&!allowPasswordChange?'DO':m.role,workspaceVersion:version,access:")
edit('lib/model.ts',"export type Member={", "export type Member={workspaceVersion?:'existing'|'v2';")
edit('lib/login-destination.ts',"member:{role:string}","member:{role:string;workspaceVersion?:string}")
edit('lib/login-destination.ts',"if(member.role!=='DO')", "if(member.workspaceVersion==='v2')return '/v2';\n if(member.role!=='DO')")
edit('app/api/auth/route.ts',"import {env}", "import {workspaceVersion} from '@/lib/workspace-version';\nimport {env}")
edit('app/api/auth/route.ts',"member:{person:m.person,role:m.role,label:m.label}","member:{person:m.person,role:m.role,label:m.label,workspaceVersion:workspaceVersion(username,m.person)}")
edit('app/api/auth/route.ts',"mustChangePassword:m.mustChangePassword", "workspaceVersion:m.workspaceVersion,mustChangePassword:m.mustChangePassword")
edit('app/employee/page.tsx',"if(m.mustChangePassword)redirect('/password');", "if(m.mustChangePassword)redirect('/password');\n if(m.workspaceVersion==='v2')redirect('/v2');")
edit('middleware.ts',"return NextResponse.next()", "const requestHeaders=new Headers(req.headers);requestHeaders.set('x-ccw-method',req.method);return NextResponse.next({request:{headers:requestHeaders}})")
edit('middleware.ts',"matcher:['/s1/:path*','/api/s1/:path*','/s1-before-emr/:path*']", "matcher:['/api/:path*','/s1/:path*','/s1-before-emr/:path*']")
(root/'app/page.tsx').write_text("import Workspace from './workspace';\nimport {member} from '@/lib/server';\nimport {redirect} from 'next/navigation';\nexport const dynamic='force-dynamic';\nexport default async function Page(){let m;try{m=await member(true)}catch{}if(m?.workspaceVersion==='v2')redirect('/v2');return <Workspace/>}\n",encoding='utf-8')
# Independent copy of frontend modules and their imports. Server APIs stay canonical.
dest=root/'versions/v2'
for folder in ['lib','components','hooks','data']:
 shutil.copytree(root/folder,dest/folder,dirs_exist_ok=True)
(dest/'app').mkdir(parents=True,exist_ok=True)
for p in (root/'app').iterdir():
 if p.is_file() and p.name not in ['page.tsx','layout.tsx']:
  shutil.copy2(p,dest/'app'/p.name)
for p in dest.rglob('*'):
 if p.is_file() and p.suffix in ['.ts','.tsx','.css']:
  s=p.read_text(encoding='utf-8')
  for folder in ['lib','components','hooks','data','app']:
   s=s.replace('@/'+folder+'/', '@/versions/v2/'+folder+'/')
  p.write_text(s,encoding='utf-8')
(root/'app/v2').mkdir(exist_ok=True)
(root/'app/v2/page.tsx').write_text("import Workspace from '@/versions/v2/app/workspace';\nimport {member} from '@/lib/server';\nimport {redirect} from 'next/navigation';\nexport const dynamic='force-dynamic';\nexport default async function Page(){let m;try{m=await member(true)}catch{redirect('/login')}if(m.mustChangePassword)redirect('/password');if(m.workspaceVersion!=='v2')redirect('/');return <Workspace/>}\n",encoding='utf-8')
print('Independent v2 snapshot and ccw32 routing created')
