'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
export default function SSServiceLive({slug,owner,onTask,onReload}:any){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[creating,setCreating]=useState(false);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setLoading(true);fetch('/api/ss-service?hospital='+slug,{signal:controller.signal,cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error||'기록 연결 실패');return d}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[slug,refresh]);
 async function daily(){setCreating(true);setError('');try{const r=await fetch('/api/ss-service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hospital:slug})});const d:any=await r.json();if(!r.ok)throw Error(d.error);await onReload();onTask(d.id)}catch(e:any){setError(e.message)}finally{setCreating(false)}}
 return <section className="panel" aria-label="실제 발송 기록"><div className="section-heading"><h3>실제 발송 기록</h3><Button variant="outline" disabled={loading} onClick={()=>setRefresh(v=>v+1)}>{loading?'불러오는 중…':'기록 새로고침'}</Button></div>
 <p>하루 목표 <b>30명</b> · 목표와 실제 발송 기록은 구분합니다.</p>
 {error&&<p role="alert">{error}</p>}
 {data&&<><small>확인 시각 {new Date(data.checkedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</small><p className="muted">묶음별 저장 기록입니다. ‘발송 기록’은 제공사 전달 성공 확인과 다르며, 묶음 이름의 날짜를 오늘 실적으로 계산하지 않습니다. 대기 숫자는 발송 가능 인원이 아닙니다.</p><details><summary>이전 발송 묶음별 기록 보기</summary><div style={{overflowX:'auto'}}><table><thead><tr><th>발송 묶음</th><th>등록</th><th>발송 기록</th><th>대기</th><th>제외</th><th>실패</th></tr></thead><tbody>{data.batches.map((b:any)=><tr key={b.id}><td>{b.label}{b.trial&&<small> · 시험/준비 기록</small>}</td><td>{b.people}</td><td>{b.sent}</td><td>{b.pending}</td><td>{b.excluded}</td><td>{b.failed}</td></tr>)}</tbody></table></div></details>{!data.batches.length&&<p>등록된 발송 묶음이 없습니다.</p>}</>}
 <div className="actions">{owner&&<Button disabled={creating} onClick={daily}>{creating?'업무 확인 중…':'오늘 서비스 업무 열기'}</Button>}<a className="link-button" href={'https://app-chenggyo.vercel.app/chaenggyeo/'+slug+'/staff'} target="_blank" rel="noreferrer">기존 발송·반응 화면 열기 ↗</a></div><p className="muted">오늘 업무는 병원별로 한 번만 등록되고 다시 누르면 이어집니다. 기존 발송 화면은 별도 로그인되며, 이 버튼으로 문자가 발송되지는 않습니다.</p></section>
}
