'use client';
import HospitalReportingPanel from './hospital-reporting-panel';
import {useState} from 'react';
import {Input} from '@/versions/v2/components/ui/input';
import {Textarea} from '@/versions/v2/components/ui/textarea';
import {OP_FIELDS,blankOperations} from '@/versions/v2/lib/service-operations';
export default function ServiceOperationsPanel({value,editable,onChange,reporting,onReportingChange}:any){
 const [month,setMonth]=useState(blankOperations().month);const plans=value||[];const saved=plans.find((p:any)=>p.month===month);const plan={...blankOperations(),...saved,month};
 function change(k:string,v:string){onChange([...plans.filter((p:any)=>p.month!==month),{...plan,[k]:v}]);}
 function field(k:string,label:string,numeric=false){return <label className="monthly-field" key={k}><span>{label}</span>{editable?(numeric?<Input aria-label={label} inputMode="numeric" value={plan[k]} onChange={e=>change(k,e.target.value)}/>:<Textarea aria-label={label} value={plan[k]} onChange={e=>change(k,e.target.value)}/>):<p>{plan[k]||'미등록'}</p>}</label>}
 return <section className="monthly-workspace" data-dirty={editable}>
 <header className="monthly-heading"><div><h3>병원 공통 · 월별 운영</h3><p>기본 5개 서비스의 결과를 함께 확인하고 다음 운영을 조정합니다.</p></div><label>운영 월<Input aria-label="운영 월" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></header>
 <div className="monthly-status">{editable?'수정 중 · 상단의 운영 기록 저장을 눌러 반영하세요.':saved?'저장된 월 운영 기록':'이 달 운영 기록이 없습니다. 상단의 운영 기록 수정에서 입력하세요.'}</div>
 <HospitalReportingPanel value={reporting} editable={editable} onChange={onReportingChange}/>
 <section className="monthly-block"><header><h4>이번 달 계획</h4><span>장기미내원 관리 · 배분 계획</span></header><div className="monthly-numbers">{OP_FIELDS.slice(0,4).map(([k,label])=><div key={k}><span>{label}</span>{editable?<Input aria-label={label} inputMode="numeric" value={plan[k]} onChange={e=>change(k,e.target.value)}/>:<strong>{plan[k]===''?'—':Number(plan[k]).toLocaleString()}<small>{plan[k]===''?'미등록':'명'}</small></strong>}</div>)}</div><p className="monthly-caption">계획 인원입니다. 실제 발송·도착 실적과 구분합니다.</p><div className="monthly-three">{OP_FIELDS.slice(4).map(([k,l])=>field(k,l+' (명)',true))}</div><details><summary>배분 기준·후속 연락 관리</summary><div className="monthly-grid">{field('allocationRule','혼합 배분·정렬 기준')}{field('capacity','병원 예약 수용량·응대 역량')}{field('followup','후속 연락 목적·간격·담당')}</div></details></section>
 <section className="monthly-block"><header><h4>이번 달 결과</h4><span>관찰된 결과와 근거를 함께 기록</span></header><div className="monthly-three">{[['direct','직접효과','문의 → 예약 → 실제 내원·진료'],['indirect','간접효과','답변 · 콘텐츠 반응 · 관계 유지'],['process','과정관리효과','차트·연락처 정리 · 거부 반영 · 미처리 감소']].map(([k,l,hint])=><article className="monthly-effect" key={k}><h5>{l}</h5><p className="monthly-caption">{hint}</p>{editable?<Textarea aria-label={l+' 관찰 결과'} value={plan[k]} onChange={e=>change(k,e.target.value)}/>:<p className="monthly-result">{plan[k]||'결과 미등록'}</p>}</article>)}</div>{field('evidence','측정 기간·확인 근거')}</section>
 <section className="monthly-block monthly-next"><header><h4>다음 운영 조정</h4></header>{field('adjustment','다음 회차에서 바꿀 내용')}{field('reviewOwner','검수 담당')}</section>
 <details className="monthly-policy"><summary>검수·중단 기준</summary><div className="monthly-grid">{field('reviewPolicy','초기·안정화 검수 범위·표본 기준')}{field('stopRule','오류 중단·재검수 기준')}</div><p className="monthly-caption">기준을 기록하는 화면입니다. 자동 발송이나 AI 검수를 실행하지 않습니다.</p></details>
 <details className="monthly-policy"><summary>계약 금액·운영 원칙</summary><div className="monthly-grid">{field('actualBaseFee','실제 기본 계약 월 금액 (원)',true)}{field('actualContentFee','실제 콘텐츠 계약 월 금액 (원)',true)}</div><p className="monthly-caption">기본 50만원·콘텐츠 50만원은 장기 목표이며 실제 계약 금액과 구분합니다.</p><p>A는 계약 전 샘플 선정, S는 계약 후 전체 대상의 지속 관리입니다. 반응 기대·관계 유지·차트 정리 대상을 혼합해 첫 달에 우량 대상을 몰아 소진하지 않습니다.</p></details>
 </section>;
}
