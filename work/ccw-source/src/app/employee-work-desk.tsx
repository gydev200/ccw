'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {STAFF} from '@/lib/work-orders';
import {OrderDetail} from './work-orders-panel';
import './employee-work-desk.css';
export default function EmployeeWorkDesk({data,person,date,setDate,busy,act,member,notice,error,onBack}:any){
 const [selected,setSelected]=useState<number|null>(null);
 const personSpec=STAFF.find(p=>p.person===person),all=data.orders.filter((r:any)=>r.assignee===person),orders=all.filter((r:any)=>!date||r.data.date===date),current=orders.find((r:any)=>r.id===selected)||orders.find((r:any)=>r.data.status!=='완료')||orders[0];
 const complete=orders.filter((r:any)=>r.data.status==='완료').length,waiting=orders.filter((r:any)=>r.data.status==='상사 확인 대기').length;
 const latestAnswer=current?.data.questions?.filter((q:any)=>q.answer).at(-1);
 const greeting=current?(latestAnswer?latestAnswer.answer:current.data.status==='완료'?'결과 확인까지 마쳤습니다. 다음 업무로 넘어가 볼까요?':current.data.status==='상사 확인 대기'?'결과가 도착했습니다. 확인 의견이 등록되면 이 업무에서 볼 수 있어요.':current.data.status==='조율 필요'?'막힌 내용을 먼저 남겨 주세요. 무엇을 시도했고 어떤 도움이 필요한지 함께 적어 주시면 좋습니다.':`먼저 ‘${current.data.title}’부터 살펴볼까요? 완료 기준을 확인하고 시작해 주세요.`):'선택한 날짜에는 배정된 업무가 없습니다. 다른 날짜의 업무도 확인할 수 있어요.';
 function choose(id:number){if(document.querySelector('[data-dirty="true"]')&&!window.confirm('저장하지 않은 입력이 있습니다. 다른 업무로 이동하시겠습니까?'))return;setSelected(id)}
 function download(){const body=`${personSpec?.name} 업무일지 · ${date||'전체 날짜'}\n\n`+orders.map((r:any)=>`${r.data.title}\n상태: ${r.data.status}\n결과: ${r.data.result||'미제출'}\n근거: ${r.data.evidence||'-'}\n막힌 일: ${r.data.blocker||'-'}\n다음 행동: ${r.data.next||'-'}\n실제 작업: ${r.data.minutes||0}분`).join('\n\n');const url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${personSpec?.name}_업무일지_${date||'전체'}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="wo employee-desk">
 <header className="desk-nav"><strong>{personSpec?.name}님의 업무</strong><nav>{onBack&&<Button variant="outline" onClick={onBack}>배상무 조율 화면</Button>}{[['DM','/#d','배포 관리'],['OS','/#b','병원 연락'],['OS','/#a','EMR·체험'],['SS','/#ccall','C콜'],['PM','/#ppm','기획실']].filter(([org])=>member?.role==='DO'||member?.access?.orgs?.includes(org)).map(([org,url,label])=><a key={url} href={url}>{label}</a>)}<a href="/my">내 업무일지</a><a href="/password">비밀번호 변경</a>{!data.isDO&&<Button variant="outline" onClick={async()=>{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.assign('/login?next=/employee')}}>로그아웃</Button>}</nav></header>
 {data.isDO&&<p className="desk-manager-note">직원 화면 구성 보기 · 현재는 DO 계정입니다. 직원 대신 결과를 제출하지 않으며, 오른쪽에서 지시와 답변을 관리할 수 있습니다.</p>}
 <div className="desk-intro"><img src={'/mentors/'+personSpec?.mentorId+'.png'} alt={'담당 AI 상사 '+personSpec?.supervisor}/><div><h1>{personSpec?.name}님,<br/>한 가지씩 같이 해볼까요?</h1><p className="desk-mentor">담당 AI 상사 · {personSpec?.supervisor}</p><p className="desk-speech">{greeting}</p><span className="desk-speech-source">{latestAnswer?latestAnswer.answerSource:'업무 상태에 따른 안내'} · 업무 조율: 배상무</span></div></div>
 {error&&<p className="wo-error" role="alert">{error}</p>}{notice&&<p className="wo-notice" role="status">{notice}</p>}
 <div className="desk-toolbar"><label>업무일<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><Button variant="outline" onClick={()=>setDate('')}>모든 날짜</Button><Button variant="outline" onClick={download}>업무일지 받기</Button></div>
 <div className="desk-progress"><span>상사 확인 완료 {complete} / {orders.length}건</span><span>결과 확인 대기 {waiting}건</span><progress aria-label="상사 확인 완료 업무" value={complete} max={orders.length||1}/></div>
 <div className="desk-body"><section className="desk-tasks" aria-label="내 업무 목록"><h2>오늘의 할 일</h2>{orders.length===0&&<p>배정된 업무가 없습니다. 모든 날짜를 눌러 이전 지시를 확인해 주세요.</p>}{orders.map((r:any,i:number)=><button key={r.id} className={'desk-task '+(r.id===current?.id?'active':'')} aria-pressed={r.id===current?.id} onClick={()=>choose(r.id)}><span className="desk-step">{r.data.status==='완료'?'✓':i+1}</span><span><strong>{r.data.title}</strong><span>{r.data.status} · {r.data.due.replace('T',' ')}{r.data.deadlineProposed?' (마감 조율안)':''}</span></span></button>)}</section><section className="desk-work" aria-label="선택한 업무">{current?<OrderDetail key={current.id+':'+current.version} order={current} isDO={data.isDO} busy={busy} act={act} member={member}/>:<p>배상무가 업무를 배정하면 이곳에 지시와 완료 기준이 표시됩니다.</p>}</section></div>
 </section>
}
