'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/versions/v2/components/ui/button';
import {SERVICE_STEPS} from '@/versions/v2/lib/hospital-onboarding';
import {koreaDate} from '@/versions/v2/lib/service-review';
const needs=[
 '완료 진료일·실제 시행 항목·병원 관리지침이 필요합니다. AI는 항목별 질문과 안내 초안을 만들고 시험 대상으로 연결합니다.',
 '예약일시·예약 항목·변경·취소 자료가 필요합니다. AI는 예약별 준비 안내를 만들고 변경 시 이전 안내를 보류합니다.',
 '검사명·결과 확정 여부·병원이 승인한 안내가 필요합니다. AI는 확정된 안내를 연결하며 결과를 임의로 해석하지 않습니다.',
 '상담일·상담 내용·후속 안내 기준이 필요합니다. AI는 상담 기록을 요약하고 다음 행동과 질문 창구를 준비합니다.',
 '확보 EMR·이전 발송·수신거부 기록을 대조해 대상별 문구와 환자 화면을 준비합니다. 최신 자료 미수령은 별도로 남깁니다.'
];
export default function ServiceSupplyBoard({hospital,services,review,onProgram}:any){
 const slug=hospital.data.name.includes('플로체')?'floce':hospital.data.name.includes('플랜미')?'planme':null;
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[selected,setSelected]=useState(4),[refresh,setRefresh]=useState(0);
 const date=koreaDate();
 useEffect(()=>{let active=true;setData(null);setError('');if(!slug)return;setLoading(true);const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),15000);
 Promise.all(['ss-production','ss-dispatch'].map(async endpoint=>{const r=await fetch(`/api/${endpoint}?hospital=${slug}&date=${date}`,{signal:ctl.signal,cache:'no-store'});if(!r.ok)throw Error('실제 운영 기록 조회 실패');return r.json() as Promise<any>})).then(([production,dispatch])=>{if(active)setData({run:production.run,dispatch})}).catch(()=>{if(active)setError('운영 기록을 가져오지 못했습니다. 미완료로 판정하지 않습니다. 다시 조회해 주세요.')}).finally(()=>{clearTimeout(timer);if(active)setLoading(false)});return()=>{active=false;ctl.abort();clearTimeout(timer)};
 },[slug,date,refresh]);
 const rows=data?.run?.rows||[],d=data?.dispatch,n=rows.length;
 const sent=d?.result?.responses?.reduce((sum:number,x:any)=>sum+(Number(x.data?.sent)||0),0)||0;
 const stepText=(s:any,i:number,j:number)=>{
  if(i!==4||!slug)return s.steps[j].status==='미확인'?'근거 연결 필요':`담당 기록 · ${s.steps[j].status}`;
  if(loading)return '조회 중';if(error)return '조회 실패';
  if(j===0)return n?`회차 대상 ${n}명 연결`:'오늘 대상 미연결';
  if(j===1)return n?`문구·화면 ${n}명 연결`:'제작 필요';
  if(j===2)return d?.status==='expired'?'재검수 필요':d?.ready?`${d.passed}/${d.total}명 통과`:d?.passed?`${d.passed}/${d.total}명 · 보류`:'검수 근거 필요';
  if(j===3)return d?.result?.status==='unknown'?'발송 응답 확인 필요':sent?`발송 처리 ${sent}건`:d?.ready?'승인·발송 대기':'발송 전 준비';
  return sent?'반응·예약 결과 확인':'발송 이후 확인';
 };
 const s=services[selected],plan=review.servicePlans?.[s?.name==='상담 후 안내'?'상담 후 관리':s?.name];
 return <section aria-label="서비스별 실제 준비와 다음 작업"><div className="section-heading"><div><h4>서비스별 준비와 공급</h4><p className="muted">{date} 기준 · 장기미내원은 실제 회차 기록에서 조회합니다. 각 칸을 누르면 근거와 다음 작업을 확인합니다.</p></div><Button variant="outline" disabled={loading} onClick={()=>setRefresh(x=>x+1)}>운영 기록 새로고침</Button></div>{error&&<p role="alert">{error}</p>}
 <div className="onboard-table"><table><thead><tr><th>서비스</th>{SERVICE_STEPS.map(x=><th key={x}>{x}</th>)}<th>다음 작업</th></tr></thead><tbody>{services.map((service:any,i:number)=><tr key={service.name}><th><button type="button" onClick={()=>setSelected(i)}>{service.name}</button></th>{SERVICE_STEPS.map((_,j)=><td key={j}><button type="button" onClick={()=>setSelected(i)} style={{textAlign:'left',textDecoration:'underline',textUnderlineOffset:4}}>{stepText(service,i,j)}</button></td>)}<td><Button variant="outline" onClick={()=>{setSelected(i);onProgram?.(service.name)}}>작업 열기</Button></td></tr>)}</tbody></table></div>
 {s&&<div style={{padding:20,marginTop:16,background:'#f5f6f7',borderRadius:10}}><h4>{s.name} · 지금 할 일</h4><p>{plan?.next||needs[selected]}</p><p><b>병원 협조</b> · {plan?.hospitalNeed||needs[selected].split(' AI')[0]}</p><p><b>AI·웍스 작업</b> · {plan?.ourWork||needs[selected].split(' AI')[1]||'확보 자료 대조 → 대상 선정 → 문구·환자 화면 제작 → 검수'}</p><p><b>담당</b> · {plan?.assignee||'AI · 준비·검수 / SS · 연결·운영'}　<b>협조</b> · {plan?.collaborator||'병원 담당자 확인 필요'}　<b>기한</b> · {plan?.due||'미지정'}</p>
 {selected===4&&n>0&&<p>연결 근거: 오늘 제작 회차 {n}명 · {d?.reviewedAt?`검수 ${new Date(d.reviewedAt).toLocaleString('ko-KR')}`:'검수 기록 없음'}{d?.expiresAt?` · 유효기한 ${new Date(d.expiresAt).toLocaleString('ko-KR')}`:''}. {d?.reason||''} 제작 자료 연결은 전체 EMR 확보나 정기 수집 성공을 뜻하지 않습니다. 발송 처리와 환자 수신·반응은 구분합니다.</p>}
 <Button variant="outline" onClick={()=>onProgram?.(s.name)}>이 서비스 준비·제작·검수 열기</Button><p className="muted">자동 조회된 상태는 사람이 수정하지 않습니다. 아래 수동 기록에는 병원 확인 사항·협조·예외와 근거를 남깁니다. 작업 열기는 해당 업무 화면으로 이동하며, AI 작업을 자동 실행하거나 문자를 발송하지 않습니다.</p></div>}
 </section>
}
