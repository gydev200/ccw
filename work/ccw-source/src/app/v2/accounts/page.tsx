import ServiceAccountSettings from '@/versions/v2/app/service-account-settings';
import BrandHome from '@/versions/v2/app/brand-home';
import {member} from '@/lib/server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page(){let m;try{m=await member(true)}catch{redirect('/login')}if(m.mustChangePassword)redirect('/password');if(m.role!=='DO'&&m.workspaceVersion!=='v2')redirect('/employee');return <main style={{maxWidth:1000,margin:'32px auto',padding:20}}><BrandHome/><p style={{margin:'20px 0'}}><a href="/v2">버전 2로 돌아가기</a></p><ServiceAccountSettings/></main>}
