export const OS_ROLES={
 DM:{name:'델리버리 매니저',english:'Delivery Manager',work:'건물군별 소식지 배송',description:'건물군 → 건물 → 입점 병원 순서로 배송 위치를 확인하고 전달 여부와 미배송·재방문 사유를 기록합니다.'},
 OP:{name:'오퍼레이터',english:'Operator',work:'소식지 소개·행사 참여·EMR 분석 신청 영업',description:'전화로 이번 소식지를 소개하고 행사 참여와 EMR 분석 신청을 받는 영업을 합니다.'},
} as const;
export const OP_ACTIVITIES=['이번 소식지 소개','행사 참여 안내','EMR 분석 신청'] as const;
