'use client';
import {Button} from '@/components/ui/button';
export default function SSGuide({onNavigate}: {onNavigate:(tab:string)=>void}){
 return <section className="panel"><div className="section-heading"><div><h2>SS 업무 기준</h2><p className="muted">서비스 운영, 병원별 셋팅, 콘텐츠 제작을 구분하고 같은 병원·업무 기록으로 이어갑니다.</p></div></div>
 <div className="manual-intro"><h3>서비스 · 이미 시작한 고객사 업무</h3><p>병원별 서비스의 진행 상태, 처리 결과, 남은 문제와 다음 행동을 확인합니다. 들어온 병원 요청·전화·메시지·EMR 관련 처리 건은 ‘접수·처리’에 등록하고 담당·기한·결과를 같은 업무에 남깁니다.</p><Button variant="outline" onClick={()=>onNavigate('서비스')}>서비스 보기</Button></div>
 <div className="manual-intro"><h3>C콜 · 환자 연락과 효과 검증</h3><p>SS는 병원 환자에게 연락하는 B2B2C 업무를 담당합니다. 장기미내원 메시지의 전화 없음·발송 전 전화·발송 후 전화를 비교하고, 실제 통화 시각·결과·녹음·수신·열람·응답을 연결합니다. 시험의 효용을 검토한 뒤 서비스 적용과 가격을 제안합니다. OS의 B콜은 병원 담당자와의 연락이며, B의 EMR 확보부터 A의 분석·계약까지 이어집니다.</p><Button variant="outline" onClick={()=>onNavigate('C콜')}>C콜 업무 열기</Button></div>
 <div className="manual-intro"><h3>셋팅 · 시작하거나 변경할 준비</h3><p>병원 정보, 자료 수령 범위, 서비스 조건, 문구·시점, 연결과 검수 기준을 맞춥니다. ‘맞춤 요청’에는 병원이 원하는 변경과 확인할 자료를 남기고, 실제 셋팅에 반영한 뒤 다시 검수합니다. 계약 전 시연·샘플 준비와 계약 후 운영 준비는 구분합니다.</p><Button variant="outline" onClick={()=>onNavigate('세팅')}>셋팅 보기</Button></div>
 <div className="manual-intro"><h3>CA · 콘텐츠 제작과 운영</h3><p>병원별 콘텐츠 요청, 제작본, 수정 사항, 확인 결과와 게시 상태를 관리합니다. 제작 완료와 실제 게시 완료를 구분하고, 게시 위치와 실행 근거를 남깁니다.</p><Button variant="outline" onClick={()=>onNavigate('CA')}>CA 보기</Button></div>
 <div className="manual-intro"><h3>접수·처리가 셋팅과 다른 점</h3><p>접수는 새로 들어온 일을 기록하고 담당에게 연결하는 단계입니다. 모든 접수에 셋팅 변경이 필요한 것은 아닙니다. 운영 중 처리할 요청은 서비스에서 끝내고, 설정·문구·연결 변경이 필요하면 셋팅의 맞춤 요청으로 연결해 주세요.</p></div>
 <div className="manual-intro"><h3>처리와 완료 기준</h3><p>요청 원문 확인 → 담당·기한 지정 → 작업 → 결과·근거 기록 → 확인·후속 조치 순서로 진행합니다. 준비·테스트·실제 실행을 구분하고, 확인하지 않은 발송·계약·연결은 완료로 표시하지 않습니다. 막힌 일에는 이유와 확인할 사람, 다음 행동을 남깁니다.</p></div>
 <div className="manual-intro"><h3>담당과 교대</h3><p>일과 기록은 SS 조직 아래에 두고 담당자가 바뀌면 같은 업무를 이어받습니다. 완료한 것, 남은 것, 결과물 위치, 다음 행동과 다음 담당자를 기록합니다. 실제 담당 배치·진행·관리 기준은 위의 ‘담당·진행’에서 확인합니다.</p></div>
 </section>
}
