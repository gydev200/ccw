'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

type Receipt={hospital:string;id:string|null;receivedAt:string|null;source?:string;neoId?:string|null};

export default function SSRemoteAccess({recordId,name,embedded=false}:{recordId:number|null;name:string;embedded?:boolean}){
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [link,setLink]=useState('');
 const [password,setPassword]=useState('');
 const [neoPassword,setNeoPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  setReceipt(null);setLink('');setPassword('');setNeoPassword('');setError('');
  if(!recordId)return;
  fetch('/api/remote-access?recordId='+recordId,{cache:'no-store'}).then(async response=>{
   const data=await response.json() as Receipt&{error?:string};
   if(!response.ok)throw Error(data.error||'접속 정보를 읽지 못했습니다.');
   setReceipt(data);
  }).catch(e=>setError(e instanceof Error?e.message:'접속 정보를 읽지 못했습니다.'));
 },[recordId]);
 async function invite(){
  if(!recordId)return;
  setBusy(true);setError('');setLink('');
  try{
   const response=await fetch('/api/remote-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',recordId})});
   const data=await response.json() as {url?:string;error?:string};
   if(!response.ok||!data.url)throw Error(data.error||'병원용 링크를 만들지 못했습니다.');
   setLink(data.url);
  }catch(e){setError(e instanceof Error?e.message:'병원용 링크를 만들지 못했습니다.')}finally{setBusy(false)}
 }
 async function reveal(){
  if(!recordId)return;
  setError('');
  try{
   const response=await fetch('/api/remote-access?show='+recordId,{cache:'no-store'});
   const data=await response.json() as {password?:string;neoPassword?:string;error?:string};
   if(!response.ok||!data.password)throw Error(data.error||'비밀번호를 읽지 못했습니다.');
   setPassword(data.password);setNeoPassword(data.neoPassword||'');
  }catch(e){setError(e instanceof Error?e.message:'비밀번호를 읽지 못했습니다.')}
 }
 async function refresh(){
  if(!recordId)return;
  setError('');
  try{
   const response=await fetch('/api/remote-access?recordId='+recordId,{cache:'no-store'});
   const data=await response.json() as Receipt&{error?:string};
   if(!response.ok)throw Error(data.error||'접속 정보를 읽지 못했습니다.');
   setReceipt(data);setPassword('');setNeoPassword('');
  }catch(e){setError(e instanceof Error?e.message:'접속 정보를 읽지 못했습니다.')}
 }
 return <section className="panel" aria-label="이지행정 원격 프로그램 세팅">
  <div className="section-heading"><div><h3>원격 프로그램 접수</h3><p className="muted">{name}에서 파일 두 개를 실행하면 접속 번호와 비밀번호가 이곳에 들어옵니다.</p></div></div>
  {!recordId?<p className="muted">병원 공통 정보를 먼저 저장하면 설치 링크를 만들 수 있습니다.</p>:<>
   <div className="actions"><Button type="button" variant="outline" disabled={busy} onClick={invite}>{busy?'만드는 중…':'새 설치 링크 만들기'}</Button><Button type="button" variant="outline" onClick={refresh}>접속 정보 새로고침</Button></div>
   {link&&<p style={{overflowWrap:'anywhere',marginTop:12}}>병원에 보낼 주소<br/><a href={link} target="_blank" rel="noreferrer">{link}</a></p>}
   {receipt?.id?<div style={{marginTop:18}}><p><b>접속 번호</b> {receipt.id}</p><p><b>접속 비밀번호</b> {password?<><span> {password} </span><Button type="button" variant="ghost" onClick={()=>{setPassword('');setNeoPassword('')}}>숨기기</Button></>:<Button type="button" variant="outline" onClick={reveal}>보기</Button>}</p>{receipt.neoId&&<><p><b>네오 접속 번호</b> {receipt.neoId}</p><p><b>네오 비밀번호</b> {neoPassword||'보기 버튼으로 확인'}</p></>}<small>{receipt.source==='PW.md'?'PW.md에 등록된 정보 · ':''}접수 {receipt.receivedAt?new Date(receipt.receivedAt).toLocaleString('ko-KR'):''} · 실제 접속 시험 전</small></div>:<p className="muted" style={{marginTop:16}}>아직 접수된 접속 정보가 없습니다.</p>}
  </>}
  {error&&<p role="alert" style={{color:'#a42626'}}>{error}</p>}
 </section>;
}
