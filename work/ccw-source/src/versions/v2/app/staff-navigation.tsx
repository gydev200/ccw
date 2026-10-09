'use client';
import type {ReactNode} from 'react';
import {CalendarDays,ListTodo,FileText,Clock3,BookOpen,UserRound,Settings,ArrowLeft} from 'lucide-react';
import ApprovalNavigation,{type ApprovalView} from './approval-navigation';
import s from './staff-navigation.module.css';
export default function StaffNavigation({active,onNavigate,approvalView,onApproval,name,switcher}:{active:string;onNavigate:(tool:string)=>void;approvalView:ApprovalView;onApproval:(view:ApprovalView)=>void;name:string;switcher:ReactNode}){
const approval=['전자결재','휴가 신청','계정 신청','계정 신청 현황'].includes(active);
const items=[['내 업무','내 업무',CalendarDays],['업무함','업무 일지',ListTodo],['전자결재','결재·신청',FileText],['출퇴근·휴가','출퇴근',Clock3],['공지·일정','공지·일정',CalendarDays],['교육·매뉴얼','교육·매뉴얼',BookOpen],['내 인사·고과','내 인사·고과',UserRound],['계정·설정','계정·설정',Settings]] as const;
const selected=(id:string)=>id==='내 업무'?active==='오늘 업무 계획':id==='교육·매뉴얼'?active==='교육·오리엔테이션':id==='출퇴근·휴가'?active==='출근·휴가':active===id;
return <div className={s.root}><header><b>{approval?'결재·신청':'내 업무'}</b><span>{approval?'문서함 · 신청 현황':'직원 메뉴'}</span></header>{approval?<><button className={s.back} onClick={()=>onNavigate('내 업무')}><ArrowLeft size={15}/>직원 메뉴로</button><div className={s.fullApproval}><ApprovalNavigation active={active==='전자결재'?approvalView:undefined} onSelect={onApproval} name={name} onSettings={()=>onNavigate('계정·설정')} embedded/><div className="approval-side-group"><h2>신청·현황</h2>{['휴가 신청','계정 신청','계정 신청 현황'].map(tool=><button key={tool} aria-current={active===tool?'page':undefined} onClick={()=>onNavigate(tool)}><FileText size={17}/><span>{tool}</span></button>)}</div></div></>:<nav aria-label="직원 업무 메뉴">{items.map(([id,label,Icon])=><div key={id}><button aria-current={selected(id)?'page':undefined} onClick={()=>id==='전자결재'?onApproval('all'):onNavigate(id)}><Icon size={17}/><span>{label}</span></button></div>)}</nav>}<footer><b>{name}</b>{switcher}</footer></div>;
}
