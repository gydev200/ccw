'use client';
import './hr-recruiting-brand.css';

const jobs=[
 {id:'DS',name:'다이렉트세일즈',kind:'전문 영업',mission:'원장과 직접 만나 병원 운영 문제를 듣고, 2·3차 병원과 신사업 기회를 개척합니다.',work:'원장 대면 · 발표 · 복잡한 제안 · 신사업 개척',career:'병원 운영 이해 → 대면 상담과 제안 → 고난도 시장 개척',dress:'남녀 동일 직무 · 앞면 전체 단추 화이트 셔츠, 왼 가슴 실제 주머니·주머니 위 로고·볼펜 2개'},
 {id:'OS',name:'표준 서비스 확장',kind:'반복 확장',mission:'검증된 서비스 품질과 브랜드 경험을 바탕으로 병원과의 관계를 이어가고 확장합니다.',work:'병원 후속 연락 · 체험 연결 · 서비스 정착 확인',career:'현장과 서비스 이해 → 후속 상담 → 반복 운영과 확장',dress:'남녀 동일 직무 · 역할에 맞는 화이트 상의'},
 {id:'DM',name:'현장 배포',kind:'OS 아래 현장 접점',mission:'자료를 정확하게 전달하고 활동 결과, 방문 인사, 병원의 현장 정보를 남겨 다음 업무로 잇습니다.',work:'배포 · 활동 기록 · 현장 반응 · 다음 담당자 인계',career:'현장 기록과 인계 → 배포 품질과 병원 이해 → 다른 직무 지원 가능',dress:'남녀 동일 직무 · 가슴 주머니 없는 화이트 3단추 긴팔 폴로, 왼 가슴·모자 정면 로고'}
] as const;

export default function HrRecruitingBrand({onNavigate}:{onNavigate:(tool:string)=>void}){
 return <section className="hr-recruit-brand" aria-label="채용 브랜딩 내부 시안">
  <header className="hr-brand-hero"><small>CHARTCLEAN · 채용 브랜딩 내부 시안</small><h3>병원의 다음 일을 이어 주는 사람</h3><p>차트클린은 병원 업무의 과정을 기록하고 연결합니다. 담당자가 바뀌어도 방문, 상담, 서비스 운영의 다음 행동이 이어지도록 일합니다.</p><button type="button" onClick={()=>onNavigate('HR:recruiting')}>직무별 내부 모집안 보기</button></header>
  <div className="hr-brand-intro"><h4>우리가 함께 일하는 방식</h4><p>맡은 일의 결과와 근거를 남기고 다음 담당자에게 넘깁니다. 현장의 사실과 고객의 약속을 구분해 기록하며, 확인되지 않은 성과를 보상으로 단정하지 않습니다.</p></div>
  <div className="hr-brand-org"><h4>직원용 직무 구조</h4><p>DS가 새로운 기회를 개척하고, OS가 검증된 서비스를 균일하게 확장합니다. DM은 OS 아래에서 현장 접점을 담당합니다.</p><div className="hr-brand-grid">{jobs.map(job=><article key={job.id} className={'hr-brand-role hr-brand-'+job.id.toLowerCase()}><div className="hr-brand-role-head"><span>{job.id}</span><small>{job.kind}</small></div><h5>{job.name}</h5><p>{job.mission}</p><dl><dt>주요 업무</dt><dd>{job.work}</dd><dt>경험 방향</dt><dd>{job.career}</dd><dt>복장</dt><dd>{job.dress}</dd></dl></article>)}</div><p className="hr-brand-caption">경험 방향은 직무 소개 시안입니다. 보직 이동이나 승진을 약속하는 기준이 아닙니다.</p></div>
  <div className="hr-brand-uniform"><div><h4>같은 역할, 같은 복장 기준</h4><p>남녀가 같은 역할과 복장 기준을 적용받습니다. 공통 색은 화이트 상의, 스톤 베이지 하의 <strong>#B7AA91</strong>, 최종 선택된 밝은 2번 벨트 <strong>#A87545 · RGB 168/117/69</strong>입니다.</p><div className="hr-brand-uniform-roles"><p><strong>DS 상담·미팅형</strong> 앞면 전체 단추 화이트 셔츠. 착용자 왼 가슴의 실제 주머니 위에 ChartClean 공식 로고를 두고 볼펜 2개를 꽂습니다.</p><p><strong>돌파 현장형</strong> 가을·겨울에도 카라와 단추 2~3개가 있는 화이트 긴팔 기능성 폴로티. DS 상담형과 분명히 구분합니다.</p><p><strong>DM 배포형</strong> 가슴 주머니 없는 화이트 3단추 긴팔 폴로티. 왼 가슴에 공식 로고를 직접 표시합니다. 모자 정면 로고와 측면 H01 원형 3~4cm를 비교 중이며 모자 스타일은 아직 선택 전입니다.</p></div><p className="hr-brand-markings"><strong>공식 표식 전체 적용</strong> DS는 왼쪽 카라와 왼 가슴 주머니 위, DM은 왼 가슴과 모자 정면에 공식 로고를 둡니다. H01 캐릭터 원형 탈착 패치는 오른쪽 가슴의 조금 위쪽에 둡니다. 흰 사원증 줄에는 로고와 원형 H01을 넣고 카드가 전부 보이게 합니다.</p></div><div className="hr-brand-swatches" aria-label="복장 색상"><span className="hr-brand-white">화이트 상의</span><span className="hr-brand-stone">스톤 베이지 하의<br/>#B7AA91</span><span className="hr-brand-brown">밝은 2번 벨트<br/>#A87545</span></div></div>
  <figure className="hr-brand-uniform-photo"><img src="/hr-uniform/6-person-bright-belt-18mm-20261004.png" width="1774" height="887" loading="lazy" alt="남녀 여섯 명의 차트클린 복장 시안. 밝은 브라운 벨트와 로고·원형 H01 무늬가 있는 흰 사원증 줄, 가운데 DS 남녀의 실제 주머니와 볼펜 두 개를 볼 수 있습니다. 얼굴은 초기 참고 렌더입니다."/><figcaption>밝은 2번 벨트 · 18mm 줄 시안 · 얼굴은 초기 참고 렌더</figcaption></figure>
  <div className="hr-brand-production-task"><h4>별도 브랜드 과제 · 사원증 줄과 카드 제작 준비</h4><p>업체 최소 주문 수량·가격·집게·화이트 카드를 조사 중입니다. 줄 폭은 15mm·18mm를 비교하며 10mm는 기준이 아닙니다. 현재 사진은 18mm 시안이고 정확한 제작 디자인은 브랜드북에서 정리 중입니다.</p><p className="hr-brand-caption">모자 5종도 정면 로고와 측면 H01 원형 3~4cm를 비교 중입니다. 스타일 선택과 주문은 아직 하지 않았습니다.</p></div>
  <div className="hr-brand-support"><h4>콘텐츠 제작과 영업 지원</h4><p>CA·AI 콘텐츠 공장은 DO 아래에서 한 사람이 검수하고 자동화를 관리하는 방향입니다. 이 화면은 추가 채용 규모를 정하지 않습니다.</p></div>
  <div className="hr-brand-rules"><h4>확정 전 규칙판</h4><p>영업권, DB 배분, 역할별 기여, 보상 기준은 경영의 승인된 원본을 참조할 자리입니다. 현재 이 화면에서 정하는 값은 없습니다.</p><div className="hr-brand-rule-grid">{['병원 영업권','DB 배분','역할별 기여','보상 기준'].map(label=><div key={label}><span>{label}</span><strong>미확정</strong></div>)}</div><p className="hr-brand-caption">이 시안으로 성과급이나 인사평가를 자동 적용하지 않습니다.</p></div>
 </section>
}
