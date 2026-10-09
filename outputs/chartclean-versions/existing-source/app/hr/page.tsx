import BrandHome from '../brand-home';
import PublicExam from '../exam/page';
import {redirect} from 'next/navigation';
import {member} from '@/lib/server';
import AcademyPanel from '../academy-panel';
export const dynamic='force-dynamic';
export default async function HR(){let m;try{m=await member(true)}catch{return <PublicExam/>};if(m.mustChangePassword)redirect('/password');if(m.role!=='DO'&&m.access&&!m.access.screens.includes('교육·오리엔테이션'))return <main><h1>교육 화면 접근이 설정되지 않았습니다.</h1><a href='/orders'>내 업무로</a></main>;return <main style={{maxWidth:1320,margin:'0 auto',padding:'24px 20px'}}><p><BrandHome/> · <a href="https://chartclean-learning.happyshs747.chatgpt.site/suhyun.html">수현님 1차 교육</a></p><AcademyPanel member={m} initialTab="exam" initialPerson={m.role==='DO'?'human-6d5d7680-9693-4df0-8aca-4389892bbe14':m.person}/></main>}
