import criteria from './ba-review-criteria.json';
export const REVIEW_ROUND=4;
export const normalizeHospital=(s:string)=>s.normalize('NFKC').replace(/\s/g,'').toLowerCase();
export const services=['장기미내원 관리','예약 맞춤 안내','진료 후 케어','상담 후 관리','검사 결과 알림'];
export type ReviewItem={status:'미검수'|'통과'|'실패'|'해당없음';evidence:string};
export type EmrSummary={asOf:string;rows:number;patients:number;recall:number;invalidDates:number;missingIds:number;futureDates:number;cutoffMonths:number;sourceName:string;topics:{name:string;count:number}[]};
export type PackageData={revision:number;slug:string;officialUrl:string;request:string;b1:{building:string;nearby:string;cases:string};review:{round:number;version:string;reviewer:string;date:string;items:Record<string,ReviewItem>};a:{summary:EmrSummary|null;visits:string;contribution:string;cost:string;note:string};updatedBy:string;updatedAt:string};
export function blankPackage(slug=''):PackageData{return {revision:1,slug,officialUrl:'',request:'',b1:{building:'',nearby:'',cases:''},review:{round:REVIEW_ROUND,version:'',reviewer:'',date:'',items:{}},a:{summary:null,visits:'',contribution:'',cost:'',note:''},updatedBy:'',updatedAt:''}}
const txt=(v:unknown,max=4000)=>{if(typeof v!=='string'||v.length>max)throw Error('입력 길이·형식을 확인해 주세요.');return v.trim()};
const count=(v:any,max=1000000)=>{if(!Number.isSafeInteger(v)||v<0||v>max)throw Error('집계 숫자를 확인해 주세요.');return v};
export function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
export function validatePackage(raw:any,previous:PackageData|null,actor:string,knownSlugs:string[]):PackageData{
 if(!raw||!raw.review||!raw.a)throw Error('B·A 내용을 확인해 주세요.');
 const data=blankPackage();data.slug=txt(raw.slug,100);if(data.slug&&!knownSlugs.includes(data.slug))throw Error('확인되지 않은 체험 병원입니다.');
 if(previous&&data.slug!==previous.slug)throw Error('병원 연결은 변경할 수 없습니다.');
 data.officialUrl=txt(raw.officialUrl,1500);if(data.officialUrl){const u=new URL(data.officialUrl);if(u.protocol!=='https:')throw Error('공식 자료는 https 주소로 입력해 주세요.');}
 data.request=txt(raw.request);for(const k of ['building','nearby','cases']as const)data.b1[k]=txt(raw.b1?.[k]||'',2000);const rr=raw.review;
 if(rr.round!==REVIEW_ROUND)throw Error('현재 검수 기준 4차를 적용해 주세요.');
 data.review={round:REVIEW_ROUND,version:txt(rr.version,200),reviewer:txt(rr.reviewer,100),date:txt(rr.date,10),items:{}};
 if(data.review.date&&!validDate(data.review.date))throw Error('검수일을 확인해 주세요.');
 for(const [id]of criteria){const item=rr.items?.[id];if(!item)continue;if(!['미검수','통과','실패','해당없음'].includes(item.status))throw Error('검수 판정을 확인해 주세요.');const evidence=txt(item.evidence,2000);if(item.status!=='미검수'&&!evidence)throw Error(id+'번 검수 근거를 입력해 주세요.');data.review.items[id]={status:item.status,evidence};}
 if(Object.values(data.review.items).some(x=>x.status!=='미검수')&&(!data.review.version||!data.review.reviewer||!data.review.date))throw Error('검수자·검수일·화면 버전을 기록해 주세요.');
 if(previous&&Object.keys(previous.review.items).length>0&&(previous.slug!==data.slug||previous.officialUrl!==data.officialUrl||previous.request!==data.request||JSON.stringify(previous.b1||{building:'',nearby:'',cases:''})!==JSON.stringify(data.b1)||previous.review.version!==data.review.version))data.review.items={};
 for(const k of ['visits','contribution','cost']as const){const v=txt(raw.a[k],20);if(v&&(!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)>1e12||(k==='visits'&&!Number.isInteger(Number(v)))))throw Error('기대효과 가정은 0 이상의 숫자로 입력해 주세요.');data.a[k]=v;}
 data.a.note=txt(raw.a.note,2000);
 if(raw.a.summary){const s=raw.a.summary;if(!validDate(s.asOf))throw Error('EMR 분석 기준일을 확인해 주세요.');const summary:EmrSummary={asOf:s.asOf,sourceName:txt(s.sourceName,200),rows:count(s.rows),patients:count(s.patients),recall:count(s.recall),invalidDates:count(s.invalidDates),missingIds:count(s.missingIds),futureDates:count(s.futureDates),cutoffMonths:count(s.cutoffMonths,120),topics:[]};if(summary.cutoffMonths<1||summary.patients>summary.rows||summary.recall>summary.patients||summary.invalidDates>summary.rows||summary.missingIds>summary.rows||summary.futureDates>summary.rows)throw Error('EMR 집계의 분모와 기준을 확인해 주세요.');if(!Array.isArray(s.topics)||s.topics.length>10)throw Error('진료 집계를 확인해 주세요.');summary.topics=s.topics.map((t:any)=>({name:txt(t.name,100),count:count(t.count,summary.rows)}));data.a.summary=summary;}
 data.revision=(previous?.revision||0)+1;data.updatedBy=actor;data.updatedAt=new Date().toISOString();return data;
}
// CSV 원본과 환자 식별자는 브라우저에서만 읽고 집계값만 반환합니다.
export function parseCsv(text:string):string[][]{const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw Error('CSV 따옴표 형식이 잘못됐습니다.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;}
export function summarizeEmr(text:string,sourceName:string,asOf:string,cutoffMonths=6):EmrSummary{
 if(!validDate(asOf)||!Number.isInteger(cutoffMonths)||cutoffMonths<1||cutoffMonths>120)throw Error('분석 기준일·미내원 개월을 확인해 주세요.');
 const rows=parseCsv(text.replace(/^\uFEFF/,''));if(rows.length<2)throw Error('EMR CSV에 분석할 행이 없습니다.');if(rows.length>100001)throw Error('한 파일은 10만 행까지 분석합니다.');
 const headers=rows.shift()!.map(s=>s.trim().replace(/\s/g,'').toLowerCase());
 const col=(aliases:string[])=>headers.findIndex(h=>aliases.includes(h));const idCol=col(['patientid','patient_id','환자번호','차트번호','고객번호']),dateCol=col(['lastvisit','last_visit','마지막내원일','최종내원일','진료일','내원일']);
 if(idCol<0||dateCol<0)throw Error('CSV에 환자번호(또는 차트번호), 최종내원일(또는 진료일) 열이 필요합니다.');
 const patients=new Map<string,string>(),uncertain=new Set<string>();let invalidDates=0,missingIds=0,futureDates=0;
 for(const r of rows){if(r.length!==headers.length)throw Error('CSV 열 개수가 맞지 않는 행이 있습니다.');const id=r[idCol]?.trim();if(!id){missingIds++;continue;}const raw=r[dateCol]?.trim().split(/[T ]/)[0]||'';const parts=raw.replace(/[./]/g,'-').split('-');const date=parts.length===3?parts.map((v,i)=>i?v.padStart(2,'0'):v).join('-'):raw;
 if(!validDate(date)){invalidDates++;uncertain.add(id);if(!patients.has(id))patients.set(id,'');continue;}if(date>asOf){futureDates++;uncertain.add(id);if(!patients.has(id))patients.set(id,'');continue;}if(!patients.get(id)||patients.get(id)!<date)patients.set(id,date);}
 const cutoff=new Date(asOf+'T00:00:00Z'),day=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-cutoffMonths);const end=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();cutoff.setUTCDate(Math.min(day,end));const limit=cutoff.toISOString().slice(0,10);
 return {asOf,sourceName,rows:rows.length,patients:patients.size,recall:[...patients.entries()].filter(([id,d])=>!uncertain.has(id)&&d&&d<=limit).length,invalidDates,missingIds,futureDates,cutoffMonths,topics:[]};
}
export function effects(a:PackageData['a']){if([a.visits,a.contribution,a.cost].some(v=>v===''))return null;const [v,p,c]=[a.visits,a.contribution,a.cost].map(Number);if(![v,p,c].every(Number.isFinite)||v<0||p<=0||c<0)return null;return {gross:v*p,net:v*p-c,breakEven:Math.ceil(c/p)};}
