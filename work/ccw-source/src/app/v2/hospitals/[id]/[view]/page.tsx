import {redirect,notFound} from 'next/navigation';
import {hospitalEditor,existingHospital} from '@/lib/v2-hospital-access';
import {db} from '@/lib/server';
import HospitalScreenPreview from '@/versions/v2/app/hospital-screen-preview';
import BrandHome from '@/versions/v2/app/brand-home';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string;view:string}>}){
 try{await hospitalEditor()}catch{redirect('/login')}
 const {id,view}=await params;if(!['patient','staff'].includes(view))notFound();let hospital;try{hospital=await existingHospital(Number(id))}catch{notFound()}
 const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind('v2-hospital-profile:'+id).first<{value:string}>();const saved=row?JSON.parse(row.value):null;
 const data=JSON.parse(hospital.data);return <main style={{maxWidth:900,margin:'32px auto',padding:20}}><BrandHome/><p><a href="/v2#ss-setup">병원 세팅으로 돌아가기</a></p>{saved?.confirmed?<HospitalScreenPreview name={data.setupName||data.name} profile={saved.confirmed} mode={view as 'patient'|'staff'} confirmed/>:<p>아직 이 병원의 세팅을 확정하지 않았습니다.</p>}</main>;
}
