import BrandHome from '../brand-home';
import {redirect} from 'next/navigation';
import {member} from '@/lib/server';
import WorkOrdersPanel from '../work-orders-panel';
export const dynamic='force-dynamic';
export default async function EmployeePage(){
 let m;try{m=await member(true)}catch{redirect('/login?next=/employee')}
 if(m.mustChangePassword)redirect('/password');
 if(m.workspaceVersion==='v2')redirect('/v2');
 if(m.role==='DO')return <main style={{maxWidth:620,margin:'10vh auto',padding:28}}><BrandHome/><h1 style={{fontSize:28}}>직원 전용 업무 공간</h1><p style={{margin:'20px 0'}}>현재 대표 계정으로 로그인되어 있습니다. 직원은 본인 계정으로 로그인하면 담당 상사와 배정된 업무만 볼 수 있습니다.</p><p><a href="/login?next=/employee">직원 계정으로 로그인</a></p><p style={{marginTop:20}}><a href="/orders">대표 업무 관리로 돌아가기</a></p></main>;
 return <main style={{maxWidth:1420,margin:'0 auto',padding:'24px 20px'}}><BrandHome/><WorkOrdersPanel member={m}/></main>;
}
