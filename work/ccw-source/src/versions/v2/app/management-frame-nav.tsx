'use client';
import {DO_EXPLORER_ROWS,DO_EXPLORER_ORDER} from '@/versions/v2/lib/do-explorer';

export default function ManagementFrameNav({selection,perspective,onSelect,onPerspective}:{selection:string;perspective:number;onSelect:(key:string)=>void;onPerspective:(index:number)=>void}){
 return <nav className="management-frame-nav" aria-label="경영 관점 NO.1부터 NO.6">
  {DO_EXPLORER_ORDER.map((sourceIndex,displayIndex)=>{
   const row=DO_EXPLORER_ROWS[sourceIndex];
   return <div className="management-frame-row" key={sourceIndex}>
    <a className="management-frame-title" href={'#do/perspective/'+sourceIndex} aria-current={perspective===sourceIndex&&!selection?'page':undefined} onClick={event=>{event.preventDefault();onPerspective(sourceIndex)}}><b>NO.{displayIndex+1}</b> {row.title}</a>
    <div className="management-frame-items">{row.items.map((item,itemIndex)=>{
     const key=sourceIndex+':'+itemIndex;
     return <a key={key} href={'#do/frame/'+sourceIndex+'/'+itemIndex} aria-current={selection===key?'page':undefined} onClick={event=>{event.preventDefault();onSelect(key)}}>{item.label}</a>;
    })}</div>
   </div>;
  })}
 </nav>;
}
