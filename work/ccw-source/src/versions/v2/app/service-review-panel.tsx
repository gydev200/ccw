'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/versions/v2/components/ui/button';
import {Input} from '@/versions/v2/components/ui/input';
import {Textarea} from '@/versions/v2/components/ui/textarea';
import {SERVICES,SERVICE_PRIORITY,blankCycle,initialReview,koreaDate} from '@/versions/v2/lib/service-review';
import {CHECKS,PROGRAM_SETUP,blankChecks,readySummary} from '@/versions/v2/lib/service-workflow';
import HospitalOnboarding from './hospital-onboarding';
import ServiceOperationsPanel from './service-operations-panel';
import {ServiceDataNeeds} from './hospital-reporting-panel';
import SSProduction from './ss-production';
import HospitalAdminHealth from './hospital-admin-health';
import ServiceTodaySummary from './service-today-summary';
import ServiceNextSteps from './service-next-steps';
const TABS=['오늘 운영','월별 관리','이력'];
export default function ServiceReviewPanel({hospital,owner,onSave,onRecord,onDirty,onProductionHospital,startProduction=false,view='service',embedded=false,startProgram,productionDate,recordsOnly=false}:any){
 const saved=hospital.data.serviceReview||initialReview(hospital.data.name);
 const [flowDirty,setFlowDirty]=useState(false);
 const [draft,setDraft]=useState<any>(null),[service,setService]=useState(startProgram||(startProduction?SERVICES[0]:SERVICES[SERVICE_PRIORITY[0]])),[day,setDay]=useState(''),[tab,setTab]=useState(view==='setup'?'프로그램 세팅':'오늘 운영'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{onDirty?.(!!draft||flowDirty);return()=>onDirty?.(false)},[!!draft,flowDirty,onDirty]);
 const model=draft||saved,canEdit=owner||!!hospital.record,index=SERVICES.indexOf(service),planned=index>=5;
 const cycles=model.cycles.filter((c:any)=>c.service===service).sort((a:any,b:any)=>b.date.localeCompare(a.date));const cycle=cycles.find((c:any)=>c.date===day)||cycles[0];const review=readySummary(cycle),checks=cycle?.checks||blankChecks();
 useEffect(()=>{if(!draft)return;const h=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',h);return()=>window.removeEventListener('beforeunload',h)},[draft]);
 const edit=(key:string,value:any)=>setDraft({...model,[key]:value});
 function change(key:string,value:any){const reset=['message','messageVersion','settings','stages'].includes(key);setDraft({...model,cycles:model.cycles.map((c:any)=>c===cycle?{...c,[key]:value,...(reset?{checks:blankChecks()}:{} )}:c)});setNotice('');}
 function choose(s:string){if(draft&&!confirm('저장하지 않은 변경을 버리고 이동하시겠습니까?'))return;setDraft(null);setService(s);setDay('');setError('');setNotice('');}
 function add(){const next=blankCycle();next.service=service;if(index!==0)next.target='';const last=cycles[0];if(last)next.owner=last.owner;const exists=model.cycles.find((c:any)=>c.date===next.date&&c.service===service);setDay(next.date);setTab(view==='setup'?'프로그램 세팅':'오늘 운영');setDraft({...model,cycles:exists?model.cycles:[...model.cycles,{...next,settings:last?.settings||{},checks:blankChecks()}]});}
 async function save(){setBusy(true);setError('');try{const result=await onSave(hospital.record?{action:'reviewService',id:hospital.record.id,version:hospital.record.version,data:draft}:{action:'create',kind:'customer',data:{...hospital.data,serviceReview:draft}});if(result){setDraft(null);setNotice('병원 운영 기록에 저장했습니다.')}else setError('저장하지 못했습니다. 입력 내용은 유지했습니다.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 const field=(key:string,label:string,area=false)=> <label className="field" key={key}><span>{label}</span>{area?<Textarea value={cycle?.[key]||''} onChange={e=>change(key,e.target.value)}/>:<Input value={cycle?.[key]||''} onChange={e=>change(key,e.target.value)}/>}</label>;
 return <section className="service-review-panel ss-run-workspace" data-dirty={!!draft||flowDirty}>
 {!embedded&&owner&&!draft&&<HospitalAdminHealth hospital={hospital}/>}
 {!embedded&&owner&&!draft&&view==='service'&&<ServiceTodaySummary selected={service==='상담 후 관리'?'상담 후 안내':service} hospital={hospital} onOpen={(name:string)=>{choose(name==='상담 후 안내'?'상담 후 관리':name);setTab(name==='장기미내원 관리'?'오늘 운영':view==='setup'?'프로그램 세팅':'오늘 운영');document.querySelector('.ss-run-header')?.scrollIntoView({behavior:'smooth'})}}/>}
 {view==='setup'&&!draft&&<HospitalOnboarding hospital={hospital} owner={owner} onSave={onSave} onDirty={setFlowDirty} onProgram={(name:string)=>{choose(name==='상담 후 안내'?'상담 후 관리':name);setTab(name==='장기미내원 관리'?'오늘 운영':'프로그램 세팅');document.querySelector('.ss-run-header')?.scrollIntoView({behavior:'smooth'})}}/>}
 {!flowDirty&&<>
 {view==='setup'&&<ServiceDataNeeds/>}
 {!embedded&&(!owner||!!draft||view==='setup')&&<><h3 className="service-menu-title">우리가 제공하는 서비스</h3><nav className="service-program-menu" aria-label="서비스 프로그램">{SERVICE_PRIORITY.map((i,position)=><button key={i} aria-current={service===SERVICES[i]?'page':undefined} onClick={()=>choose(SERVICES[i])}><span>서비스 {position+1}{i>=5?' · 미제공':''}</span><b>{i===3?'상담 후 안내':SERVICES[i]}</b></button>)}</nav></>}
 <div className="ss-run-header"><div><h3>{index===3?'상담 후 안내':service}</h3><p>{planned?'구상 단계 · 실제 운영 미연결':PROGRAM_SETUP[index].purpose}</p></div>{!planned&&canEdit&&<div className="actions">{!draft?<><Button variant="outline" onClick={add}>{view==='setup'?'준비 기록 만들기':'오늘 회차 준비'}</Button><Button onClick={()=>setDraft(structuredClone(saved))}>{view==='setup'?'운영 조건 수정':'운영 기록 수정'}</Button></>:<><Button disabled={busy} onClick={save}>{busy?'저장 중…':'운영 기록 저장'}</Button><Button variant="outline" onClick={()=>{setDraft(null);setError('')}}>취소</Button></>}</div>}</div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!planned&&<>{view!=='setup'&&<nav className="organization-tools" aria-label="프로그램 업무 구분">{(view==='setup'?['프로그램 세팅']:TABS).map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>}
 {tab==='오늘 운영'&&<div data-dirty={!!draft}>
 {!recordsOnly&&owner&&index===0&&/플로체|플로츠|플랜미/.test(hospital.data.name)&&<SSProduction onHospital={onProductionHospital} hospital={hospital.data.name.includes('플랜미')?'planme':'floce'} date={productionDate||koreaDate()}/>}
 <details open={!!draft||!(owner&&index===0&&/플로체|플로츠|플랜미/.test(hospital.data.name))} className="production-legacy"><summary>기존 준비 기록 · EMR 수령 현황</summary><section className="daily-source"><header><h4>오늘 업무의 기준 자료</h4><span>전날 자료 · 하루 1회 수령 기준</span></header><p>전날까지의 EMR을 받은 뒤 대상 분류 → 맞춤 준비 → 검수 → 발송 승인 순서로 진행합니다.</p><div className="daily-source-grid">{[['emrAsOf','자료 기준일'],['emrPullTime','매일 수령 예정 시각'],['emrReceivedAt','마지막 실제 수령 확인'],['emrPatients','보유 고유 환자 수']].map(([k,l])=><label key={k}><span>{l}</span>{draft?<Input aria-label={l} value={model[k]||''} onChange={e=>edit(k,e.target.value)}/>:<b>{model[k]||'미확인'}</b>}</label>)}</div><div className="daily-source-note"><b>수령 오류·누락·추가 확인</b>{draft?<Textarea aria-label="수령 오류·누락·추가 확인" value={model.emrSyncNote||''} onChange={e=>edit('emrSyncNote',e.target.value)}/>:<p>{model.emrSyncNote||'확인 내용 미등록'}</p>}</div><small>현재는 수령 현황을 기록합니다. 자동 수집기는 아직 연결되지 않았습니다. 발송 직전에는 당일 예약 변경·내원·수신거부를 추가 대조합니다.</small></section>

 {!cycle?<p>등록된 회차가 없습니다. 오늘 회차 준비에서 담당과 목표를 등록합니다.</p>:<>
 <div className="section-heading"><b>{cycle.date} {cycle.date===koreaDate()?'· 오늘':'· 과거 준비 기록'}</b><span>{cycle.setupStatus} · 담당 {cycle.owner||'미정'}</span></div>
 <div className="ss-run-stats"><div><span>목표</span><strong>{cycle.target||'미정'}</strong></div><div><span>예비 선정</span><strong>{cycle.stages[1].count||'미확인'}</strong></div><div><span>맞춤 준비</span><strong>{cycle.stages[2].count||'미확인'}</strong></div><div><span>검수 근거</span><strong>{review.passed} / 8</strong></div></div>
 <div className="ss-run-next"><b>{review.ready?'발송 승인 요청 준비 가능':'발송 전 해결 필요'}</b><p>{cycle.nextAction||'다음 작업과 담당을 지정해 주세요.'}</p><small>{review.ready?'명단과 검수 결과를 제출한 뒤 별도 발송 허락이 필요합니다.':'예비 선정·맞춤 준비 숫자는 발송 통과 인원이 아닙니다.'}</small></div>
 {draft&&<div className="form-body">{field('owner','담당 자리·사람')}{field('target','오늘 목표 인원')}{field('nextAction','다음 작업·막힌 이유',true)}</div>}
 <div className="ss-stage-list">{cycle.stages.slice(0,3).map((s:any,i:number)=><details key={s.name}><summary><b>{i+1}. {s.name}</b><span>{s.count===''?'미확인':s.count+'명'} · {s.status}</span></summary><p>{s.note||'진행 내용 미등록'}</p><dl><dt>구분 기준</dt><dd>{s.rule||'미등록'}</dd><dt>정렬 기준</dt><dd>{s.sort||'미등록'}</dd><dt>보류</dt><dd>{s.held||'미확인'}</dd></dl>{draft&&<label className="field"><span>{s.name} 상태</span><select value={s.status} onChange={e=>change('stages',cycle.stages.map((v:any,j:number)=>j===i?{...v,status:e.target.value}:v))}>{['미확인','진행 중','추가 확인','확인 완료'].map(v=><option key={v}>{v}</option>)}</select></label>}{draft&&[['count','처리 인원'],['held','보류 인원'],['rule','구분 기준'],['sort','정렬 기준'],['note','검수 내용·남은 문제']].map(([k,label])=><label className="field" key={k}><span>{label}</span><Input value={s[k]} onChange={e=>change('stages',cycle.stages.map((v:any,j:number)=>j===i?{...v,[k]:e.target.value}:v))}/></label>)}</details>)}</div>
 <details className="ss-run-message"><summary>맞춤 메시지·개인 화면 검수 근거</summary>{draft?<div className="form-body">{field('messageVersion','문구 버전')}{field('message','메시지 원문 양식 · 환자 식별정보 제외',true)}{field('evidence','명단·링크 검수 근거 위치 · 개인 토큰 입력 금지',true)}</div>:<><p>문구 버전 · {cycle.messageVersion||'미등록'}</p><pre>{cycle.message||'메시지 양식 미등록'}</pre><p>{cycle.evidence||'검수 근거 미등록'}</p></>}</details>
 <details className="ss-check-list"><summary>최종 검수 · {review.passed}/8 근거 확인</summary><p>각 항목의 근거·확인자·확인일을 기록합니다. 자동 검수 연결 여부와 사람의 확인은 근거에 구분해 남깁니다.</p>{CHECKS.map(([id,label],i)=>{const c=checks[i];return <details key={id}><summary>{i+1}. {label} · {c.status}</summary>{draft?<div className="form-body"><label className="field"><span>{label} 상태</span><select value={c.status} onChange={e=>change('checks',checks.map((v:any,j:number)=>j===i?{...v,status:e.target.value}:v))}>{['미확인','확인 중','통과','보류'].map(s=><option key={s}>{s}</option>)}</select></label>{[['evidence','근거'],['reviewer','확인자·검사 도구'],['checkedAt','확인일']].map(([k,l])=><label className="field" key={k}><span>{label} {l}</span><Input type={k==='checkedAt'?'date':'text'} value={c[k]} onChange={e=>change('checks',checks.map((v:any,j:number)=>j===i?{...v,[k]:e.target.value}:v))}/></label>)}</div>:<p>{c.evidence||'근거 미등록'}<br/>{c.reviewer||'확인자 미등록'} · {c.checkedAt||'확인일 미등록'}</p>}</details>})}</details>
 <p className="muted">문구·대상 단계·세팅을 변경하면 검수 8개는 재확인 상태로 돌아갑니다. 실제 발송은 이 화면에서 실행되지 않습니다.</p>
 </>}
 </details></div>}
 {tab==='프로그램 세팅'&&<div><h3>이 프로그램의 운영 조건</h3><p>필요 자료 · {PROGRAM_SETUP[index].source}</p><p>발송 시점 · {PROGRAM_SETUP[index].timing}</p>{!cycle?<p>준비 기록 만들기를 눌러 운영 조건을 등록하세요. 실제 발송은 실행되지 않습니다.</p>:<div className="form-body">{[['source','자료·연동 상태'],['timing','발송 시점'],['tone','병원 문구 톤앤매너'],['frequency','안내 횟수·간격'],['intensity','적용 강도·대상 범위'],['responseOwner','답변·예약 처리 담당'],['exception','취소·거부·이상 반응 처리'],['basis','병원 확인·적용 근거']].map(([k,l])=>draft?<label className="field" key={k}><span>{l}</span><Textarea value={cycle.settings?.[k]||''} onChange={e=>change('settings',{...cycle.settings,[k]:e.target.value})}/></label>:<div className="ss-setup-row" key={k}><b>{l}</b><p>{cycle.settings?.[k]||'확인 필요'}</p></div>)}</div>}<details><summary>EMR 보유 자료</summary>{[['emrFiles','파일 수'],['emrPatients','고유 환자 수'],['emrAsOf','자료 기준일'],['emrBasis','집계 근거'],['sourceCheckedAt','확인일']].map(([k,l])=>draft?<label className="field" key={k}><span>{l}</span><Input value={model[k]||''} onChange={e=>edit(k,e.target.value)}/></label>:<p key={k}>{l} · {model[k]||'미확인'}</p>)}</details></div>}
 {tab==='월별 관리'&&<ServiceOperationsPanel reporting={model.reporting} onReportingChange={(v:any)=>edit('reporting',v)} value={model.operations} editable={!!draft} onChange={(v:any)=>edit('operations',v)}/>}
 {tab==='이력'&&<div><h3>회차별 기록</h3>{cycles.map((c:any)=><button className="ss-history-row" key={c.date} onClick={()=>{if(draft&&!confirm('저장하지 않은 변경을 버리고 이동하시겠습니까?'))return;setDraft(null);setDay(c.date);setTab('오늘 운영')}}><b>{c.date}</b><span>{c.setupStatus} · {c.owner||'담당 미정'}</span></button>)}{hospital.record&&<Button variant="outline" onClick={()=>onRecord(hospital.record.id)}>병원 변경 이력 보기</Button>}<p>예전 준비 수치와 실제 발송 기록은 구분해서 보존합니다.</p></div>}
 {draft&&<div className="actions"><Button disabled={busy} onClick={save}>운영 기록 저장</Button><span>변경 내용은 저장해야 직원과 공유됩니다.</span></div>}
 </>}
 {!recordsOnly&&<ServiceNextSteps key={hospital.key+service} hospital={hospital} index={index} service={service} model={saved} onSave={onSave} editable={canEdit&&!draft}/>}
 </>}
 </section>;
}
