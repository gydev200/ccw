export const CA_CHANNELS = [
 {id:'branding',name:'브랜딩',scope:'미팅 기록 → 방향·범위 확정 → 제작·검수·인계',automation:'기존 미팅·제안·견적 대조와 초안 제작',human:'브랜드 방향·계약 조건 결정과 서명',connection:'마음편한 U 미팅 전사·견적 연결',next:'9월 18일 금요일 브리핑과 계약 협의'},
 {id:'ads',name:'네이버 키워드 광고',scope:'실적 확인 → 키워드·소재 검토 → 변경안 준비',automation:'광고 보고서 수집·비용 계산·이상 항목 추출',human:'예산·입찰·소재 변경 승인',connection:'공식 연동 권한 확인 전',next:'현재 광고 보고서와 운영 기준 확보'},
 {id:'instagram',name:'인스타그램 편집·업로드',scope:'원본 확인 → 편집·자막 → 검수 → 승인본 업로드',automation:'규격·자막·빠진 장면 대조, 게시 준비',human:'촬영·콘텐츠 판단과 게시 승인',connection:'업무 계정·게시 연결 미확인',next:'기존 편집 예시와 승인본 기준 연결'},
 {id:'blog',name:'블로그 센터',scope:'주제·원자료 → 제작 → 검수 → 게시',automation:'원자료 대조·누락 점검·수정본 비교',human:'새 표현·내용 판단과 게시 승인',connection:'기존 프로그램 확인 / 로그인 재시험 대기',next:'별도 고도화안·계산안 수령 후 검토'},
 {id:'traffic',name:'트래픽 검수',scope:'레드로그 순위 확인 + 플레이스 유입수 대조',automation:'입력 수치 대조·자료 누락·변동 계산',human:'수치 차이·기간 불일치·급변 원인 확인',connection:'수치 대조 가능 / 원본 자동수집 미연결',next:'레드로그 주소·동일 지표 기준 확인'},
] as const;
export type TrafficInput={clinic:string;keyword:string;date:string;rankDate:string;placeDate:string;reportDate:string;rank:string;previousRank:string;visits:string;reported:string;previousVisits:string;threshold:string;sameMetric:boolean;rankSource:string;placeSource:string;reportSource:string};
export const emptyTraffic:TrafficInput={clinic:'',keyword:'',date:'',rankDate:'',placeDate:'',reportDate:'',rank:'',previousRank:'',visits:'',reported:'',previousVisits:'',threshold:'30',sameMetric:false,rankSource:'',placeSource:'',reportSource:''};
function number(value:string,label:string,integer=false,min=0){
 if(!value.trim())return null;
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>1e12||(integer&&!Number.isSafeInteger(n)))throw Error(label+' 값을 확인해 주세요.');return n;
}
function day(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function checkTraffic(v:TrafficInput){
 const issues:string[]=[];
 if(!v.clinic.trim()||!v.keyword.trim())issues.push('병원·키워드 입력 필요');
 for(const [key,label] of [['date','검수 기준일'],['rankDate','순위 기준일'],['placeDate','플레이스 기준일'],['reportDate','보고서 기준일']] as const){if(!day(v[key]))issues.push(label+' 확인 필요');else if(key!=='date'&&v[key]!==v.date)issues.push(label+' 불일치');}
 const rank=number(v.rank,'현재 순위',true,1),previousRank=number(v.previousRank,'이전 순위',true,1),visits=number(v.visits,'플레이스 유입수',true),reported=number(v.reported,'보고서 유입수',true),previousVisits=number(v.previousVisits,'이전 유입수',true),threshold=number(v.threshold,'변동 알림 기준');
 if(threshold===null||threshold<=0)throw Error('변동 알림 기준은 0보다 큰 수로 입력해 주세요.');
 if(rank===null)issues.push('순위 미확인 (순위 밖·조회 실패를 구분해 확인)');
 if(visits===null||reported===null)issues.push('대조할 유입수 누락');
 if(!v.sameMetric)issues.push('두 유입수의 지표·집계 조건 확인 필요');
 for(const [key,label] of [['rankSource','순위'],['placeSource','플레이스'],['reportSource','보고서']] as const){if(!v[key].trim())issues.push(label+' 근거 미입력');}
 const comparable=v.sameMetric&&day(v.date)&&v.date===v.placeDate&&v.date===v.reportDate;
 const difference=comparable&&visits!==null&&reported!==null?visits-reported:null;
 if(difference!==null&&difference!==0)issues.push('플레이스와 보고서 유입수 차이 '+difference+'건');
 const change=visits!==null&&previousVisits!==null&&previousVisits>0?(visits-previousVisits)/previousVisits*100:null;
 if(change!==null&&Math.abs(change)>=threshold)issues.push('이전 동일 길이 기간 대비 유입 '+change.toFixed(1)+'% 변동');
 if(previousVisits===0&&visits!==null&&visits>0)issues.push('이전 유입 0건: 증감률 계산 불가');
 return {issues,difference,change,rankChange:rank!==null&&previousRank!==null?previousRank-rank:null,status:issues.length?'확인 필요':'입력 수치 대조 일치',note:'입력값 계산 결과입니다. 원본 진위·수집 성공·마케팅 효과를 보증하지 않습니다.'};
}
export type CostInput={count:string;production:string;review:string;upload:string;hourly:string;external:string;tools:string;setup:string;months:string;revenue:string};
export const emptyCost:CostInput={count:'',production:'',review:'',upload:'',hourly:'',external:'',tools:'',setup:'',months:'',revenue:''};
export function calculateBlog(v:CostInput){
 const values=Object.fromEntries(Object.entries(v).map(([key,value])=>[key,number(value,key,key==='count'||key==='months')])) as Record<keyof CostInput,number|null>;
 if(Object.entries(values).some(([key,value])=>key!=='revenue'&&value===null))throw Error('계산에 필요한 값을 모두 입력해 주세요. 비용이 없으면 0을 입력합니다.');
 const n=values as Record<keyof CostInput,number>;
 if(n.count<=0||n.months<=0)throw Error('월 편수와 세팅비 배분 개월은 1 이상이어야 합니다.');
 const minutes=n.count*(n.production+n.review+n.upload),labor=minutes/60*n.hourly,operating=labor+n.count*n.external+n.tools,monthly=operating+n.setup/n.months;
 return {minutes,labor,operating,monthly,unit:monthly/n.count,firstMonth:operating+n.setup,margin:values.revenue===null?null:n.revenue-monthly};
}
export function caTask(channel:string,instruction?:string){
 const c=CA_CHANNELS.find(x=>x.id===channel)||CA_CHANNELS[0];
 return {org:'CA',title:c.name+' · '+(instruction?'검토 결과':'자동화 준비'),phase:'반복 운영',instruction:instruction||[c.scope,'자동화할 일: '+c.automation,'사람 확인: '+c.human,'현재 연결: '+c.connection].join('\n'),criterion:'근거·확인 결과·미해결 항목 기록. 실제 실행 완료는 실행 증빙으로 별도 확인.',nextAction:c.next,notes:'CA 분류: '+c.id+' / 2026-09-15 구성'};
}
