'use client';
import BrandHome from './brand-home';
import {useEffect,useState} from 'react';
import AcademyPanel from './academy-panel';
import ControlPanel from './control-panel';
import './employee-hub.css';
export default function EmployeeHub(){
 const [member,setMember]=useState<any>(null),[error,setError]=useState(''),[section,setSection]=useState('growth'),[attendanceOpened,setAttendanceOpened]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let alive=true;fetch('/api/auth',{cache:'no-store'}).then(async r=>{const data=await r.json() as any;if(!r.ok)throw Error(data.error||'로그인과 계정 권한을 확인해 주세요.');if(!alive)return;if(data.member?.mustChangePassword){window.location.replace('/password');return;}if(data.member?.role!=='DO'&&data.member?.access&&!data.member.access.screens.includes('내 인사·고과'))throw Error('이 계정에 개인 인사 화면이 배정되지 않았습니다. 담당자에게 확인해 주세요.');setMember(data.member)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[]);
 return <main className="employee-hub"><header><BrandHome/><h1>내 인사·고과</h1>{member&&<p>{member.label} · {member.role==='DO'?'직원별 교육·고과 관리':'본인의 업무일지·교육·고과와 근태 기록'}</p>}<p>업무일지와 평가 근거는 기존 기록에 저장됩니다.</p></header>
 {error?<section role="alert"><p>{error}</p><a href="/login">로그인·비밀번호 변경으로</a></section>:!member?<p role="status">계정 권한을 확인하고 있습니다.</p>:<><nav aria-label="개인 인사 메뉴"><button aria-current={section==='growth'?'page':undefined} onClick={()=>setSection('growth')}>고과·교육·업무일지</button><button aria-current={section==='attendance'?'page':undefined} onClick={()=>{setAttendanceOpened(true);setSection('attendance')}}>출퇴근·휴가</button>{member.person==='kimkiyoung'&&<a href="/#hr">인사부서 업무 열기</a>}</nav><div hidden={section!=='growth'}><AcademyPanel member={member} initialTab="profile" initialPerson={member.role==='DO'?'':member.person}/></div>{attendanceOpened&&<div hidden={section!=='attendance'}><ControlPanel section="출근·휴가" member={member} tasks={[]} onChange={()=>setRevision(revision+1)} openTask={()=>{}}/></div>}</>}
 </main>
}
