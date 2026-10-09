'use client';
import {useState} from 'react';
import {Button} from '@/versions/v2/components/ui/button';
import {Input} from '@/versions/v2/components/ui/input';
import {hrManagerAllowed} from '@/versions/v2/lib/dss-navigation';
import HrDepartmentWork from './hr-department-work';
import './dss-management.css';

export default function DmOperations({view,rows,workers,issueId,member,canEdit,onEdit}:{view:string;rows:any[];workers:any[];issueId:number;member:any;canEdit:boolean;onEdit:(record?:any,extra?:any)=>void}){
 const [date,setDate]=useState('');
 const shifts=rows.filter(r=>r.kind==='shift'&&r.data.issueId===issueId).sort((a,b)=>(a.data.date+' '+(a.data.startTime||'')).localeCompare(b.data.date+' '+(b.data.startTime||'')));
 const assigned=[...new Set<string>(rows.filter(r=>r.kind==='shift').map(r=>r.data.worker))];
 const label=(person:string)=>workers.find(w=>w.person===person)?.label||person;
 const delivered=(id:number)=>rows.filter(r=>r.kind==='delivery'&&String(r.data.shiftId)===String(id)&&r.data.status==='전달').reduce((n,r)=>n+r.data.quantity,0);
 if(view==='인력 관리 (긱)')return <section className="dm-operations" aria-label="DM 인력 관리">
  <div className="or-section"><h3>배송 배정 인력</h3><Button variant="outline" disabled={!canEdit||!issueId} onClick={()=>onEdit()}>인력·일정 배정</Button></div>
  <p className="or-meta">배송에 배정된 인력만 표시합니다. 직원·긱 구분은 배정 기록에 입력한 값을 사용합니다.</p>
  <div className="dm-table-scroll"><table><thead><tr><th>담당자</th><th>인력 구분</th><th>이번 호 일정</th><th>담당 건물군</th><th>이번 호 전달</th><th>관리</th></tr></thead><tbody>{assigned.map(person=>{const current=shifts.filter(r=>r.data.worker===person),latest=rows.find(r=>r.kind==='shift'&&r.data.worker===person);return <tr key={person}><th>{label(person)}</th><td>{latest?.data.workerType||'구분 미등록'}</td><td>{current.length}건</td><td>{[...new Set(current.map(r=>r.data.clusters).filter(Boolean))].join(' / ')||'배정 전'}</td><td>{current.reduce((n,r)=>n+delivered(r.id),0)}부</td><td><Button variant="outline" disabled={!canEdit||!issueId||(member.role!=='DO'&&person!==member.person)} onClick={()=>onEdit(undefined,{worker:person,workerType:latest?.data.workerType||''})}>일정 추가</Button></td></tr>})}</tbody></table></div>
  {!assigned.length&&<p className="or-empty">배송 인력 배정이 없습니다. 소식지 회차를 선택하고 인력·일정을 배정해 주세요.</p>}
  {hrManagerAllowed(member)&&<section className="dm-gig-ledger"><h3>긱워커 계약·정산 · 인사 연동</h3><p className="or-meta">기존 인사 원장의 같은 기록입니다. 대상 이름·작업 회차·단가·계약·정산 근거를 남기며, 기록 저장으로 계약 서명이나 지급이 실행되지는 않습니다.</p><HrDepartmentWork section="gig" member={member}/></section>}
 </section>;
 const visible=shifts.filter(r=>!date||r.data.date===date);
 return <section className="dm-operations" aria-label="DM 배송 일정">
  <div className="or-section"><h3>배송 일정</h3><Button variant="outline" disabled={!canEdit||!issueId} onClick={()=>onEdit(undefined,date?{date}:{})}>배송 일정 등록</Button></div>
  <div className="or-toolbar"><label htmlFor="dm-schedule-date">작업일</label><Input id="dm-schedule-date" aria-label="배송 일정 작업일" type="date" value={date} onChange={e=>setDate(e.target.value)}/>{date&&<Button variant="outline" onClick={()=>setDate('')}>전체 일정</Button>}<span>{visible.length}건 · 예정 {visible.filter(r=>r.data.status==='예정').length} · 근무 중 {visible.filter(r=>r.data.status==='근무 중').length} · 종료 {visible.filter(r=>r.data.status==='종료').length}</span></div>
  <div className="dm-table-scroll"><table><thead><tr><th>작업일·시간</th><th>담당자·구분</th><th>건물군·이동</th><th>진행</th><th>인계 / 전달 / 반납</th><th>관리</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><th>{r.data.date}<small>{r.data.startTime&&r.data.endTime?r.data.startTime+'–'+r.data.endTime:'시간 미등록'}</small></th><td>{label(r.data.worker)}<small>{r.data.workerType||'구분 미등록'}</small></td><td>{r.data.clusters||'건물군 미배정'}<small>{r.data.mode}</small></td><td>{r.data.status}</td><td>{r.data.quantity} / {delivered(r.id)} / {r.data.returned||0}부</td><td><Button variant="outline" disabled={!canEdit||(member.role!=='DO'&&r.data.worker!==member.person)} onClick={()=>onEdit(r)}>일정·배정 수정</Button></td></tr>)}</tbody></table></div>
  {!visible.length&&<p className="or-empty">{date?'선택한 작업일에 배송 일정이 없습니다.':'선택한 소식지의 배송 일정이 없습니다.'}</p>}
  <p className="or-meta">일정과 물량은 기존 배송 배정 기록에 저장됩니다. 등록된 담당자에게만 배정할 수 있으며, 다른 인력의 배정은 대표 계정에서 처리합니다.</p>
 </section>;
}
