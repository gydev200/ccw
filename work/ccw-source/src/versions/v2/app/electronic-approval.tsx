 'use client';
import {useEffect,useRef,useState} from 'react';
import type {ApprovalView} from './approval-navigation';
export default function ElectronicApproval({view='all',nonce=0,onViewChange}:{view?:ApprovalView;nonce?:number;onViewChange?:(view:ApprovalView)=>void}){
 const frame=useRef<HTMLIFrameElement>(null),ready=useRef(false),requested=useRef(view),report=useRef(onViewChange);
 const [dirty,setDirty]=useState(false),[loading,setLoading]=useState(true);
 const initialSrc=useRef('/v2/electronic-approval/'+(['inbox','processed'].includes(view)?'director':'employee')+'?view='+view);
 requested.current=view;report.current=onViewChange;
 useEffect(()=>{if(!ready.current)return;setLoading(true);frame.current?.contentWindow?.postMessage({type:'ccw-approval-navigate',view},location.origin)},[view,nonce]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;if(event.data?.type==='ccw-approval-dirty')setDirty(event.data.dirty===true);if(event.data?.type==='ccw-approval-ready'){const first=!ready.current;ready.current=true;setLoading(false);if(first)frame.current?.contentWindow?.postMessage({type:'ccw-approval-navigate',view:requested.current},location.origin);}if(event.data?.type==='ccw-approval-view'&&['all','draft','pending','approved','cancelled','history','compose','inbox','processed'].includes(event.data.view))report.current?.(event.data.view);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 return <section className="electronic-approval-module" aria-label="전자결재" data-dirty={dirty?'true':undefined}><div role="status" style={{height:24,padding:'0 8px',fontSize:12,color:'#526071'}}>{loading?'전자결재를 연결하고 있습니다…':null}</div><iframe ref={frame} src={initialSrc.current} title="전자결재 · 내 결재와 임시저장" style={{width:'100%',height:'calc(100dvh - 160px)',minHeight:600,border:0,display:'block',background:'#fff'}} sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"/></section>;
}
