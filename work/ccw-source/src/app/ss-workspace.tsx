'use client';
import ServiceCenter from './ss-service-center';
import ContentCatalog from './ss-content-catalog';
import {useState} from 'react';
import CAWorkspace from './ca-workspace';
import HospitalRollout from './hospital-rollout';
import HospitalBrief from './hospital-brief';
import SSServiceLive from './ss-service-live';
import ServiceReviewPanel from './service-review-panel';
import SSRemoteAccess from './ss-remote-access';
import SSSetupJourney from './ss-setup-journey';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';

const REPORTED=[
 {name:'플로체',aliases:['플로체','플로츠'],emrStatus:'EMR 일부 확보 · 소팅·발송 조건 재확인 필요',nextAction:'장기 미내원 대상 소팅과 발송 중단 원인 확인',dailyGoal:'30',sourceUrl:''},
 {name:'플랜미',aliases:['플랜미'],emrStatus:'EMR 일부 확보 · 소팅·발송 조건 재확인 필요',nextAction:'대상 소팅과 발송 중단 원인 확인',dailyGoal:'30',sourceUrl:''},
 {name:'연세리셀',aliases:['연세리셀','연세 리셀'],emrStatus:'수령 EMR에 문제 · 예약 연동 세팅 필요',nextAction:'예약 자료 연동 확인 및 환자 맞춤 예약 안내 연결',dailyGoal:'',sourceUrl:'https://yonsei-recell-guide.happyshs747.chatgpt.site/'},
 {name:'레아산부인과',aliases:['레아','레하'],emrStatus:'EMR 미수령',nextAction:'EMR 수령 방법·담당·다음 일정 확인',dailyGoal:'',sourceUrl:''},
];
const fields=[['emrStatus','EMR 수령·연동 현황'],['tone','문구 톤앤매너'],['frequency','안내 횟수·발송 시점'],['intensity','프로그램 강도·적용 기준'],['dailyGoal','하루 목표 인원'],['nextAction','다음 행동'],['sourceUrl','환자 시연·업무 링크']] as const;
export default function SSWorkspace({section,state,onNewTask,onTask,onSave,onReload,focus,onNavigate}:any){
 const [mode,setMode]=useState(focus?.mode||'BA'),[search,setSearch]=useState(''),[chosen,setChosen]=useState(focus?.clinic||''),[draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewDirty,setReviewDirty]=useState(false);
 const [productionFocus,setProductionFocus]=useState(false);
 const owner=state.member.role==='DO';const records=state.records.filter((r:any)=>r.kind==='customer');
 const known=REPORTED.map(p=>{const record=records.find((r:any)=>p.aliases.some(a=>r.data.name.includes(a)));return {key:record?String(record.id):p.name,record,data:{...p,org:'SS',assignee:'do',stage:'계약·계약금 수령',service:'',serviceStatus:'확인 필요',tone:'',frequency:'',intensity:'',notes:'2026-09-14 대표님 전달 현황',...record?.data}}}).filter(p=>owner||p.record);
 const hospitals=[...known,...records.filter((r:any)=>!known.some(p=>p.record?.id===r.id)).map((record:any)=>({key:String(record.id),record,data:record.data}))];
 const contracted=(p:any)=>p.data.name==='테스트 병원'?section==='세팅':known.some(k=>k.key===p.key)||(!/계약 전|미계약|계약 예정/.test(p.data.stage||'')&&/계약|운영/.test(p.data.stage||''));
 const visibleHospitals=hospitals.filter(p=>section==='세팅'&&mode==='BA'?!contracted(p):contracted(p));
 const shown=visibleHospitals.filter(p=>p.data.name.includes(search));const selected=shown.find(p=>p.key===chosen)||shown[0];
 const clinicTasks=state.records.filter((r:any)=>r.kind==='task'&&selected&&(r.data.customer===selected.data.name||REPORTED.find(p=>p.name===selected.data.name)?.aliases.includes(r.data.customer)));
 const active=visibleHospitals.filter(p=>p.data.serviceStatus==='운영 중').length,waiting=visibleHospitals.filter(p=>p.data.serviceStatus==='세팅 중').length,unknown=visibleHospitals.filter(p=>!p.data.serviceStatus||p.data.serviceStatus==='확인 필요').length;
 function switchMode(next:string){if((draft||reviewDirty)&&!window.confirm('저장하지 않은 변경을 버리고 이동하시겠습니까?'))return;setMode(next);setChosen('');setDraft(null);setReviewDirty(false);setError('')}
 function select(key:string){if((draft||reviewDirty)&&!window.confirm('저장하지 않은 설정이 있습니다. 이동하시겠습니까?'))return;setChosen(key);setDraft(null);setError('')}
 async function save(){if(!selected||!draft)return;if(draft.serviceStatus==='운영 보류'&&!draft.notes?.trim()){setError('운영 보류 사유와 해제에 필요한 조치를 확인 근거·이슈에 입력해 주세요.');return;}setBusy(true);setError('');try{const result=await onSave(selected.record?{action:'edit',id:selected.record.id,version:selected.record.version,data:draft}:{action:'create',kind:'customer',data:draft});if(result){setDraft(null);if(result.id)setChosen(String(result.id))}else setError('저장하지 못했습니다. 입력 내용을 유지했습니다.')}finally{setBusy(false)}}
 if(section==='서비스')return <ServiceCenter hospitals={hospitals.filter(contracted)} state={state} onTask={onTask} onNewTask={onNewTask} onSave={onSave} onNavigate={onNavigate} focus={focus}/>;
 if(section==='CA')return <CAWorkspace state={state} onNewTask={onNewTask} onTask={onTask}/>;
 if(section==='세팅')return <SSSetupJourney hospitals={hospitals} state={state} focus={focus} onSave={onSave} onTask={onTask} onNewTask={onNewTask}/>;
 return <div className="ss-workspace">{section==='세팅'&&<nav className="organization-tools" aria-label="세팅 구분"><button aria-current={mode==='BA'?'page':undefined} onClick={()=>switchMode('BA')}>BA (Before &amp; After)</button><button aria-current={mode==='S'?'page':undefined} onClick={()=>switchMode('S')}>S · 계약 병원</button></nav>}
 {section==='세팅'&&mode==='BA'&&<section className="ba-preparation">
 <div className="ba-stage-grid">
 <div><span className="ba-stage-letter">B</span><h2>EMR 받기 전</h2><p>서비스를 이해하고 자료를 맡길 수 있도록 준비합니다.</p><ul><li><b>서비스 이해</b><span>다른 병원 사례 → 우리 병원 이름·로고를 넣은 시연</span></li><li><b>이지행정</b><span>자료 제공 절차·필요 서류·수령 방법 안내</span></li></ul><Button variant="outline" onClick={()=>onNewTask({org:'SS',title:'B · 병원 맞춤 시연·자료 수령 준비',phase:'구축·세팅',criterion:'병원명·로고, 가상 사례 표시, 서비스 이해·이지행정 통합 링크와 수령 담당 확인'})}>준비 업무 등록</Button></div>
 <div><span className="ba-stage-letter">A</span><h2>EMR 받은 후</h2><p>받은 자료로 샘플을 준비하고 계약 판단을 돕습니다.</p><ul><li><b>자료 확인</b><span>수령 범위·기준일·누락·사용 가능 범위 확인</span></li><li><b>맞춤 제작</b><span>샘플 선정 → 메시지·환자 화면 → 결과 설명</span></li></ul><Button variant="outline" onClick={()=>onNewTask({org:'SS',title:'A · EMR 샘플 분석·맞춤 제작',phase:'구축·세팅',instruction:'계약 전 샘플 선정은 실제 반응 근거, 수술·시술 항목 단가, 연락 리스크를 기준으로 합니다. 제외·보류 사유와 정렬 근거를 남깁니다.',criterion:'자료 확인, 선정 3개 기준과 근거, 맞춤 화면 검수, 병원 설명 자료'})}>분석·제작 업무 등록</Button></div>
 </div>
 <details className="ba-reference"><summary>샘플 선정 기준 · 3개</summary><ol><li><b>반응 가능성</b> — 실제 답변·문의·예약·통화 이력. 이력이 없으면 미확인.</li><li><b>수술·시술 항목 단가</b> — 확인된 항목별 금액. 총 결제액과 구분.</li><li><b>연락 리스크</b> — 수신거부·미해결 분쟁·연락 보류 요청.</li></ol><p>연락 금지·자료 불일치·최신 변동 미확인은 먼저 보류합니다. 남은 후보의 정렬 근거와 동순위 처리 기준을 기록합니다. 이 기준은 계약 전 샘플용이며, 계약 후 지속 운영의 배분 기준과 구분합니다.</p></details>
 </section>}

 <section className="panel"><div className="section-heading"><h2>{section==='서비스'?'서비스 병원':mode==='S'?'계약 후 서비스 준비':'준비할 병원'}</h2><span>병원 {visibleHospitals.length}곳</span></div><details><summary>병원 운영 상태 집계</summary><div className="ss-counts"><span>운영 중으로 등록 <b>{active}</b></span><span>세팅 중으로 등록 <b>{waiting}</b></span><span>운영상태 확인 필요 <b>{unknown}</b></span></div>{owner&&<p className="muted">네 병원의 계약·계약금 수령 및 EMR 현황은 9월 14일 대표님 말씀 기준입니다. 실제 발송 중 여부는 별도로 확인해 등록합니다.</p>}</details><Input aria-label="서비스 병원 검색" placeholder="병원 검색" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="ss-hospital-layout"><nav aria-label="SS 병원 목록">{shown.map(p=><button key={p.key} aria-current={selected?.key===p.key?'page':undefined} onClick={()=>select(p.key)}><b>{p.data.name}</b></button>)}{!shown.length&&<p>검색한 병원이 없습니다.</p>}</nav>{selected&&<article><div className="section-heading"><h2>{selected.data.name}</h2>{section==='세팅'&&owner&&!draft&&<Button variant="outline" onClick={()=>setDraft({...selected.data})}>병원 공통 정보 수정</Button>}{section==='서비스'&&<Button variant="outline" onClick={()=>onNavigate?.('세팅',{clinic:selected.key,mode:'S'})}>이 병원 세팅 열기 →</Button>}</div><p>{selected.data.emrStatus||'EMR 현황 미등록'}</p><p><b>다음 행동</b> · {selected.data.nextAction||'미등록'}</p>{!selected.record&&<p className="muted">대표님 전달 현황 · 서버 기록은 설정 저장 시 등록됩니다.</p>}
 {(section==='서비스'||mode==='S')&&<HospitalBrief key={'brief:'+selected.key} hospital={selected} tasks={clinicTasks} onTask={onTask} onNewTask={onNewTask}/>}
 {(section==='서비스'||mode==='S')&&<HospitalRollout hospital={selected} tasks={clinicTasks} onTask={onTask} onNewTask={onNewTask}/>}
 {(section==='서비스'||mode==='S')&&<ServiceReviewPanel startProduction={productionFocus} onProductionHospital={(slug:string)=>{const h=hospitals.find(p=>slug==='planme'?p.data.name.includes('플랜미'):/플로체|플로츠/.test(p.data.name));if(h){setProductionFocus(true);setSearch('');select(h.key)}}} key={'review:'+section+':'+selected.key} view={section==='세팅'?'setup':'service'} hospital={selected} owner={owner} onSave={onSave} onRecord={onTask} onDirty={setReviewDirty}/>}
 {section==='세팅'&&<ContentCatalog hospital={selected.data.name} onNewTask={onNewTask}/>}
 {section==='세팅'&&mode==='S'&&<SSRemoteAccess recordId={selected.record?.id||null} name={selected.data.name}/>}
 {selected.data.sourceUrl&&<a className="link-button" href={selected.data.sourceUrl} target="_blank" rel="noreferrer">환자 시연·업무 화면 열기 ↗</a>}
 {draft?<form data-dirty="true" onSubmit={e=>{e.preventDefault();save()}} className="form-body"><label className="field"><span>수동 운영 메모 · 실제 발송 상태와 별도</span><select value={draft.serviceStatus||'확인 필요'} onChange={e=>setDraft({...draft,serviceStatus:e.target.value})}>{['확인 필요','세팅 중','운영 중','운영 보류','종료'].map(v=><option key={v}>{v}</option>)}</select></label><p className="muted">대표 권한으로 기록합니다. 이 값은 자동 점검 결과나 발송 차단 조건이 아닙니다. 보류 시 아래에 사유·해제 조건을 입력하고, 변경 이력에서 기록을 확인합니다.</p>{fields.map(([key,label])=><label className="field" key={key}><span>{label}</span><Input value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<label className="field"><span>확인 근거·이슈</span><Textarea value={draft.notes||''} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>{error&&<p role="alert">{error}</p>}<div className="actions"><Button disabled={busy} type="submit">{busy?'저장 중…':'설정 저장'}</Button><Button type="button" variant="outline" onClick={()=>setDraft(null)}>취소</Button></div></form>:section==='세팅'?<details><summary>병원 공통 세팅 정보</summary><p>수동 운영 메모: {selected.data.serviceStatus||'미등록'} · 실제 상태는 서비스별 운영 결과를 확인해 주세요.</p><dl className="ss-settings">{fields.filter(([k])=>k!=='emrStatus'&&k!=='sourceUrl'&&k!=='nextAction').map(([key,label])=><div key={key}><dt>{label}</dt><dd>{selected.data[key]||'미정'}</dd></div>)}</dl></details>:null}
 {section==='서비스'&&['플로체','플로츠','플랜미'].some(n=>selected.data.name.includes(n))&&<SSServiceLive key={'live:'+selected.key} slug={selected.data.name.includes('플랜미')?'planme':'floce'} owner={owner} onTask={onTask} onReload={onReload}/>}
 <Button variant="outline" onClick={()=>onNewTask({org:'SS',customer:selected.data.name,title:selected.data.nextAction||'',phase:section==='서비스'?'반복 운영':'구축·세팅',repeat:section==='서비스'?'매일':'없음'})}>이 병원 업무 등록</Button><div className="org-work-list">{clinicTasks.map((r:any)=><button key={r.id} className="org-work-row" onClick={()=>onTask(r.id)}><span><b>{r.data.title}</b><small>{r.org} · {r.data.phase}</small></span><span>{r.data.status}</span></button>)}</div></article>}</div></section></div>
}
