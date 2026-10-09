'use client';
import {useEffect,useState} from 'react';
import CchrHome,{type MenuId} from './cchr-home';
import AcademyPanel from './academy-panel';
import HrPanel from './hr-panel';
import HrRoleGuide from './hr-role-guide';
import HrDepartmentWork from './hr-department-work';
import HrPeopleRegistry from './hr-people-registry';
import HrComplianceGuide from './hr-compliance-guide';
import HrRecruitingBrand from './hr-recruiting-brand';
import HrSourceGuide from './hr-source-guide';
import HrTeamEvidence from './hr-team-evidence';
import ControlPanel from './control-panel';
import {dssAllowed,hrManagerAllowed,validDssTab} from '@/lib/dss-navigation';
import {HR_WORK,type HrWorkId} from '@/lib/hr-department';
import './dss-management.css';
import CCFM from './ccfm';
import HrRecordSummary from './hr-record-summary';
export default function DssManagement({tab,onNavigate,member,state,onReload,onTask}:any){
 const [hrTab,setHrTab]=useState<MenuId>('home'),[fmTab,setFmTab]=useState('home'),[fmOpened,setFmOpened]=useState(false);
 useEffect(()=>{if(!validDssTab(tab,member))return;const [g,id]=tab.split(':');if(g==='HR')setHrTab(id as MenuId);else if(g==='FM'){setFmTab(id);setFmOpened(true)}},[tab,member?.id]);
 if(!dssAllowed(member))return null;
 const isDO=member.role==='DO';
 const isHrManager=hrManagerAllowed(member);
 const tasks=(state.records||[]).filter((r:any)=>r.kind==='task'&&r.org==='DSS');
 const work=(id:HrWorkId)=>isHrManager?<HrDepartmentWork section={id} member={member}/>:null;
 const available=Object.fromEntries(HR_WORK.map(item=>[item.id,'업무별 처리 내용과 근거를 서버에 저장하고 변경 이력을 확인합니다.']));
 function section(id:HrWorkId|'consult'){
  if(id==='consult')return null;
  if(id==='people')return <>{isDO&&<><HrRecordSummary member={member} view="people"/></>}<HrPeopleRegistry/>{work(id)}</>;
  if(id==='sources')return <><HrSourceGuide/>{work(id)}</>;
  if(id==='report')return <>{isDO&&<HrRecordSummary member={member} view="report"/>}{work(id)}</>;
  if(id==='documents')return work(id);
  if(id==='recruiting')return <><HrRoleGuide onNavigate={onNavigate}/><HrPanel view="recruiting" member={member}/>{work(id)}</>;
  if(id==='brand')return <><HrRecruitingBrand onNavigate={onNavigate}/>{work(id)}</>;
  if(id==='labor')return <><ControlPanel section="출근·휴가" member={member} tasks={tasks} openTask={onTask} onChange={onReload}/>{work(id)}</>;
  if(id==='education')return <><AcademyPanel member={member}/>{work(id)}</>;
  if(id==='logs')return <>{isHrManager&&<HrTeamEvidence view="logs"/>}<AcademyPanel member={member} initialTab="log"/>{work(id)}</>;
  if(id==='reviews')return <>{isHrManager&&<HrTeamEvidence view="reviews"/>}<AcademyPanel member={member} initialTab="profile"/>{work(id)}</>;
  if(id==='lifecycle')return work(id);
  if(id==='compliance')return <><HrComplianceGuide/>{work(id)}</>;
  return work(id);
 }
 return <div className="dss-management">
  <div hidden={!tab.startsWith('HR:')}><CchrHome hideSidebar visibleIds={isHrManager?undefined:['labor','education','logs']} activeMenu={hrTab} onMenuChange={id=>onNavigate('HR:'+id)} available={available} renderSection={section}/></div>
  {isDO&&fmOpened&&<div hidden={!tab.startsWith('FM:')}><CCFM activeSection={fmTab} onSectionChange={id=>onNavigate('FM:'+id)} hideSidebar/></div>}
 </div>;
}
