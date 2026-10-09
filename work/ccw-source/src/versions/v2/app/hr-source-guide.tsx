'use client';

const decisions=[
 {title:'긱워커 정산 우선',body:'작업 과정·결과, 수량, 지역 난이도와 거리를 확인해 계산합니다. 대표 승인 뒤 세금 예수금과 지급 내역을 재무로 연결합니다.'},
 {title:'계약 형태 구분',body:'근로계약, 도급계약, 긱워커 계약을 구분하고 서명 원본 또는 스캔본을 남깁니다.'},
 {title:'채용과 회사 소개',body:'채용 브랜딩을 우선하며 채용 사이트, SNS, 회사 홈페이지의 설명과 지원 흐름을 함께 관리합니다.'},
 {title:'추진체계와 비용',body:'사람, AI, 로봇, 차량, 장비, 비품의 역할과 비용·자산 가치를 재무 자료에 연결합니다.'},
 {title:'이사회·자문단',body:'회사에 직간접으로 영향을 주는 이사와 자문단의 역할, 회의와 후속 결정을 별도로 관리합니다.'},
];
export default function HrSourceGuide(){return <section className="panel"><h2>2026-10-04 사람·인사 녹음 반영 사항</h2><p className="muted">녹음 요약에서 업무 항목을 정리했습니다. 숫자·고유명사와 확정 조건은 원본 녹음으로 확인해 기록해 주세요.</p><div className="hr-source-list">{decisions.map(item=><article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div><p className="muted">담당: 김기영 주임 · 원본: 내부 영감아카이브 / 2026-10-04 돈과사람 / 사람 녹음</p></section>}
