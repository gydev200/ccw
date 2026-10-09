import Workspace from '@/versions/v2/app/workspace';
import {member} from '@/lib/server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){let m;try{m=await member(true)}catch{redirect('/login')}if(m.mustChangePassword)redirect('/password');if(m.workspaceVersion!=='v2'&&m.role!=='DO')redirect('/');return <Workspace/>}
