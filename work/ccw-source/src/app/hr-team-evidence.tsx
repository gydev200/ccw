'use client';
import {useEffect,useState} from 'react';
import humans from '@/lib/human-roster';
type Row={id:number;kind:string;person:string;title:string;date:string;status:string;taskRef:string;evidence:string;updatedAt:string};
const labels:Record<string,string>={academy_log:'업무일지',academy_attempt:'시험',academy_review:'정기 평가',academy_metric:'성과지표'};
export default function HrTeamEvidence({view}:{view:'logs'|'reviews'}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);fetch('/api/hr-evidence?view='+view,{cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'기록을 불러오지 못했습니다.');if(alive){setRows(d.rows);setError('')}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[view]);
 return <section className="panel"><h2>{view==='logs'?'직원 업무일지·피드백 기록':'직원 시험·평가 기록'}</h2><p className="muted">기존 웍스 저장 기록을 최신순으로 표시합니다. 상세 검토와 확정은 권한에 맞는 기존 화면에서 진행해 주세요.</p>{loading?<p role="status">불러오는 중입니다.</p>:error?<p role="alert">{error}</p>:rows.length?<div className="hr-evidence-list">{rows.map(r=><article key={r.id}><div><b>{labels[r.kind]||r.kind}</b><span>{humans.find(h=>h.id===r.person)?.name||r.person} · {r.date||r.updatedAt.slice(0,10)}</span></div><h3>{r.title}</h3><p>{r.status}{r.taskRef?' · 업무 '+r.taskRef:''}</p>{r.evidence&&<small>근거: {r.evidence}</small>}</article>)}</div>:<p className="muted">저장된 기록이 없습니다.</p>}</section>;
}
