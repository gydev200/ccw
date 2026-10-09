export type HrComplianceRule={id:string;title:string;threshold:number;condition:string;action:string;source:string;note?:string};
export const HR_COMPLIANCE_RULES:HrComplianceRule[]=[
 {id:'contract',title:'근로조건 서면 명시·교부',threshold:1,condition:'근로계약 체결·변경',action:'계약 조건, 교부 원본과 변경일을 직원별로 확인',source:'https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsiSeq=284443'},
 {id:'payslip',title:'임금명세서 교부',threshold:1,condition:'임금 지급 시',action:'명세서 내용과 실제 교부 결과를 급여 기록에 연결',source:'https://www.moel.go.kr/news/cardinfo/view.do?bbs_seq=20260800279'},
 {id:'employment-rules',title:'취업규칙 작성·신고',threshold:10,condition:'상시근로자 10명 이상',action:'취업규칙 원본, 근로자 의견·동의와 신고 결과를 관리',source:'https://1350.moel.go.kr/rtmview.do?id=1000261920'},
 {id:'labor-council',title:'노사협의회 설치·운영',threshold:30,condition:'근로조건 결정권이 있는 30명 이상 사업·사업장',action:'위원 구성, 운영 규정, 정기 회의와 안건·결과를 기록',source:'https://www.moel.go.kr/policyitrd/policyItrdView.do?policy_itrd_sn=197',note:'사업장 단위와 근로조건 결정권을 확인해야 합니다.'},
 {id:'disability',title:'장애인 의무고용',threshold:50,condition:'상시근로자 50명 이상',action:'월별 상시근로자 수와 의무고용 인원을 확인',source:'https://www.kead.or.kr/pymntinchr/cntntsPage.do?menuId=MENU0668',note:'50~99명과 100명 이상은 부담금 신고 기준이 다릅니다.'},
 {id:'disability-levy',title:'장애인 고용부담금 경계',threshold:100,condition:'월평균 상시근로자 100명 이상',action:'100명에 가까워질 때 부담금 신고 여부와 산정 자료를 검토',source:'https://www.kead.or.kr/pymntinchr/cntntsPage.do?menuId=MENU0668'},
 {id:'harassment-training',title:'직장 내 성희롱 예방교육',threshold:1,condition:'사업주 연 1회 이상',action:'회사 자체 절차를 포함한 교육 자료와 실시·참석 근거를 보관',source:'https://labor.moel.go.kr/reportCntr/sexualHrss.do'},
 {id:'safety-training',title:'산업안전보건교육 적용 확인',threshold:5,condition:'업종·업무·교육 대상에 따라 다름',action:'실제 업종과 직무를 확인하고 대상 교육·시간·이수 근거를 관리',source:'https://1350.moel.go.kr/rtmview.do?id=1000308193',note:'인원 수만으로 교육 대상이라고 확정하지 않습니다.'},
 {id:'harassment-procedure',title:'직장 내 괴롭힘 예방·조치 절차',threshold:10,condition:'취업규칙 기재 및 신고 대상',action:'접수·비밀유지·조사·보호·후속 조치의 담당과 원본을 관리',source:'https://1350.moel.go.kr/rtmview.do?id=1000298618'},
];
export function hrRuleState(rule:HrComplianceRule,headcount:number){return headcount<rule.threshold?'인원 기준 미도달':rule.note?.includes('확인해야')||rule.note?.includes('확정하지')?'조건 확인 필요':'관리 대상'}
