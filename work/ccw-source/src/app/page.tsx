import Workspace from './workspace';
import {member} from '@/lib/server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){let m;try{m=await member(true)}catch{}if(m?.workspaceVersion==='v2')redirect('/v2');return <Workspace/>}
