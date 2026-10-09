export type Org = 'DO'|'DSS'|'PM'|'DM'|'OS'|'SS'|'CA';
export const ORGS: {id:Org;name:string;human:string;ai:string;after:string}[] = [
 {id:'DO',name:'의사결정',human:'전무이사님 · 지시와 결과를 직접 판단',ai:'판단에 필요한 원문·선택지·변경 내역 정리',after:'반복 업무와 예외 모두 직접 열람하고 다음 지시'},
 {id:'DSS',name:'의사결정 지원',human:'경화님 겸직 · 인사·근태·결제·회사 계정·자료 회수 실무',ai:'경리·인사·총무·정보전략 지원',after:'내부 마감, 증빙 확보, 계정 담당 연결'},
 {id:'PM',name:'기획실 · 기획·품질·전사 KPI',human:'경화님·신규 알바 겸직 · AI 지시·결과 수정·전무이사님↔외주 소통',ai:'광고·소식지·서비스 기획, 품질 점검과 KPI 분석',after:'광고·소식지·서비스 기획, 제품 품질·개선 이력, 전사 목표·실적 관리'},
 {id:'DM',name:'델리버리 매니저 · 소식지 배송 · OS 하위',human:'소식지 배송 담당 · 출고·병원 전달·수령 여부 기록',ai:'소식지 배송 동선·배송 물량·미배송·재방문 기록 정리',after:'Delivery Manager. 소식지 배송과 배송 결과를 관리. 전화 소개·행사 참여·EMR 분석 신청 영업은 OP 담당'},
 {id:'OS',name:'OS · DM 소식지 배송·OP 전화 영업',human:'DM은 소식지 배송. OP는 전화로 이번 소식지 소개·행사 참여·EMR 분석 신청 영업',ai:'배송·수령 기록과 소식지별 소개 내용·행사 참여·EMR 분석 신청·통화 결과 연결',after:'OS 아래 DM(Delivery Manager)과 OP(Operator)을 구분. 배송 업무와 전화 영업의 지시·실적·결과를 구분해 운영'},
 {id:'SS',name:'셋팅 앤 서비스',human:'경화님·신규 알바 겸직 · AI 소팅·분석 지시·수정 및 병원 운영',ai:'셋팅 준비·운영 자료·C콜 전후 효과·녹음·환자 반응 정리',after:'Setting & Service. 병원별 셋팅 → 반복 서비스·예외 관리 → CA 콘텐츠 대행을 구분해 운영'},
 {id:'CA',name:'콘텐츠 에이전시·마케팅 대행 · SS 하위',human:'경화님·신규 알바 겸직 · AI 콘텐츠 제작 지시·수정·외주 소통',ai:'콘텐츠·영상 초안·제작·수정·일정 준비',after:'Content Agency. 영상 중심 콘텐츠와 마케팅 대행으로 병원 객단가 향상을 지원. 기본 서비스와 매출·원가를 별도로 기록'}
];
export const PEOPLE=[{id:'do',name:'전무이사님',kind:'사람'},{id:'kyunghwa',name:'경화님',kind:'사람'},{id:'kimkiyoung',name:'김기영 주임',kind:'사람'},{id:'parttime',name:'기존 알바 자리',kind:'사람'},{id:'parttime_am',name:'신입 오전반 · 이름 확인 전',kind:'사람'},{id:'parttime_pm',name:'신입 오후반 · 이름 확인 전',kind:'사람'},{id:'ai',name:'AI',kind:'AI'},{id:'vendor',name:'외주 제작자',kind:'외주'},{id:'rider',name:'자전거 전달 인력 · 채용 예정',kind:'예정'}];
export const STATUSES=['지시 등록','진행 중','응답 대기','DO 판단 대기','수정 중','실행 대기','완료','보류'] as const;
export const MONTHS=['2026-09','2026-10','2026-11','2026-12'];
export type TaskData={title:string;instruction:string;criterion:string;org:Org;assignee:string;coordinator:string;collaboration?:string;start:string;due:string;priority:string;phase:string;status:string;nextAction:string;waitFor:string;waitSince:string;contactAt:string;customer:string;sourceUrl:string;parentId:number|null;minutes:number;revision:number;approvedRevision:number|null;decisionNote:string;result:string;resultUrl:string;execution:string;repeat:string;series:string;notes:string};
export type RecordRow={id:number;org:Org;kind:string;version:number;data:any;created_at:string;updated_at:string};
export type Task=RecordRow&{data:TaskData};
export type Member={id:string;person:string;role:string;dss:number;label:string;active:number;access?:{orgs:string[];screens:string[];weekdays:number[];scheduleConfirmed:boolean};mustChangePassword?:boolean};
export const NAME=(id:string)=>PEOPLE.find(p=>p.id===id)?.name||id;
export const orgName=(id:string)=>ORGS.find(o=>o.id===id)?.name||id;
export const blankTask=(org:Org='PM'):TaskData=>({title:'',instruction:'',criterion:'',org,assignee:'kyunghwa',coordinator:'do',collaboration:'',start:'',due:'',priority:'보통',phase:'구축·세팅',status:'지시 등록',nextAction:'',waitFor:'',waitSince:'',contactAt:'',customer:'',sourceUrl:'',parentId:null,minutes:0,revision:0,approvedRevision:null,decisionNote:'',result:'',resultUrl:'',execution:'',repeat:'없음',series:'',notes:''});
export const idLabel=(id:number)=>`CC-${String(id).padStart(5,'0')}`;
export const PLAN=[
 {month:'2026-09',goal:'기준 정리와 실무 적응',work:'조직별 자리·지시·결과를 연결하고 첫 업무를 기록합니다. 9월 14일부터 고경화·오전 신입·오후 신입이 각각 담당 AI 상사와 업무를 수행합니다. 고경화에게 신입 감독·평가를 맡기지 않습니다.',done:'지시→결과→DO 수정·판단→실행 기록이 한 업무에 남음',hire:'DM 전달 물량·동선·모집 준비. 채용일 미정'},
 {month:'2026-10',goal:'익힌 업무를 직접 배정',work:'PM·OS·SS·CA 업무를 자리별 실무자에게 직접 배정합니다. 신규 병원 세팅과 기존 병원 운영을 나눕니다.',done:'담당 업무와 실제 사람시간·대기시간이 구분됨',hire:'자전거 인력은 채용 완료 후 투입. 미채용 시 기존 배치 유지'},
 {month:'2026-11',goal:'반복 운영과 부족시간 측정',work:'후속 연락·월별 콘텐츠·서비스 운영 회차를 연결합니다. 겸직 인계와 반복 업무를 운영합니다.',done:'세팅 완료 후에도 운영 업무가 이어지고 미처리가 남음',hire:'실제 사람시간·동시 일정이 부족한 자리에 한해 검토'},
 {month:'2026-12',goal:'안정화와 다음 해 범위 확정',work:'12월 15일까지 오류·인계·복구를 점검합니다. 12월 31일까지 조직별 미처리·계약량·충원 판단을 정리합니다.',done:'진행·완료·미처리 기록과 실제 결과가 일치함',hire:'DO가 1월 인원·외주 범위를 결정. 날짜만으로 권한 확대 없음'}
];
export function promptFor(t:Task){return `[ChartClean ${idLabel(t.id)} / ${t.org} / 결과 ${t.data.revision+1}차]\n전무이사님 지시 원문:\n${t.data.instruction}\n\n완료 기준: ${t.data.criterion}\n현재 결과: ${t.data.result||'없음'}\nDO 수정·판단: ${t.data.decisionNote||'없음'}\n다음 행동: ${t.data.nextAction||'결과 작성'}\n\n기획·개발·진행관리는 AI가 수행합니다. 사람은 AI에 지시하고 결과를 확인·수정하여 DO가 원하는 성과물로 만들며, 조직별 실무와 소통을 수행합니다. 결과와 근거, 미완료를 구분해 주세요. 외부 발송·게시·계약은 실행하지 마세요. 이 요청은 ERP에서 자동 발송되지 않습니다.`;}
