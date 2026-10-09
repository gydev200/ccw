'use client';
import {useState,useEffect, type ReactNode} from 'react';
import './cchr-home.css';
import {HR_OWNER,HR_WORK,type HrWorkId} from '@/lib/hr-department';

export const CCHR_WORK = HR_WORK;
type WorkId=HrWorkId;
export type MenuId=WorkId|'home'|'consult';
type Props={activeMenu?:MenuId;onMenuChange?:(id:MenuId)=>void;hideSidebar?:boolean;renderSection?:(id:WorkId|'consult')=>ReactNode; available?:Partial<Record<WorkId|'consult',string>>;visibleIds?:WorkId[]};

export default function CchrHome({renderSection,available={},activeMenu,onMenuChange,hideSidebar=false,visibleIds}:Props){
 const [localActive,setActive]=useState<MenuId>('home');const active=activeMenu||localActive;
 const [opened,setOpened]=useState<MenuId[]>(['home']);
 const items=visibleIds?CCHR_WORK.filter(item=>visibleIds.includes(item.id)):CCHR_WORK;
 useEffect(()=>{setOpened(old=>old.includes(active)?old:[...old,active]);},[active]);
 const select=(id:MenuId)=>{if(onMenuChange)onMenuChange(id);else setActive(id);setOpened(old=>old.includes(id)?old:[...old,id]);};
 const selected=CCHR_WORK.find(item=>item.id===active);
 return <section className="cchr-home" aria-label="CCHR 인사관리">
  <header className="cchr-header"><div><small>DSS / 인사관리</small><h2>인사부서 <span className="cchr-owner">담당 {HR_OWNER}</span></h2></div><nav aria-label="인사 상단 메뉴"><button aria-pressed={active==='home'} onClick={()=>select('home')}>업무현황</button>{!visibleIds&&<><button aria-pressed={active==='consult'} onClick={()=>select('consult')}>인사 상담</button><button aria-pressed={active==='report'} onClick={()=>select('report')}>보고받기</button></>}</nav></header>
  <div className="cchr-layout" style={hideSidebar?{gridTemplateColumns:"minmax(0,1fr)"}:undefined}><nav hidden={hideSidebar} className="cchr-menu" aria-label="인사 업무 메뉴"><button aria-current={active==='home'?'page':undefined} onClick={()=>select('home')}>해야 할 업무</button>{items.map(item=><button key={item.id} aria-current={active===item.id?'page':undefined} onClick={()=>select(item.id)}>{item.name}</button>)}</nav>
   <div className="cchr-content">
    <div hidden={active!=='home'}><h3>해야 할 업무</h3><p>채용부터 퇴사까지 직원별 근무, 직무, 교육, 평가와 보상을 이어 관리합니다. 이사회와 자문단도 이곳에서 관리합니다.</p><div className="cchr-flow" aria-label="인사 업무 흐름">채용·회사 소개 → 입사·계약 → 근무·교육·시험 → 정기 평가·보상 → 퇴사·인계</div><div className="cchr-cards">{items.map(item=><article key={item.id}><small>{item.cycle}</small><h4>{item.name}</h4><ul>{item.tasks.map(task=><li key={task}>{task}</li>)}</ul><p className="cchr-evidence">남길 기록: {item.evidence}</p><button onClick={()=>select(item.id)}>{item.name} 열기</button></article>)}</div></div>
    {active!=='home'&&<div className="cchr-section-heading"><h3>{selected?.name||'인사 상담'}</h3>{selected&&<><p>{selected.cycle}</p><ul>{selected.tasks.map(task=><li key={task}>{task}</li>)}</ul></>}</div>}
    {opened.filter(id=>id!=='home').map(id=><div key={id} hidden={active!==id}>{available[id as WorkId|'consult']?<><p className="cchr-state">{available[id as WorkId|'consult']}</p>{renderSection?.(id as WorkId|'consult')}</>:<div className="cchr-preparing"><b>{id==='consult'?'인사 상담 연결 준비':'기록 기능 연결 준비'}</b><p>{id==='consult'?'인사 규정과 확인된 직원 기록을 근거로 상담하고, 답변과 확인 사항을 남기는 업무입니다. 자동 상담은 아직 연결되지 않았습니다.':id==='report'?'원본 기록을 연결한 보고 기능을 준비 중입니다. 아직 자동 생성된 보고가 없습니다.':'위 업무를 처리할 입력·조회 기능을 연결 중입니다. 현재 화면은 해야 할 업무를 안내합니다.'}</p></div>}</div>)}
   </div>
  </div>
 </section>;
}
