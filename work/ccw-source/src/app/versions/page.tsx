import BrandHome from '../brand-home';
import {db,member} from '@/lib/server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function VersionsPage(){
 let m;try{m=await member(true)}catch{redirect('/login')}
 if(m.mustChangePassword)redirect('/password');
 if(m.role!=='DO'&&m.workspaceVersion!=='v2')redirect('/employee');
 const preview=await db().prepare("SELECT m.person,m.label,m.active FROM settings s JOIN members m ON m.id=json_extract(s.value,'$.memberId') WHERE s.key='credential:ccw32'").first<{person:string;label:string;active:number}>();
 const connected=preview?.person==='kyunghwa'&&preview?.active===1;
 return <main style={{maxWidth:720,margin:'48px auto',padding:24}}><BrandHome/>
  <h1 style={{fontSize:28,margin:'28px 0 16px'}}>차트클린 웍스 버전 관리</h1>
  <section className="panel"><h2>기존 버전 · DO</h2><p>현재 운영 화면을 유지합니다. 검수한 변경만 반영합니다.</p><a href="/">DO 화면 열기</a></section>
  <section className="panel"><h2>버전 2 · 고경화 검수 화면</h2><p>ccw32 · {preview?.label||'계정 확인 필요'}</p><p>{connected?'계정 연결 확인 완료':'계정 연결을 확인해 주세요'}</p><p>기존 DO 화면을 복사했습니다. 고경화 계정은 로그인 후 버전 2로 연결됩니다. 운영 데이터는 조회하며 저장 요청은 차단합니다.</p><a href="/v2">버전 2 화면 열기</a></section>
  <section className="panel"><h2>반영과 복원</h2><p>고경화 화면 수정 → 검수 → DO 반영 승인 → 운영 반영 순서로 진행합니다.</p><p>기존 버전의 소스와 배포를 보관했습니다. “기존 버전으로 가” 요청 시 해당 배포로 복원하며 현재 업무 데이터는 유지합니다.</p></section>
 </main>;
}
