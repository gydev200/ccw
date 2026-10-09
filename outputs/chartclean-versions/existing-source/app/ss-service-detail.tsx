'use client';
import {useState} from 'react';
import {SERVICE_RULES} from '@/lib/ss-service-policy';
import {SERVICES,initialReview} from '@/lib/service-review';
import {PROGRAM_SETUP} from '@/lib/service-workflow';
import RunnerControl from './ss-runner-control';
import SSProduction from './ss-production';
import ServiceNextSteps from './service-next-steps';
import ServiceReviewPanel from './service-review-panel';
import RecellReservationSync from './recell-reservation-sync';
const indices=[-1,2,1,4,3,0,5,6];
const flows:Record<number,string[]>={1:['진료 완료 자료','시행 항목·지침 대조','상태 질문·관리 안내','환자 응답 확인','병원 전달·다음 예약'],2:['유효 예약 확인','예약 확인·전일·당일 안내','변경·취소 재대조','예약 안내 발송','확인·변경 요청 처리'],3:['검사 결과 도착','의료진 확인·전달 가능 확인','확인 방법·예약 안내','알림 발송','환자 확인·병원 연결'],4:['상담 내용 확보','관심 항목·조건 대조','상담 요약·질문 안내','당일·후속 연락','질문·재상담 처리'],5:['잔여 대상·기간 배분','LMS·개인 화면 제작','전수 검수·당일 재대조','승인 후 발송','수신·응답·다음 회차']};
export default function ServiceDetail({hospital,slug,service,date,onDate,owner,onSave,onTask,onDirty}:any){const [executionResult,setExecutionResult]=useState<any>(null);const [legacy,setLegacy]=useState(false),[showRunner,setShowRunner]=useState(true);const index=indices[service],name=SERVICES[index],model=hospital.data.serviceReview||initialReview(hospital.data.name),rule=SERVICE_RULES[service-1];const supported=service===5&&['floce','planme'].includes(slug);
return <section className="ss-detail"><header className="ss-detail-heading"><div><h3>{service<=5?rule.name:service===6?'CTI':'해외환자 번역'}</h3><p>{service<=5?PROGRAM_SETUP[index].purpose:'미제공 · 실제 서비스 연결 전'}</p></div>{service<=5&&<label>운영 날짜 <input type="date" aria-label="운영 날짜" value={date} onChange={e=>onDate(e.target.value)}/></label>}</header>
{service<=5&&<><ol className="ss-service-flow">{flows[service].map((s,i)=><li key={s}><span>{i+1}</span>{s}</li>)}</ol>
{owner&&slug&&<section className="ss-runner-section"><button aria-expanded={showRunner} onClick={()=>setShowRunner(!showRunner)}>{showRunner?'접기':'열기'} · 준비 시작·반복 운영·서비스 기준</button>{showRunner&&<RunnerControl hospital={slug} service={service} date={date} result={executionResult}/>}</section>}
{service===2&&slug==='yonsei'&&owner&&<RecellReservationSync/>}
{supported?<SSProduction hospital={slug} date={date} onDateChange={onDate} onResult={setExecutionResult}/>:<section className="ss-data-readiness"><h4>이 서비스에 필요한 자료와 시작 조건</h4><p>{rule.basis}</p><dl><dt>필수 자료</dt><dd>{rule.fields.join(' · ')}</dd><dt>자료 유효 기준</dt><dd>{rule.freshness}</dd><dt>현재 연결 상태</dt><dd>자동 자료 판정·제작 연결 미완료. 아래 준비 계획에서 확보할 자료와 담당을 지정합니다.</dd><dt>다음 준비</dt><dd>{rule.missing}</dd></dl><p className="muted">다른 서비스의 EMR 수량이나 검수 결과로 이 서비스를 운영 가능하다고 판단하지 않습니다.</p></section>}
</>}
<ServiceNextSteps key={hospital.key+name} hospital={hospital} index={index} service={name} model={model} onSave={onSave} editable={owner}/>
<details className="ss-legacy-records" onToggle={e=>setLegacy(e.currentTarget.open)}><summary>이전 운영 기록·월별 관리·수동 기록 수정</summary>{legacy&&<ServiceReviewPanel hospital={hospital} owner={owner} onSave={onSave} onRecord={onTask} onDirty={onDirty} view="service" embedded startProgram={name} productionDate={date} recordsOnly/>}</details></section>;
}
