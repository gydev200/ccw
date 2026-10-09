'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {HR_OWNER,hrWork,type HrWorkId} from '@/lib/hr-department';
import {blankHrOperation,HR_OPERATION_STATUSES,type HrOperation} from '@/lib/hr-operation-model';

type Row={id:number;version:number;data:HrOperation;history:any[];updated_at:string};
type Draft={data:HrOperation;id:number|null;version:number|null;requestId:string;savedAt?:string};
async function api(section:string,body?:any,before?:number){const url='/api/hr-operations?section='+encodeURIComponent(section)+(before?'&before='+before:'');const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data:any=await r.json();if(!r.ok)throw Error(data.error||'인사 기록을 처리하지 못했습니다.');return data}
export default function HrDepartmentWork({section,member}:{section:HrWorkId;member:any}){
 const work=hrWork(section),[rows,setRows]=useState<Row[]>([]),[summary,setSummary]=useState({total:0,done:0,pending:0}),[nextCursor,setNextCursor]=useState<number|null>(null),[savedDraft,setSavedDraft]=useState<Draft|null>(null),[form,setForm]=useState<Draft|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[filter,setFilter]=useState('전체');
 const version=useRef(0),draftReady=useRef(false);
 const load=useCallback(async(before?:number)=>{const sequence=++version.current;try{const result=await api(section,undefined,before);if(sequence!==version.current)return;if(before)setRows(old=>[...old,...result.rows]);else{setRows(result.rows);setSavedDraft(result.draft)}setSummary(result.summary);setNextCursor(result.nextCursor);setError('')}catch(e:any){if(sequence===version.current)setError(e.message)}finally{if(sequence===version.current)setLoading(false)}},[section]);
 useEffect(()=>{setRows([]);setForm(null);setSavedDraft(null);setLoading(true);void load();return()=>{version.current++}},[load]);
 useEffect(()=>{if(!form||!draftReady.current)return;const timer=setTimeout(()=>{api(section,{action:'draft',section,draft:form}).then(r=>setNotice('작성 중인 내용을 서버에 임시 저장했습니다.')).catch(e=>setError(e.message))},650);return()=>clearTimeout(timer)},[section,form]);
 if(!work)return null;
 const selected=work;
 function start(row?:Row){draftReady.current=false;setError('');setNotice('');const draft:Draft=row?{data:{...row.data},id:row.id,version:row.version,requestId:crypto.randomUUID()}:{data:{...blankHrOperation(section),title:selected.name},id:null,version:null,requestId:crypto.randomUUID()};setForm(draft);queueMicrotask(()=>{draftReady.current=true})}
 function resume(){if(!savedDraft)return;draftReady.current=false;setForm(savedDraft);queueMicrotask(()=>{draftReady.current=true})}
 function change<K extends keyof HrOperation>(key:K,value:HrOperation[K]){setForm(old=>old?{...old,data:{...old.data,[key]:value}}:old)}
 async function save(){if(!form||busy)return;setBusy(true);setError('');try{await api(section,{action:form.id?'update':'create',id:form.id,version:form.version,requestId:form.requestId,data:form.data});await api(section,{action:'clearDraft',section});draftReady.current=false;setForm(null);setSavedDraft(null);setNotice('인사 기록을 서버에 저장했습니다.');await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function discard(){if(busy)return;draftReady.current=false;setForm(null);setSavedDraft(null);try{await api(section,{action:'clearDraft',section});setNotice('작성 중인 내용을 지웠습니다.')}catch(e:any){setError(e.message)}}
 const visible=rows.filter(r=>filter==='전체'||r.data.status===filter);
 return <section className="cchr-operational" aria-label={selected.name+' 관리'}>
  <div className="cchr-operational-head"><div><b>인사 실무 담당 {HR_OWNER}</b><p>건별 대상·기한·처리 내용·확인 근거·변경 이력을 저장합니다.</p></div><Button onClick={()=>start()}>새 기록</Button></div>
  <p className="cchr-record-rule">남길 기록: {selected.evidence}</p>
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<output role="status">{notice}</output>}
  {savedDraft&&!form&&<div className="cchr-draft"><span>작성 중인 내용이 남아 있습니다.{savedDraft.savedAt?' · '+new Date(savedDraft.savedAt).toLocaleString('ko-KR'):''}</span><Button variant="outline" onClick={resume}>이어서 작성</Button><Button variant="ghost" onClick={discard}>임시 내용 지우기</Button></div>}
  <div className="cchr-operational-summary"><strong>전체 {summary.total}건</strong><span>확인 대기 {summary.pending}건</span><span>완료 {summary.done}건</span><label>상태 <select value={filter} onChange={e=>setFilter(e.target.value)}><option>전체</option>{HR_OPERATION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label></div>
  {loading?<p role="status">기록을 불러오는 중입니다.</p>:visible.length?<div className="cchr-task-list">{visible.map(r=><button key={r.id} onClick={()=>start(r)}><strong>#{r.id} {r.data.title}</strong><span>{r.data.subject||'공통'} · {r.data.status} · {r.data.due||'기한 미지정'}</span></button>)}</div>:<p className="cchr-empty">{filter==='전체'?'등록된 기록이 없습니다.':'이 상태의 기록이 없습니다.'}</p>}
  {nextCursor&&<Button variant="outline" onClick={()=>void load(nextCursor)}>기록 더 보기</Button>}
  <p className="cchr-account-note">{member?.person==='kimkiyoung'?'김기영 주임의 인사 담당 권한으로 기록합니다.':'김기영 주임의 웍스 계정 연결 전에는 대표 계정에서 기록합니다.'} 계약 서명, 급여 지급, 외부 게시와 통지는 기록 저장만으로 실행되지 않습니다.</p>
  <Dialog open={!!form} onOpenChange={v=>{if(!v&&!busy){draftReady.current=false;setForm(null)}}}><DialogContent className="detail-dialog"><DialogHeader><DialogTitle>{form?.id?'인사 기록 수정':'인사 기록 등록'}</DialogTitle><DialogDescription>{selected.name} · 입력 중인 내용은 서버에 임시 저장됩니다.</DialogDescription></DialogHeader>{form&&<div className="detail-body cchr-operation-form" data-dirty="true">
   {error&&<p role="alert" className="error">{error}</p>}
   <label className="field">업무명<Input maxLength={200} value={form.data.title} onChange={e=>change('title',e.target.value)}/></label>
   <label className="field">대상·직원·위원<Input maxLength={120} value={form.data.subject} onChange={e=>change('subject',e.target.value)}/></label>
   <div className="cchr-form-pair"><label className="field">처리 회차<Input maxLength={80} value={form.data.period} onChange={e=>change('period',e.target.value)} placeholder="예: 2026년 4분기"/></label><label className="field">기한<Input type="date" value={form.data.due} onChange={e=>change('due',e.target.value)}/></label></div>
   <label className="field">진행 상태<select value={form.data.status} onChange={e=>change('status',e.target.value as HrOperation['status'])}>{HR_OPERATION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="field">처리 내용<Textarea maxLength={4000} value={form.data.action} onChange={e=>change('action',e.target.value)}/></label>
   <label className="field">확인 근거<Textarea maxLength={4000} value={form.data.evidence} onChange={e=>change('evidence',e.target.value)}/></label>
   <label className="field">원본 주소<Input type="url" maxLength={2000} value={form.data.sourceUrl} onChange={e=>change('sourceUrl',e.target.value)}/></label>
   <label className="field">결정·승인 내용<Textarea maxLength={3000} value={form.data.decision} onChange={e=>change('decision',e.target.value)}/></label>
   <label className="field">다음 행동<Textarea maxLength={2000} value={form.data.nextAction} onChange={e=>change('nextAction',e.target.value)}/></label>
   <label><input type="checkbox" checked={form.data.confidential} onChange={e=>change('confidential',e.target.checked)}/> 인사 비밀 기록</label>
   {form.id&&<details><summary>변경 이력 {rows.find(r=>r.id===form.id)?.history.length||0}건</summary>{[...(rows.find(r=>r.id===form.id)?.history||[])].reverse().map((h:any,i:number)=><p key={i}>{new Date(h.at).toLocaleString('ko-KR')} · {h.action} · {h.actor}</p>)}</details>}
   <div className="actions"><Button disabled={busy} onClick={save}>서버에 저장</Button><Button variant="outline" disabled={busy} onClick={()=>{draftReady.current=false;setForm(null)}}>닫기</Button></div>
  </div>}</DialogContent></Dialog>
 </section>
}
