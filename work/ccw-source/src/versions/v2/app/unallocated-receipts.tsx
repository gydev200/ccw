import type {unallocatedReceipts} from '@/versions/v2/lib/collection-status';
type Row=ReturnType<typeof unallocatedReceipts>[number];
export default function UnallocatedReceipts({rows,onOpen}:{rows:Row[];onOpen?:(id:number)=>void}){
 const list=(items:Row[])=><ul>{items.map(r=><li key={`${r.hospitalId}:${r.receiptId}`}><strong>{onOpen?<button type="button" className="settlement-link" onClick={()=>onOpen(r.hospitalId)}>{r.hospital}</button>:r.hospital} · {r.amount.toLocaleString('ko-KR')}원</strong><small style={{display:'block',overflowWrap:'anywhere'}}>입금일 {r.date} · {r.ref||'입금번호 미등록'}</small></li>)}</ul>;
 return <section aria-label="청구 미연결 입금"><h3>청구 미연결 입금 · {rows.length}건</h3>{rows.length?<><p><strong>{rows.reduce((n,r)=>n+r.amount,0).toLocaleString('ko-KR')}원</strong> · 수금 연락 전 청구서와 먼저 대조해 주세요.</p>{list(rows.slice(0,3))}{rows.length>3&&<details><summary>나머지 {rows.length-3}건 보기</summary>{list(rows.slice(3))}</details>}</>:<p>등록된 입금 중 청구서에 연결하지 않은 잔액이 없습니다.</p>}<p className="settlement-help">미수에서 자동 차감하지 않습니다. 병원별 원장에서 입금 증빙과 청구서를 확인해 연결합니다. 은행 입금내역을 자동 조회한 결과는 아닙니다.</p></section>;
}
