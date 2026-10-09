export const HR_EMPLOYMENT_TYPES=['정규직','기간제','단시간','기타'] as const;
export const HR_EMPLOYEE_STATES=['입사 예정','재직','휴직','퇴사'] as const;
export type HrPerson={employeeNo:string;name:string;department:string;job:string;position:string;manager:string;employmentType:typeof HR_EMPLOYMENT_TYPES[number];state:typeof HR_EMPLOYEE_STATES[number];hireDate:string;contractEnd:string;stateDate:string;workLocation:string;costCenter:string;note:string;evidence:string};
const str=(v:any,label:string,max:number,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(label+'을 확인해 주세요.');return v.trim()};
const day=(v:any,label:string)=>{const t=str(v,label,10);if(t&&(!/^\d{4}-\d{2}-\d{2}$/.test(t)||!Number.isFinite(Date.parse(t+'T00:00:00Z'))||new Date(t+'T00:00:00Z').toISOString().slice(0,10)!==t))throw Error(label+'을 확인해 주세요.');return t};
export function validateHrPerson(raw:any):HrPerson{
 if(!raw||typeof raw!=='object')throw Error('직원 정보를 확인해 주세요.');
 const employeeNo=str(raw.employeeNo,'사원번호',40,true);
 if(!/^[A-Za-z0-9_-]{2,40}$/.test(employeeNo))throw Error('사원번호는 영문·숫자·밑줄·붙임표로 입력해 주세요.');
 if(!HR_EMPLOYMENT_TYPES.includes(raw.employmentType))throw Error('고용 형태를 확인해 주세요.');
 if(!HR_EMPLOYEE_STATES.includes(raw.state))throw Error('재직 상태를 확인해 주세요.');
 const p={employeeNo,name:str(raw.name,'이름',80,true),department:str(raw.department,'소속',100,true),job:str(raw.job,'직무',120,true),position:str(raw.position||'','직급·보직',100),manager:str(raw.manager||'','보고 대상',100),employmentType:raw.employmentType,state:raw.state,hireDate:day(raw.hireDate,'입사일'),contractEnd:day(raw.contractEnd||'','계약 종료일'),stateDate:day(raw.stateDate||'','상태 적용일'),workLocation:str(raw.workLocation||'','근무 장소',120),costCenter:str(raw.costCenter||'','비용 부문',80),note:str(raw.note||'','인사 메모',2000),evidence:str(raw.evidence||'','확인 근거',2000)};
 if(p.state==='재직'&&!p.hireDate)throw Error('재직자의 입사일을 입력해 주세요.');
 if(p.state==='퇴사'&&(!p.stateDate||!p.evidence))throw Error('퇴사 적용일과 확인 근거를 입력해 주세요.');
 if(p.contractEnd&&p.hireDate&&p.contractEnd<p.hireDate)throw Error('계약 종료일은 입사일 이후여야 합니다.');
 return p;
}
export function blankHrPerson():HrPerson{return {employeeNo:'',name:'',department:'',job:'',position:'',manager:'',employmentType:'정규직',state:'입사 예정',hireDate:'',contractEnd:'',stateDate:'',workLocation:'',costCenter:'',note:'',evidence:''}}
