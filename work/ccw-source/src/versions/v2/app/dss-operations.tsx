'use client';
import {useState} from 'react';
import {NAME, type RecordRow} from '@/versions/v2/lib/model';
import {kstDay} from '@/versions/v2/lib/work-orders';
import './dss-operations.css';
import UniformGuidance from './uniform-guidance';
type Routine={id:string;group:string;title:string;cycle:string;owner:string;steps:string;evidence:string;approval:string;link?:string};
const groups=[['finance','재무·회계·자산','돈의 흐름과 증빙, 회사 자산을 함께 관리합니다.'],['personnel','인사·노무','입사부터 급여·보험·고과·퇴사까지 연결합니다.'],['legal','법무·계약·특허','계약 원본, 권리, 분쟁과 대응 기한을 관리합니다.'],['protection','정보보안·개인정보','접근 권한과 위탁 자료, 사고 대응을 관리합니다.'],['general','총무·경영관리','구매·구독·비품과 회사 운영 일정을 관리합니다.']] as const;
const routines:Routine[]=[
{id:'receivables',group:'finance',title:'수금·미수금 확인',cycle:'매일',owner:'경리 담당',steps:'계약별 청구일과 입금 예정액 확인 → 입금 내역 대조 → 미수 사유와 다음 연락일 기록',evidence:'계약번호, 청구액·입금액·잔액, 입금일, 대조 근거',approval:'미수 조정·감면은 대표 판단',link:'FM:cash'},
{id:'payment',group:'finance',title:'지출 품의·결의·지급',cycle:'발생 시',owner:'신청자 → 경리 담당',steps:'직원 신청 → 견적·사용 목적 검토 → 대표 승인 → 지급 → 증빙과 지급 결과 대조',evidence:'품의·지출결의, 거래처, 금액, 지급기한, 세금계산서·영수증, 이체 결과',approval:'지급 전 대표 승인 · 실제 이체 별도',link:'FM:approvals'},
{id:'invoice',group:'finance',title:'세금계산서 수취·발행 관리',cycle:'매일',owner:'경리 담당',steps:'계약·공급 내역 대조 → 발행·수취 필요 건 확인 → 누락·오류 정정 요청 → 장부 연결',evidence:'거래처, 공급일·금액, 증빙 원본, 발행·수취 확인',approval:'발행 연결 전 · 발행 완료는 실제 결과 확인 후',link:'FM:invoices'},
{id:'closing',group:'finance',title:'일계표·계좌 대조',cycle:'매일',owner:'경리 담당',steps:'수입·지출 증빙 정리 → 장부 입력 → 계좌 잔액 대조 → 차이 원인 기록',evidence:'기초잔액, 수입·지출, 기말잔액, 미대조 항목',approval:'차이가 남으면 마감 보류',link:'FM:journal'},
{id:'cashplan',group:'finance',title:'주간 자금·고정비 계획',cycle:'매주',owner:'재무 담당',steps:'예정 수금·급여·임차료·구독료 정리 → 잔액 부족일 확인 → 지급 순서 제안',evidence:'주간 입출금 예정표, 계약별 반복 지급일, 부족액과 대응안',approval:'대표가 지급 순서·예외 확정',link:'FM:report'},
{id:'accounting',group:'finance',title:'월 마감·회계사 인계',cycle:'매월',owner:'회계 담당 / 외부 세무대리인',steps:'미수·미지급·선급·고정자산 점검 → 증빙 누락 해결 → 외부 전문가 전달 자료 검토',evidence:'월 장부, 증빙 목록, 미결 내역, 회계사 검토 결과',approval:'신고·납부 완료 근거 별도 확인',link:'FM:journal'},
{id:'management',group:'finance',title:'관리회계·손익·예산',cycle:'매월',owner:'재무 담당',steps:'고객사별 매출·직접원가·인건비 확인 → 공통비 배부 기준 검토 → 예산 대비 차이와 다음 조치 보고',evidence:'고객별 수익성, 현금 잔액, 손익, 예산 차이·배부 근거',approval:'대표가 가격·비용·자원 배치 판단',link:'FM:settlement'},
{id:'assets',group:'finance',title:'자산 취득·배정·회수',cycle:'발생 시',owner:'자산 담당 / 회계 담당',steps:'구매 승인 → 자산번호·취득가·사용자·위치 등록 → 수리·반납·폐기 기록 → 회계 처리 확인',evidence:'구매 증빙, 자산번호, 취득일·금액, 사용자, 보증·수리·처분 이력',approval:'처분·폐기는 대표 승인 · 전용 자산대장 연결 전'},
{id:'join',group:'personnel',title:'입사·계약·서약·계정',cycle:'발생 시',owner:'인사 담당',steps:'계약·비밀유지 서약 확인 → 담당 업무·근무조건 확정 → 최소 권한 계정 배정',evidence:'서명 원본, 입사일, 업무·급여 조건, 부여 권한',approval:'대표가 채용·조건 승인',link:'HR:documents'},
{id:'payroll',group:'personnel',title:'급여·4대보험',cycle:'매월',owner:'인사·경리 담당',steps:'근태·급여 변경 확인 → 급여와 공제 검토 → 대표 승인 → 지급 및 명세서·보험 신고 결과 확인',evidence:'급여 산출 근거, 공제 내역, 명세서, 지급 결과, 취득·상실·변경 접수 결과',approval:'지급·신고 자동 연결 전 · 민감자료 접근 제한',link:'HR:labor'},
{id:'review',group:'personnel',title:'근태·고과·교육',cycle:'매주',owner:'인사 담당 / 대표',steps:'근태 예외 확인 → 교육·업무 결과 검토 → 대표 평가·다음 목표 반영',evidence:'근태 정정, 교육 결과, 본인 고과·피드백',approval:'평가와 보상 결정은 대표',link:'HR:reviews'},
{id:'leave',group:'personnel',title:'퇴사·정산·회수',cycle:'발생 시',owner:'인사·보안·자산 담당',steps:'퇴사 일정 확인 → 업무 인계 → 급여 정산 검토 → 계정 차단·자산 회수·보험 상실 결과 확인',evidence:'인계 확인, 회수 목록, 정산 근거, 접근 차단 및 신고 결과',approval:'미회수 항목은 별도 업무로 유지'},
{id:'contracts',group:'legal',title:'계약서·위탁·위임 원본 관리',cycle:'발생 시',owner:'계약 담당',steps:'기존 종이 문서 스캔·원본 보관 → 당사자·기간·금액·갱신·해지 조건 대조 → 서명 확인 → 재무·보안 업무 연결',evidence:'서명 원본·스캔 파일, 계약번호, 상대방, 효력일·만료일, 금액·청구 주기',approval:'스캔·초안은 체결과 구분 · 서명은 별도 승인'},
{id:'dispute',group:'legal',title:'법률 검토·송무·분쟁',cycle:'발생 시',owner:'법무 담당 / 외부 변호사',steps:'사실·원본 증거 보존 → 대응 기한 확인 → 전문가 검토 → 대표의 대응 결정 → 제출·회신 결과 기록',evidence:'사건번호, 상대방, 쟁점, 증거 위치, 기한, 전문가 의견·비용',approval:'법원 제출·합의·대외 회신 전 대표 승인'},
{id:'ip',group:'legal',title:'특허·상표·권리 전략',cycle:'매월',owner:'법무 담당 / 변리사',steps:'보유·검토 중인 권리와 신규 아이디어 정리 → 공개 전 권리 검토 → 출원·갱신 일정 관리',evidence:'발명·권리 원본, 권리자, 출원·등록번호, 기한, 검토 의견',approval:'출원·공개·계약은 대표 승인'},
{id:'access',group:'protection',title:'계정·접근 권한 점검',cycle:'매월',owner:'보안 담당',steps:'직원·외부 인력 권한 대조 → 불필요 접근 회수 → 관리자·복구 경로 확인',evidence:'계정 소유자, 업무별 허용 범위, 변경·회수 기록',approval:'권한 확대는 대표 승인',link:'ER:security'},
{id:'privacy',group:'protection',title:'위탁·보존·파기·사고 대응',cycle:'매월',owner:'개인정보 담당',steps:'위탁 계약·처리 목적과 보관 위치 확인 → 보존기간·파기 대상 검토 → 사고 시 접근 제한·증거 보존·대응',evidence:'위탁 원본, 보관·접근 기록, 파기 확인, 사고·복구 기록',approval:'원문을 불필요하게 복제하지 않음',link:'ER:security'},
{id:'procure',group:'general',title:'구매·비품·구독 갱신',cycle:'매주',owner:'총무 담당',steps:'구매 요청·보유 자산 중복 확인 → 견적·예산 검토 → 승인 후 구매 → 자산·재무에 인계',evidence:'요청·견적, 계약·구독 갱신일, 지급 일정, 인수 기록',approval:'지출 품의와 연결 · 구매 실행 별도',link:'FM:approvals'},
{id:'calendar',group:'general',title:'회사 마감·외부 전문가 일정',cycle:'매주',owner:'경영관리 담당',steps:'계약·인사·재무의 다가오는 기한 취합 → 담당·완료 근거 확인 → 지연 시 대표 판단 요청',evidence:'기한, 담당, 다음 행동, 전문가 회신·미결 사유',approval:'통합 보고를 다른 업무의 선행조건으로 만들지 않음',link:'ER:execution'},
];
const docs=['개인정보 처리위탁 계약서','발신번호 위임장','정보처리 포괄 동의서','통신가입증명원','사업자등록증'];
export default function DssOperations({section,records,onNavigate,onTask,onNewTask}:{section:string;records:RecordRow[];onNavigate:(s:string)=>void;onTask:(id:number)=>void;onNewTask:(d:any)=>void}){
 const focus=routines.find(r=>r.id===section);
 const department=focus?.group||section;
 const [cycle,setCycle]=useState('전체'),[query,setQuery]=useState(''),[taskFilter,setTaskFilter]=useState('전체');
 const tasks=records.filter(r=>r.kind==='task'&&r.org==='DSS'&&(section==='home'||String(r.data.notes||'').includes(`[DSS:${department}:`))&&(!focus||String(r.data.notes||'').includes(`[DSS:${department}:${focus.id}]`)));
 const active=tasks.filter(r=>r.data.status!=='완료');const today=kstDay();
 const pending=active.filter(r=>r.data.status==='DO 판단 대기'),late=active.filter(r=>r.data.due&&r.data.due.slice(0,10)<today),blocked=active.filter(r=>['응답 대기','보류'].includes(r.data.status));
 const visibleTasks=(taskFilter==='판단 대기'?pending:taskFilter==='기한 경과'?late:taskFilter==='대기·보류'?blocked:active).filter(t=>section==='home'||section==='onboarding'?section!=='onboarding'||String(t.data.notes||'').includes('[DSS:onboarding:'):String(t.data.notes||'').includes(`[DSS:${department}:`));
 const group=groups.find(g=>g[0]===department);const shown=routines.filter(r=>(section==='home'||r.group===department)&&(!focus||r.id===focus.id)&&(cycle==='전체'||r.cycle===cycle)&&(!query||`${r.title} ${r.steps}`.includes(query)));
 function prepare(r:Routine){onNewTask({org:'DSS',title:r.title,instruction:`${r.steps}\n담당 역할: ${r.owner}\n운영 주기: ${r.cycle}\n판단 기준: ${r.approval}`,criterion:r.evidence,notes:`[DSS:${r.group}:${r.id}]`,phase:'반복 운영',repeat:r.cycle==='발생 시'?'없음':r.cycle,assignee:['finance','personnel'].includes(r.group)?'kyunghwa':'do',nextAction:'담당자와 첫 기한을 지정하고 증빙을 확인합니다.'});}
 if(section==='onboarding'){
  const reception=records.filter(r=>r.kind==='task'&&((r.org==='OS'&&String(r.data.notes||'').includes('[OS:onboarding:'))||(r.org==='DSS'&&String(r.data.notes||'').includes('[DSS:onboarding:'))));
  return <div className="dss-ops">
   <header className="dss-ops-heading"><div><p>OS · 고객사 업무</p><h1>고객사 이지행정</h1><span>병원별 서명·제출 서류를 확인하고, 빠진 서류를 안내합니다.</span></div><button className="dss-ops-primary" onClick={()=>onNewTask({org:'OS',title:'병원 서류 접수',notes:'[OS:onboarding:documents]',instruction:`병원을 지정하고 서류별로 받은 원본, 서명·내용 확인 결과, 보완할 내용을 기록합니다.\n${docs.map((d,i)=>`${i+1}. ${d}`).join('\n')}\n보완이 필요하면 병원에 안내한 내용과 다음 연락일을 남깁니다.`,criterion:'병원명, 서류별 수령·확인 결과와 원본 위치, 미비 사항과 다음 연락일',nextAction:'병원과 담당자를 지정하고 받은 서류를 확인합니다.'})}>병원 서류 접수 등록</button></header>
   <section className="dss-ops-box"><h2>병원별 접수 내역</h2>{reception.length?<div className="dss-ops-tasklist">{reception.map(t=><button key={t.id} onClick={()=>onTask(t.id)}><b>{t.data.customer||'병원 미지정'} · {t.data.title}</b><span>{t.data.nextAction||'서류별 수령·보완 내용을 기록해 주세요.'}</span><em>{t.data.status}</em><small>담당 {NAME(t.data.assignee)}{t.data.contactAt?` · 다음 연락 ${t.data.contactAt.replace('T',' ')}`:''}</small></button>)}</div>:<p className="dss-ops-empty">등록된 접수 내역이 없습니다. 병원을 지정해 받은 서류와 보완할 내용을 기록해 주세요.</p>}</section>
   <details className="dss-ops-box"><summary>필요한 서류 5종</summary>{docs.map((d,i)=><div className="dss-ops-doc" key={d}><b>{d}</b><span>{i<3?'서명':'제출'}</span></div>)}</details>
   <p>현재는 담당자가 접수 결과와 원본을 기록합니다. 병원의 전자서명·제출 결과는 아직 자동으로 반영되지 않습니다.</p>
  </div>;
 }
 return <div className="dss-ops"><header className="dss-ops-heading"><div><p>DO · 회사 운영</p><h1>{section==='home'?'오늘 판단하고, 이어서 처리할 일':focus?.title||(group?.[1]+' 업무 현황')}</h1><span>{section==='home'?'인사·재무·법무·보안·총무를 하나의 지시와 완료 기록으로 관리합니다.':group?.[2]}</span></div><button className="dss-ops-primary" onClick={()=>onNewTask({org:'DSS',notes:`[DSS:${department}:custom]`})}>업무 지시 등록</button></header>
 {section==='personnel'&&<UniformGuidance/>}
 {['home','finance','personnel'].includes(department)&&<p>현황·후속 확인 담당: 고경화 · 재무·인사 / 이강현 · 사업 / 김태휘 · 영업. 결재는 대표에게 연결합니다.</p>}
 <div className="dss-ops-metrics">{[['전체',active.length,'진행·미완료'],['판단 대기',pending.length,'대표 판단 대기'],['기한 경과',late.length,'기한 경과'],['대기·보류',blocked.length,'대기·보류']].map(([id,n,label])=><button key={String(id)} aria-pressed={taskFilter===id} onClick={()=>setTaskFilter(String(id))}><span>{label}</span><strong>{n}<small>건</small></strong></button>)}</div>
 <section className="dss-ops-box"><div className="dss-ops-section"><h2>{section==='home'?'현재 등록된 DSS 업무':'이 영역에 연결된 업무'}</h2><small>{section==='home'?'전체 DSS':group?.[1]||'고객사 접수'} 집계 · 보류는 미완료에 포함</small></div>{visibleTasks.length?<div className="dss-ops-tasklist">{visibleTasks.map(t=><button key={t.id} onClick={()=>onTask(t.id)}><b>{t.data.title}</b><span>{NAME(t.data.assignee)} · {t.data.due?.replace('T',' ')||'기한 미지정'}</span><em>{t.data.status}</em></button>)}</div>:<p className="dss-ops-empty">해당 업무가 없습니다. 아래 운영 기준에서 업무를 등록하면 담당·기한·증빙·대표 판단을 한 기록에서 이어갑니다.</p>}</section>

 {section==='home'?null:<section className="dss-ops-box"><div className="dss-ops-section"><div><h2>반복 업무와 처리 기준</h2><p>운영 기준 제안입니다. ‘업무로 등록’ 후 담당·기한을 정해 저장해야 실제 업무가 됩니다.</p></div><label>업무 검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="수금, 급여, 계약…"/></label></div><div className="dss-ops-filters">{['전체','매일','매주','매월','발생 시'].map(c=><button key={c} aria-pressed={cycle===c} onClick={()=>setCycle(c)}>{c}</button>)}</div><div className="dss-ops-routines">{shown.map(r=>{const existing=tasks.filter(t=>String(t.data.notes||'').includes(`[DSS:${r.group}:${r.id}]`)&&t.data.status!=='완료');return <article key={r.id}><div className="dss-ops-routine-title"><span>{r.cycle}</span><h3>{r.title}</h3><small>{r.owner}</small></div><p>{r.steps}</p><dl><dt>완료 근거</dt><dd>{r.evidence}</dd><dt>판단·연결</dt><dd>{r.approval}</dd></dl><div className="dss-ops-links">{existing.length?existing.map(t=><button key={t.id} onClick={()=>onTask(t.id)}>진행 업무 열기 · #{t.id}</button>):<button onClick={()=>prepare(r)}>업무로 등록</button>}{r.link&&<button onClick={()=>onNavigate(r.link!)}>기존 관리 화면 ↗</button>}</div></article>})}</div>{!shown.length&&<p>조건에 맞는 업무 기준이 없습니다.</p>}</section>}
 <aside className="dss-ops-foot"><b>현재 연결 범위</b><p>업무 등록·배정·기한·결과·첨부·대표 판단은 기존 웍스 기록으로 연결됩니다. 정기 업무는 완료 후 다음 운영 회차를 생성합니다. 은행 자동 수집·이체, 세금계산서 실제 발행, 보험 신고, 고객 전자서명 자동 수신은 아직 연결되지 않았습니다.</p><button onClick={()=>onNavigate('ER:strategy')}>경영 의사결정·외부 검토 열기 ↗</button></aside>
 </div>;
}
