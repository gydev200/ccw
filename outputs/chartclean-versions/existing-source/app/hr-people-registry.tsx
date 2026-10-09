'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {blankHrPerson,HR_EMPLOYMENT_TYPES,HR_EMPLOYEE_STATES,type HrPerson} from '@/lib/hr-person-model';
type Row={id:number;version:number;data:HrPerson;history?:any[]};
type Draft={data:HrPerson;id:number|null;version:number|null;savedAt?:string};
async function api(body?:any,id?:number){const r=await fetch('/api/hr-people'+(id?'?id='+id:''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const j:any=await r.json();if(!r.ok)throw Error(j.error||'직원 기록을 처리하지 못했습니다.');return j}
export default function HrPeopleRegistry(){
 const [rows,setRows]=useState<Row[]>([]),[form,setForm]=useState<Draft|null>(null),[draft,setDraft]=useState<Draft|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('전체'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const draftReady=useRef(false);
 async function load(){try{const j=await api();setRows(j.rows);setDraft(j.draft);setError('')}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(!form||!draftReady.current)return;const timer=setTimeout(()=>{api({action:'draft',draft:form}).then(()=>setNotice('작성 중인 직원 기록을 임시 저장했습니다.')).catch(e=>setError(e.message))},650);return()=>clearTimeout(timer)},[form]);
 function open(row?:Row){draftReady.current=false;setError('');setForm(row?{data:{...row.data},id:row.id,version:row.version}:{data:blankHrPerson(),id:null,version:null});queueMicrotask(()=>{draftReady.current=true});if(row)api(undefined,row.id).then(j=>setRows(old=>old.map(r=>r.id===row.id?j.row:r))).catch(e=>setError(e.message))}
 function resume(){if(!draft)return;draftReady.current=false;setForm(draft);queueMicrotask(()=>{draftReady.current=true})}
 function change<K extends keyof HrPerson>(key:K,value:HrPerson[K]){setForm(old=>old?{...old,data:{...old.data,[key]:value}}:old)}
 async function save(){if(!form||busy)return;setBusy(true);setError('');try{await api({action:form.id?'update':'create',id:form.id,version:form.version,data:form.data});await api({action:'clearDraft'});draftReady.current=false;setForm(null);setDraft(null);setNotice('직원 기록을 서버에 저장했습니다.');await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function discard(){draftReady.current=false;setForm(null);setDraft(null);try{await api({action:'clearDraft'});setNotice('임시 내용을 지웠습니다.')}catch(e:any){setError(e.message)}}
 const visible=rows.filter(r=>(filter==='전체'||r.data.state===filter)&&[r.data.employeeNo,r.data.name,r.data.department,r.data.job].join(' ').toLowerCase().includes(search.toLowerCase()));
 return <section className="cchr-person-registry" aria-label="직원 명부"><div className="cchr-operational-head"><div><h3>직원 명부</h3><p>사원번호, 소속, 직무, 계약기간과 재직 상태의 변경 이력을 관리합니다.</p></div><Button onClick={()=>open()}>직원 등록</Button></div>
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<output role="status">{notice}</output>}
  {draft&&!form&&<div className="cchr-draft"><span>작성 중인 직원 기록이 남아 있습니다.</span><Button variant="outline" onClick={resume}>이어서 작성</Button><Button variant="ghost" onClick={discard}>임시 내용 지우기</Button></div>}
  <div className="cchr-person-filters"><label>직원 검색<Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="사원번호·이름·소속·직무"/></label><label>재직 상태<select value={filter} onChange={e=>setFilter(e.target.value)}><option>전체</option>{HR_EMPLOYEE_STATES.map(s=><option key={s}>{s}</option>)}</select></label></div>
  {loading?<p role="status">직원 명부를 불러오는 중입니다.</p>:visible.length?<div className="cchr-task-list">{visible.map(r=><button key={r.id} onClick={()=>open(r)}><strong>{r.data.employeeNo} · {r.data.name}</strong><span>{r.data.department} · {r.data.job} · {r.data.state}</span></button>)}</div>:<p className="cchr-empty">{rows.length?'검색 조건에 맞는 직원이 없습니다.':'등록된 직원 기록이 없습니다.'}</p>}
  <p className="cchr-account-note">이 명부의 상태 변경은 웍스 계정 중지, 급여 지급, 보험 신고를 자동으로 실행하지 않습니다. 각 업무의 처리 결과를 별도로 확인합니다.</p>
  <Dialog open={!!form} onOpenChange={v=>{if(!v&&!busy){draftReady.current=false;setForm(null)}}}><DialogContent className="detail-dialog"><DialogHeader><DialogTitle>{form?.id?'직원 기록 수정':'직원 등록'}</DialogTitle><DialogDescription>입력 중인 내용은 서버에 임시 저장됩니다. 사원번호는 등록 후 바꿀 수 없습니다.</DialogDescription></DialogHeader>{form&&<div className="detail-body cchr-operation-form" data-dirty="true">{error&&<p role="alert" className="error">{error}</p>}
   <div className="cchr-form-pair"><label className="field">사원번호<Input disabled={!!form.id} maxLength={40} value={form.data.employeeNo} onChange={e=>change('employeeNo',e.target.value)}/></label><label className="field">이름<Input maxLength={80} value={form.data.name} onChange={e=>change('name',e.target.value)}/></label></div>
   <div className="cchr-form-pair"><label className="field">소속<Input maxLength={100} value={form.data.department} onChange={e=>change('department',e.target.value)}/></label><label className="field">직무<Input maxLength={120} value={form.data.job} onChange={e=>change('job',e.target.value)}/></label></div>
   <div className="cchr-form-pair"><label className="field">직급·보직<Input maxLength={100} value={form.data.position} onChange={e=>change('position',e.target.value)}/></label><label className="field">보고 대상<Input maxLength={100} value={form.data.manager} onChange={e=>change('manager',e.target.value)}/></label></div>
   <div className="cchr-form-pair"><label className="field">고용 형태<select value={form.data.employmentType} onChange={e=>change('employmentType',e.target.value as HrPerson['employmentType'])}>{HR_EMPLOYMENT_TYPES.map(s=><option key={s}>{s}</option>)}</select></label><label className="field">재직 상태<select value={form.data.state} onChange={e=>change('state',e.target.value as HrPerson['state'])}>{HR_EMPLOYEE_STATES.map(s=><option key={s}>{s}</option>)}</select></label></div>
   <div className="cchr-form-pair"><label className="field">입사일<Input type="date" value={form.data.hireDate} onChange={e=>change('hireDate',e.target.value)}/></label><label className="field">계약 종료일<Input type="date" value={form.data.contractEnd} onChange={e=>change('contractEnd',e.target.value)}/></label></div>
   <div className="cchr-form-pair"><label className="field">상태 적용일<Input type="date" value={form.data.stateDate} onChange={e=>change('stateDate',e.target.value)}/></label><label className="field">근무 장소<Input maxLength={120} value={form.data.workLocation} onChange={e=>change('workLocation',e.target.value)}/></label></div>
   <label className="field">비용 부문<Input maxLength={80} value={form.data.costCenter} onChange={e=>change('costCenter',e.target.value)}/></label>
   <label className="field">인사 메모<Textarea maxLength={2000} value={form.data.note} onChange={e=>change('note',e.target.value)}/></label>
   <label className="field">변경 근거<Textarea maxLength={2000} value={form.data.evidence} onChange={e=>change('evidence',e.target.value)}/></label>
   {form.id&&<details><summary>변경 이력 {rows.find(r=>r.id===form.id)?.history?.length||0}건</summary>{[...(rows.find(r=>r.id===form.id)?.history||[])].reverse().map((h:any,i:number)=><p key={i}>{new Date(h.at).toLocaleString('ko-KR')} · {h.action} · {h.actor}</p>)}</details>}
   <div className="actions"><Button disabled={busy} onClick={save}>서버에 저장</Button><Button variant="outline" disabled={busy} onClick={()=>{draftReady.current=false;setForm(null)}}>닫기</Button></div>
  </div>}</DialogContent></Dialog>
 </section>
}
