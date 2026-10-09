import {HR_WORK} from './hr-department';

export const HR_OPERATION_STATUSES=['준비','진행 중','확인 대기','보류','완료'] as const;
export type HrOperationStatus=typeof HR_OPERATION_STATUSES[number];
export type HrOperation={section:string;title:string;subject:string;period:string;due:string;status:HrOperationStatus;owner:string;action:string;evidence:string;sourceUrl:string;decision:string;nextAction:string;confidential:boolean};
export const HR_SECTION_IDS=HR_WORK.map(x=>x.id);
const text=(value:unknown,max:number,label:string)=>{if(typeof value!=='string'||value.length>max)throw Error(`${label}을 확인해 주세요.`);return value.trim()};
const date=(value:unknown,label:string)=>{const v=text(value,10,label);if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error(`${label}을 확인해 주세요.`);if(v&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`${label}을 확인해 주세요.`);return v};
export function validateHrOperation(raw:any):HrOperation{
 if(!raw||typeof raw!=='object'||!HR_SECTION_IDS.includes(raw.section))throw Error('인사 업무 분야를 확인해 주세요.');
 const status=raw.status;
 if(!HR_OPERATION_STATUSES.includes(status))throw Error('진행 상태를 확인해 주세요.');
 const data={section:raw.section,title:text(raw.title,200,'업무명'),subject:text(raw.subject||'',120,'대상'),period:text(raw.period||'',80,'처리 회차'),due:date(raw.due||'','기한'),status,owner:'김기영 주임',action:text(raw.action||'',4000,'처리 내용'),evidence:text(raw.evidence||'',4000,'확인 근거'),sourceUrl:text(raw.sourceUrl||'',2000,'원본 주소'),decision:text(raw.decision||'',3000,'결정 내용'),nextAction:text(raw.nextAction||'',2000,'다음 행동'),confidential:raw.confidential===true};
 if(!data.title)throw Error('업무명을 입력해 주세요.');
 if(data.sourceUrl){let u:URL;try{u=new URL(data.sourceUrl)}catch{throw Error('원본 주소를 확인해 주세요.')}if(!['https:','http:'].includes(u.protocol))throw Error('원본 주소를 확인해 주세요.');}
 if(status==='완료'&&!data.evidence&&!data.sourceUrl)throw Error('완료한 근거 또는 원본 주소를 입력해 주세요.');
 if(status==='보류'&&!data.nextAction)throw Error('보류 사유와 다음 행동을 입력해 주세요.');
 if(['compensation','documents','lifecycle','advisors'].includes(data.section)&&status==='완료'&&!data.decision)throw Error('결정 내용을 확인한 뒤 완료해 주세요.');
 return data;
}
export function blankHrOperation(section:string):HrOperation{return {section,title:'',subject:'',period:'',due:'',status:'준비',owner:'김기영 주임',action:'',evidence:'',sourceUrl:'',decision:'',nextAction:'',confidential:['people','documents','gig','labor','logs','aiusage','reviews','compensation','lifecycle','relations','sources'].includes(section)}}
