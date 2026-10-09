'use client';
import {useState} from 'react';
const phases=[{id:'D',name:'소식지 전달',detail:'자료 제작 · 병원 전달'},{id:'B',name:'Before',detail:'체험 · EMR 자료 요청'},{id:'A',name:'After',detail:'EMR 수령 후 분석 · 샘플'},{id:'S',name:'계약·서비스',detail:'계약 후 세팅 · 지속 운영'}];
export function journeyStage(stage:string){
 if(['PM 제작','DM 전달','OS 후속 연락','D'].includes(stage))return 'D';
 if(['B','B1','B2'].includes(stage))return 'B';
 if(['SS 사전분석','A'].includes(stage))return 'A';
 if(['OS 계약·입금','계약·계약금 수령','SS 세팅','SS 반복 운영','SS/CA 콘텐츠 운영','S','S1','S2','S3'].includes(stage))return 'S';
 return '?';
}
export default function CustomerJourney({records,onHospital,onTask,initialStage=null}:any){
 const [selected,setSelected]=useState<string|null>(initialStage);
 const hospitals=records.filter((r:any)=>r.kind==='customer');
 const tasks=records.filter((r:any)=>r.kind==='task');
 const unknown=hospitals.filter((r:any)=>journeyStage(r.data.stage)==='?');
 const active=(t:any)=>!['완료','보류'].includes(t.data.status);
 const linked=(list:any[])=>tasks.filter((t:any)=>list.some(h=>h.data.name===t.data.customer));
 const chosen=hospitals.filter((h:any)=>journeyStage(h.data.stage)===selected);
 return <section className="customer-journey" aria-label="고객 여정">
 <header><div><h2>고객 여정</h2><p>등록 병원 {hospitals.length}곳 · 현재 단계와 연결 업무</p></div><span>D–B–A–S</span></header>
 <details className="journey-roles"><summary>역할 보기 · DM / OS / SS</summary><p><b>DM · Delivery and Management</b> — 소식지 전달·현장 관리</p><p><b>OS · Operation and Sales</b> — 전달 불편 확인·인식·라포 형성·제안, B·A 고객 진행 관리</p><p><b>SS · Setting and Service</b> — B·A 사례·B2 맞춤 제작·EMR 세팅 지원, 계약 후 서비스·S1 만족 관리</p><p>D에서 전달·전화만 했다고 B로 옮기지 않습니다. B → A는 EMR 수령, S는 계약 기준입니다.</p></details><div className="journey-flow">{phases.map(p=>{const list=hospitals.filter((h:any)=>journeyStage(h.data.stage)===p.id),work=linked(list);return <button key={p.id} aria-expanded={selected===p.id} aria-controls="journey-hospitals" onClick={()=>setSelected(selected===p.id?null:p.id)} className={selected===p.id?'selected':''}><span className="journey-code">{p.id}</span><h3>{p.name}</h3><p>{p.detail}</p><strong>{list.length}<small>곳</small></strong><div className="journey-counts"><span>진행 업무 <b>{work.filter(active).length}</b></span><span>응답 대기 <b>{work.filter((t:any)=>active(t)&&!!t.data.waitFor).length}</b></span></div></button>})}</div>
 <p className="journey-note">현재 등록 기준입니다. 발송·방문 실적이 아닌 병원 수와 업무 수이며, 계약 후 EMR 미수령 병원도 S에 포함합니다.{unknown.length>0&&<button onClick={()=>setSelected(selected==='?'?null:'?')}>단계 확인 필요 {unknown.length}곳</button>}</p>
 {selected&&<div id="journey-hospitals" className="journey-hospitals"><h3>{selected==='?'?'단계 확인 필요':selected+' 단계'} · {chosen.length}곳</h3>{chosen.map((h:any)=>{const work=linked([h]).filter(active);return <article key={h.id}><button onClick={()=>onHospital(h)}><b>{h.data.name}</b><small>{h.data.stage||'단계 미등록'}</small></button><p>{h.data.nextAction||'다음 행동 미등록'}</p>{work.map((t:any)=><button className="journey-task" key={t.id} onClick={()=>onTask(t.id)}>{t.data.title} · {t.data.status}</button>)}</article>})}{!chosen.length&&<p>이 단계에 등록된 병원이 없습니다.</p>}</div>}
 </section>
}
