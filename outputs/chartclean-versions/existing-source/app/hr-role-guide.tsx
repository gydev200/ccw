'use client';
import {useState} from 'react';
const roles=[
 {id:'DS',name:'원장 대면·전문 영업',pitch:'병원 운영의 문제를 듣고 2·3차 병원과 신사업의 기회를 개척합니다.',unit:'배정된 병원과의 대면 상담·제안 1회',work:'병원과 기회 확인 → 원장 대면·발표 → 요구와 약속 기록 → 후속 실행 인계',proof:'병원·담당자·면담 일시·확인된 문제·제안·약속·다음 행동을 구분해 남깁니다.',check:'확인된 사실과 제안을 구분하고, 계약·효과를 확정된 것처럼 기록하지 않습니다.',handoff:'OS와 서비스 담당자에게 승인된 약속과 다음 행동을 연결합니다.',scope:'배정된 병원의 영업 자료와 승인된 제안 범위만 사용합니다.',question:'원장이 기존 운영의 어려움을 말할 때 무엇을 확인하고 어떻게 다음 행동을 기록하겠습니까?'},
 {id:'OS',name:'B콜 · 병원 후속 연락',pitch:'방문한 병원이 무엇에 관심을 보였는지 듣고, 다음 상담과 체험으로 연결합니다.',unit:'DM 방문 기록에 연결된 병원 연락 1회',work:'방문·전달 기록 읽기 → 승인된 연락 → 응답·관심사 기록 → 다음 일정 인계',proof:'연락 시각·연결 여부·상담 요약·병원 관심사·요청·다음 행동과 일정. 부재도 별도 결과로 남깁니다.',check:'통화 시도와 실제 연결을 구분하고, 약속하지 않은 내용을 약속으로 기록하지 않습니다.',handoff:'상담·체험·서비스 요청을 같은 병원의 OS/SS 기록으로 연결합니다.',scope:'배정된 병원의 업무 연락만 열람합니다. 할인·계약·결제는 승인된 범위 안에서 안내합니다.',question:'상대방이 바빠서 다시 전화해 달라고 하면 어떻게 기록하고 인계하겠습니까?'},
 {id:'DM',name:'병원 방문·전달',pitch:'정해진 병원에 자료를 정확히 전달하고, 다음 연락에 필요한 현장 정보를 남깁니다.',unit:'배정된 병원 1곳의 방문 1회',work:'배정 확인 → 방문 → 전달·미전달 기록 → 관심사·다음 연락 인계',proof:'병원·방문 회차·일시·전달 결과·관심사·후속 행동. 전달하지 못했으면 사유와 재방문 필요 여부를 기록합니다.',check:'전달·미전달을 구분하고 다른 병원의 기록과 섞이지 않았는지 확인합니다.',handoff:'OS B콜 담당자에게 같은 병원의 방문 기록을 이어줍니다.',scope:'배정된 방문 목록과 본인 결과만 사용합니다. 환자 자료는 수집하지 않습니다.',question:'병원에서 자료를 받지 않거나 담당자가 없을 때 무엇을 남기겠습니까?'},
 {id:'SS',name:'C콜 · 환자 안내 연락',pitch:'병원이 승인한 발송 예정·완료 명단에서 연락 가능한 환자에게 안내하고, 상담 요청은 병원으로 연결합니다.',unit:'배정된 병원·회차의 연락 가능한 환자 1명에 대한 연락 1회',work:'병원·회차·연락 가능 여부 확인 → 승인된 안내문으로 연락 → 통화 결과·다음 행동 기록 → 필요 시 병원 담당자 인계',proof:'환자번호·병원·발송 회차·실제 통화 시각·연결/부재/거절 결과·요청·다음 행동. 통화 시도와 실제 연결을 구분합니다.',check:'링크 접속으로 제외된 대상과 연락 중단 대상에게 전화하지 않습니다. 발송 접수·문자 수신·링크 접속·통화 완료를 구분합니다.',handoff:'의료 상담과 진료 판단은 병원 담당자에게 연결하고, 연락 거절은 후속 연락 중단 기록에 반영합니다.',scope:'배정된 환자의 승인된 안내 범위만 열람합니다. 본인 확인 전에 진료 내용을 말하지 않으며 개인 기기로 원문을 옮기지 않습니다. 녹음은 병원과 정한 운영 기준 확인 후 기록에 연결합니다.',question:'환자가 연락을 원하지 않거나 진료 상담을 요청하면 각각 어떻게 기록하고 인계하겠습니까?'}
];
export default function HrRoleGuide({onNavigate}:{onNavigate:(tool:string)=>void}){
 const [selected,setSelected]=useState('DS');const role=roles.find(r=>r.id===selected)!;
 return <section className="panel" aria-label="영업·현장·연락 업무 채용 기준">
 <h2>영업·현장·연락 업무 채용 기준</h2><p><strong>명확한 업무, 남는 기록, 검토 가능한 근거.</strong> 차트클린과 병원의 다음 일을 연결할 동료를 찾습니다.</p>
 <p className="muted">내부 모집안입니다. 채용 공고 게시·지원자 평가·보수 확정은 실행하지 않습니다.</p>
 <div className="actions" aria-label="채용 역할">{roles.map(r=><button type="button" key={r.id} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}>{r.id} · {r.name}</button>)}</div>
 <h3>{role.id} · {role.name}</h3><p>{role.pitch}</p>
 <dl className="record-facts">{[['업무 단위',role.unit],['하는 일',role.work],['남길 결과',role.proof],['확인 기준',role.check],['다음 담당자',role.handoff],['접근 범위',role.scope],['실습·면담 질문',role.question]].map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
 <details><summary>보상·계약을 확정하기 전에</summary><p>업무 단위는 배정·기록의 단위이며 자동으로 건당 임금을 확정하지 않습니다.</p><ul><li>계약 형태, 근무 장소·시간, 업무 지휘 방식, 역할별 보수와 지급일: 미정</li><li>이동·대기·교육·연락 실패·재작업의 처리와 실비 기준: 사전 확정 필요</li><li>근로계약 적용 시 근로시간·임금 등 조건을 서면으로 정하고 지급 기준을 확인합니다. 회사 확인 지연을 자동 무급 처리하지 않습니다.</li><li>완료 결과·작업시간·검토 결과·정산 내역을 연결하고 이의제기와 수정 근거를 남깁니다.</li></ul><p>계약 명칭보다 실제 지휘·감독 등 업무 관계를 함께 검토합니다. <a href="https://www.moel.go.kr/news/cardinfo/view.do?bbs_seq=20190300811" target="_blank" rel="noreferrer">고용노동부 근로자성 안내</a> · <a href="https://moel.go.kr/mainpop2.do" target="_blank" rel="noreferrer">근로계약 안내</a></p></details>
 <details><summary>채용부터 업무 종료까지</summary><ol><li>역할·근무 방식·보수·담당자 확정 후 공고 승인</li><li>지원서 접수 → 동일한 역할 실습과 면담 → 근거를 기록해 사람의 채용 판단</li><li>계약·서약 → 교육 → 본인 업무 권한 발급 → 첫 배정</li><li>결과·시간 기록 → 확인·보완 → 약정 기준 정산 → 피드백</li><li>잔여 업무 인계 → 정산 확인 → 계정·기기 회수 → 종료 근거 보관</li></ol></details>
 <div className="actions"><button onClick={()=>onNavigate('HR:documents')}>계약·서약 원본</button><button onClick={()=>onNavigate('HR:people')}>입사·퇴사 진행</button><button onClick={()=>onNavigate('HR:education')}>교육</button><button onClick={()=>onNavigate('FM:work')}>정산 업무</button></div>
 </section>
}
