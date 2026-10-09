'use client';
import {useState} from 'react';
import {collectionRows,unallocatedReceipts} from '../lib/collection-status';
import UnallocatedReceipts from './unallocated-receipts';
import type {Wallet} from '../lib/settlement';
export default function CollectionBoard({hospitals,onOpen}:{hospitals:{id:number;name:string;wallet:Wallet}[];onOpen:(id:number)=>void}){
 const [filter,setFilter]=useState('all');
 const rows=collectionRows(hospitals,new Date(Date.now()+9*3600000).toISOString().slice(0,10));
 const shown=rows.filter(r=>filter==='all'||filter==='late'&&r.followupLate||r.status.kind===filter);
 return <section aria-label="전체 병원 수금 관리"><h3>수금·미수 관리</h3><p>전체 기간의 남은 청구 잔액입니다. 조회 월을 바꿔도 이전 미수는 빠지지 않습니다.</p><div className="settlement-toolbar">{[['all','전체 미수'],['overdue','연체'],['unknown','수금일 미확인'],['today','오늘 수금'],['late','후속 연락 지연']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} {rows.filter(r=>key==='all'||key==='late'&&r.followupLate||r.status.kind===key).length}</button>)}</div><p><strong>등록 원장 미수 합계 {rows.reduce((n,r)=>n+r.due,0).toLocaleString('ko-KR')}원</strong></p><div className="settlement-ledger"><table><thead><tr><th>병원·청구번호</th><th>미수 잔액</th><th>약정일·상태</th><th>담당·다음 행동</th></tr></thead><tbody>{shown.map(r=><tr key={r.hospitalId+':'+r.invoiceId}><td><button className="settlement-link" onClick={()=>onOpen(r.hospitalId)}>{r.hospital}</button><small>{r.ref}</small></td><td>{r.due.toLocaleString('ko-KR')}원</td><td><strong className={'receivable-'+r.status.kind}>{r.status.label}</strong><small>{r.dueDate||'확인 필요'}</small></td><td>{r.plan?<>{r.plan.owner}<small>{r.plan.nextContact} · {r.plan.nextAction}</small>{r.followupLate&&<strong className="receivable-overdue">후속 확인 기한 경과</strong>}</>:<strong className="receivable-unknown">담당·후속 행동 미등록</strong>}</td></tr>)}</tbody></table></div>{!shown.length&&<p>이 조건에 해당하는 등록 청구가 없습니다.</p>}<UnallocatedReceipts rows={unallocatedReceipts(hospitals)} onOpen={onOpen}/><p className="settlement-help">미등록 청구나 미대조 입금은 이 합계에 반영되지 않습니다. 병원을 눌러 수금계획을 확인·보완해 주세요.</p></section>;
}
