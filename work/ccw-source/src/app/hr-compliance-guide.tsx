'use client';
import {useEffect,useState} from 'react';
import {HR_COMPLIANCE_RULES,hrRuleState} from '@/lib/hr-compliance';
export default function HrComplianceGuide(){
 const [headcount,setHeadcount]=useState(75);
 useEffect(()=>{const saved=Number(localStorage.getItem('hr-compliance-headcount'));if(Number.isSafeInteger(saved)&&saved>=0&&saved<=10000)setHeadcount(saved)},[]);
 function change(value:number){const count=Number.isFinite(value)?Math.max(0,Math.min(10000,Math.floor(value))):0;setHeadcount(count);localStorage.setItem('hr-compliance-headcount',String(count))}
 return <section className="cchr-compliance" aria-label="인원 기준 인사 의무 확인"><h3>50~99인 회사 적용 점검</h3><p>아래 인원은 설계 비교값입니다. 회사의 실제 상시근로자 수와 사업장 구조를 확인해 적용 여부를 확정해야 합니다.</p><label>비교할 상시근로자 수 <input type="number" min="0" max="10000" value={headcount} onChange={e=>change(Number(e.target.value))}/></label><div className="cchr-compliance-grid">{HR_COMPLIANCE_RULES.map(rule=><article key={rule.id}><small>{hrRuleState(rule,headcount)} · {rule.condition}</small><h4>{rule.title}</h4><p>{rule.action}</p>{rule.note&&<p>{rule.note}</p>}<a href={rule.source} target="_blank" rel="noreferrer">공식 근거 열기</a></article>)}</div><p>점검 결과, 담당자, 기한, 증빙은 아래 인사 기록에 각각 남깁니다. 이 화면에서 신고·교부·교육이 실행되지는 않습니다.</p></section>;
}
