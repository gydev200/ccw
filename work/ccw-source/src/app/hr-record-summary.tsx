'use client';
import {useEffect,useState} from 'react';
import AcademyPanel from './academy-panel';
type Person={id:string;name:string;grade:string;primaryOrg:string};
type Row={id:number;person:string;kind:string;data:{status?:string;date?:string;title?:string}};
export default function HrRecordSummary({member,view}:{member:any;view:'people'|'report'}){
 const [data,setData]=useState<{people:Person[];rows:Row[]}|null>(null),[error,setError]=useState(''),[loaded,setLoaded]=useState(''),[selected,setSelected]=useState(''),[opened,setOpened]=useState<string[]>([]);
 async function load(){setError('');try{const r=await fetch('/api/academy',{cache:'no-store'});const d=await r.json() as any;if(!r.ok)throw Error(d.error||'인사 기록을 불러오지 못했습니다.');setData(d);setLoaded(new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}catch(e:any){setError(e.message)}}
 useEffect(()=>{void load()},[]);
 const counts=(person:string)=>{const rows=data?.rows.filter(r=>r.person===person)||[];return {logs:rows.filter(r=>r.kind==='academy_log').length,feedback:rows.filter(r=>r.kind==='academy_log'&&r.data.status!=='확인 완료').length,grading:rows.filter(r=>r.kind==='academy_attempt'&&r.data.status==='채점 대기').length,reviews:rows.filter(r=>r.kind==='academy_review').length}};
 return <section aria-label={view==='people'?'직원 인사카드':'저장 기록 기반 인사보고'}><p>{member.role==='DO'?'등록된 사람 직원의 교육·일지·평가 기록입니다.':'본인의 교육·일지·평가 기록입니다.'} 근로계약·급여·AI 사원 명부는 이 집계에 포함하지 않습니다.</p><button onClick={load}>기록 새로 불러오기</button>{error&&<p role="alert">{error}</p>}{loaded&&<p>조회 기준: {loaded} (한국시간) · 저장된 전체 기간 · 자동 AI 평가가 아닌 기록 집계</p>}{!data&&!error&&<p role="status">기록을 불러오고 있습니다.</p>}{data?.people.length===0&&<p>조회 가능한 직원 기록이 없습니다.</p>}<div className="cchr-cards">{data?.people.map(p=>{const c=counts(p.id);return <article key={p.id}><h4>{p.name} · {p.grade}</h4><p>소속 {p.primaryOrg}</p><dl><dt>업무일지</dt><dd>{c.logs}건 · 피드백 대기·보완 {c.feedback}건</dd><dt>시험 채점 대기</dt><dd>{c.grading}건</dd><dt>고과 기록</dt><dd>{c.reviews}건</dd></dl><button aria-expanded={selected===p.id} onClick={()=>{setSelected(p.id);setOpened(ids=>ids.includes(p.id)?ids:[...ids,p.id])}}>인사카드·근거 기록 열기</button></article>})}</div>{opened.map(id=><div key={id} hidden={selected!==id}><AcademyPanel member={member} initialTab="profile" initialPerson={id}/></div>)}</section>
}
