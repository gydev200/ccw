export const STAFF=[
 {person:'kyunghwa',name:'고경화',username:'ccw32',supervisor:'배혜진 차장',mentorId:'hyejin'},
 {person:'human-035f1152-71dc-42bc-972b-5f6ffbe3bf77',name:'김경아',username:'ccw53',supervisor:'장은호 차장',mentorId:'eunho'},
 {person:'human-6d5d7680-9693-4df0-8aca-4389892bbe14',name:'김수현',username:'ccw74',supervisor:'윤수민 과장',mentorId:'sumin'}
] as const;
export const DEPARTMENTS=['PM','DM','OS','SS','CA','DSS'] as const;
export const departmentName=(org:string)=>({PM:'PM · 소식지·품질관리',DM:'DM · 전달·현장',OS:'OS · 상담·이식',SS:'SS · 서비스 운영',CA:'CA · 콘텐츠',DSS:'DSS · 인사·업무지원'}[org]||org);
export const kstDay=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
export const ORDER_STATES=['배정','진행 중','조율 필요','상사 확인 대기','보완 요청','완료'] as const;
export function defaultAccess(person:string){return {orgs:person==='kimkiyoung'?['DSS']:person==='kyunghwa'?['PM','DM','OS','SS','CA','DSS']:['PM','DM','OS','SS','CA'],screens:['업무 지시','내 인사·고과','교육·오리엔테이션'],weekdays:[] as number[],scheduleConfirmed:false}}
export function validDate(date:any){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date}
export function validateOrder(d:any){if(!d||!DEPARTMENTS.includes(d.org))throw Error('업무를 둘 부서를 선택해 주세요.');if(!STAFF.some(p=>p.person===d.assignee))throw Error('담당 직원을 선택해 주세요.');if(d.org==='DSS'&&d.assignee!=='kyunghwa')throw Error('DSS 업무는 고경화 사원에게만 배정할 수 있습니다.');if(!validDate(d.date)||typeof d.due!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.due)||!validDate(d.due.slice(0,10))||!Number.isFinite(Date.parse(d.due+'+09:00'))||d.due.slice(0,10)<d.date)throw Error('업무일과 마감일시를 확인해 주세요.');for(const k of ['title','instruction','criterion'])if(typeof d[k]!=='string'||!d[k].trim()||d[k].length>12000)throw Error('업무명·지시·완료 기준을 입력해 주세요.');if(d.sourceUrl&&!/^https?:\/\//.test(d.sourceUrl))throw Error('자료 주소를 확인해 주세요.');return {title:d.title.trim(),instruction:d.instruction.trim(),criterion:d.criterion.trim(),org:d.org,assignee:d.assignee,date:d.date,due:d.due,deadlineProposed:d.deadlineProposed===true,sourceUrl:String(d.sourceUrl||'').slice(0,2000),sourceTitle:String(d.sourceTitle||'직접 지시').slice(0,200),category:d.org==='DSS'?'hr_support':'operations',coordinator:'배상무',supervisor:STAFF.find(p=>p.person===d.assignee)!.supervisor,status:'배정',result:'',evidence:'',blocker:'',next:'',minutes:0};}
export function todayOrders(date='2026-09-16'){
 const [go,kim,su]=STAFF.map(p=>p.person);const rows=[
 ['DSS',go,'이메일 연결과 웍스 익히기','사용할 회사 메일과 업무용 이메일 목록부터 확인해 주세요. 본인 계정에서 연결하고 로그인·받은편지함을 확인하세요. 웍스에서 오늘 지시를 열고 질문과 결과를 남기는 것까지 해보세요. 비밀번호는 업무 글에 적지 마세요.','메일별 연결·미연결 사유, 웍스 로그인·질문·결과 저장 확인','15:00','업무 지시',''],
 ['SS',go,'연세리셀 오늘 처리와 남은 일 확인','연세리셀의 기존 지시와 최신 작업을 확인하고 오늘 처리할 내용을 정리해 주세요. 자료 준비와 실제 발송을 구분하고 막힌 부분은 배상무에게 올려 주세요.','최신 지시 위치, 처리 결과, 미완료·다음 행동·확인할 사람','17:00','연세리셀',''],
 ['DSS',go,'BSS 업무 범위 확인과 실무','말씀하신 BSS 업무의 기존 자료를 확인해 주세요. 무엇을 해야 하는지 먼저 정리해 배상무에게 확인받고, 확인된 인사·지원·실무부터 처리하세요.','BSS 업무명·자료 위치·범위 확인과 처리 결과. 약칭만 보고 다른 업무로 바꾸지 않기','17:30','업무 지시',''],
 ['DSS',go,'인사·지원 업무 마감과 인계','오늘 인사관리와 업무지원에서 처리한 것, 남은 것, 다음 담당자에게 넘길 것을 정리해 주세요. 본인 실무 범위 안에서 기록하세요.','처리·대기·다음 담당·기한을 적은 일지','18:00','업무 지시',''],
 ['PM',kim,'고경화 사원이 부탁한 15분 업무','먼저 고경화 사원에게 부탁받은 일을 확인하세요. 15분 동안 처리하고 결과를 남겨 주세요. 더 걸리면 현재 결과와 추가 시간을 배상무에게 알려 주세요.','요청 내용·실제 결과·소요시간·남은 일','14:30','D(PM 소식지)',''],
 ['OS',kim,'기존 이식본 기준 대조와 오류 기록','어제 만든 병원별 이식본을 기존 이식 기준과 대조해 주세요. AI를 활용해 확인하고, 잘못된 곳은 병원·화면·기준·실제 표시·고칠 내용으로 남기세요.','검수 대상·기준 출처·오류 재현 위치·수정 요청. 확인 못한 항목은 미확인 표시','17:00','D(PM 소식지)',''],
 ['PM',su,'AI로 소식지 제작하고 검수하기','소식지를 반으로 접으면 한쪽은 차트클린 광고, 다른 쪽은 큰 제목 3개와 작은 제목 3개가 있는 잡지 표지로 만들어 주세요. AI로 소재 12개를 찾고 출처·날짜를 확인해 6개를 고르세요. 원고·편집·검수·수정까지 AI를 활용하고 직접 결과를 확인하세요.','소식지 시안·기사와 출처·수정 가능한 원본·AI 작업 과정·검수 수정본','16:30','D(PM 소식지)',''],
 ['PM',su,'소식지와 DM 전달·OS 전화 문안 맞추기','소식지를 전달할 때 할 말과 이후 전화 문안을 만들어 주세요. 전화는 수신 확인, 전달 직원의 공손함과 방해 여부 확인, 이번 소식 안내, 광고 설명 순서로 이어지게 해 주세요.','DM 전달 문안·OS 후속 전화 문안·소식지와의 내용 일치 확인','17:00','차트클린 D',''],
 ['OS',su,'BA 이지행정 남은 항목 마무리','기존 BA 이지행정에서 남은 항목을 찾아 목록으로 만드세요. 바로 고칠 수 있는 것은 AI와 처리하고, 서류·회신·승인이 필요한 것은 담당자와 마감을 적어 남겨 주세요.','잔여 목록·수정 결과·확인 근거·승인 또는 자료 대기 항목','18:00','D(PM 소식지)','']
 ];return rows.map((r,i)=>({...validateOrder({org:r[0],assignee:r[1],title:r[2],instruction:r[3],criterion:r[4],date,due:date+'T'+r[5],sourceTitle:r[6],sourceUrl:r[7],deadlineProposed:true}),seedKey:'instruction-260916-'+i,...(i===2?{status:'조율 필요'}:{})}));
}
