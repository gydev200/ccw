'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown} from 'lucide-react';
import {OS_ROLES} from '@/lib/os-roles';

export type OrganizationDestination={area:string;tool?:string;section?:string};
type Entry={id:string;label:string;description?:string;destination:OrganizationDestination;children?:Entry[]};
type Props={active:string;isDO:boolean;allowed:string[];onNavigate:(destination:OrganizationDestination)=>void};

export default function OrganizationNav({active,isDO,allowed,onNavigate}:Props){
 const [open,setOpen]=useState('');
 const [position,setPosition]=useState({left:0,top:0});
 const triggers=useRef<Record<string,HTMLButtonElement|null>>({});
 const panel=useRef<HTMLDivElement>(null);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const activated=useRef(false);
 const can=(id:string)=>isDO||allowed.includes(id);
 const entries:Entry[]=[
  ...(can('OS')?[{id:'DS',label:'DS',destination:{area:'OS',tool:'A',section:'DS'}}]:[]),
  ...(can('OS')||can('DM')?[{id:'OS',label:'OS',destination:{area:can('DM')?'DM':'OS'},children:[
   ...(can('DM')?[{id:'DM',label:'DM · '+OS_ROLES.DM.name,description:OS_ROLES.DM.work,destination:{area:'DM'}}]:[]),
   ...(can('OS')?[{id:'OP',label:'OP · '+OS_ROLES.OP.name,description:OS_ROLES.OP.work,destination:{area:'OS',tool:'B',section:'OP'}}]:[]),
  ]}]:[]),
  ...(can('SS')||can('CA')?[{id:'SS',label:'SS',destination:{area:'SS',tool:can('SS')?'서비스':'CA'},children:[
   ...(can('SS')?[{id:'setup',label:'셋팅',destination:{area:'SS',tool:'세팅'}},{id:'service',label:'서비스',destination:{area:'SS',tool:'서비스'}}]:[]),
   ...(can('CA')?[{id:'CA',label:'CA · 콘텐츠 에이전시',destination:{area:'SS',tool:'CA'}}]:[]),
  ]}]:[]),
  ...(can('PM')?[{id:'PM',label:'PM',destination:{area:'PM'},children:[
   {id:'planning',label:'기획',destination:{area:'PM',tool:'기획실'}},
   {id:'management',label:'관리',destination:{area:'PM',tool:'업무함'}},
  ]}]:[]),
  ...(isDO?[{id:'DO',label:'DO · 대표',destination:{area:'DO'}}]:[]),
 ];
 function cancelClose(){if(closeTimer.current)clearTimeout(closeTimer.current);}
 function reveal(id:string,interactive=false){cancelClose();activated.current=interactive;const bounds=triggers.current[id]?.getBoundingClientRect();if(!bounds)return;setPosition({left:Math.max(8,Math.min(bounds.left,window.innerWidth-248)),top:bounds.bottom+4});setOpen(id);}
 function deferClose(){cancelClose();closeTimer.current=setTimeout(()=>setOpen(''),160);}
 function focusFirst(){requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button')?.focus());}
 useEffect(()=>()=>cancelClose(),[]);
 useEffect(()=>{setOpen('');},[active]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!triggers.current[open]?.contains(event.target as Node))setOpen('');};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen('');triggers.current[open]?.focus();}};
  const close=()=>setOpen('');
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',close);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',close);};
 },[open]);
 const expanded=entries.find(entry=>entry.id===open);
 return <>
  <nav className="works-org-nav" aria-label="조직 선택">
   {entries.map(entry=><button key={entry.id} ref={node=>{triggers.current[entry.id]=node;}} className={entry.id==='PM'?'org-support-start':undefined} aria-current={active===entry.id?'page':undefined} aria-expanded={entry.children?open===entry.id:undefined} aria-controls={entry.children?'organization-dropdown-'+entry.id:undefined} onPointerEnter={event=>{if(event.pointerType==='mouse'&&entry.children)reveal(entry.id);else if(!entry.children)setOpen('');}} onPointerLeave={entry.children?deferClose:undefined} onKeyDown={event=>{if(entry.children&&event.key==='ArrowDown'){event.preventDefault();reveal(entry.id,true);focusFirst();}}} onClick={()=>{if(entry.children){if(open===entry.id&&activated.current)setOpen('');else{reveal(entry.id,true);focusFirst();}}else{setOpen('');onNavigate(entry.destination);}}}>
    {entry.label}{entry.children&&<ChevronDown size={13} aria-hidden="true"/>}
   </button>)}
  </nav>
  {expanded?.children&&createPortal(<div ref={panel} id={'organization-dropdown-'+expanded.id} className="organization-dropdown" aria-label={expanded.label+' 하위 업무'} style={position} onPointerEnter={cancelClose} onPointerLeave={deferClose} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==triggers.current[open])setOpen('');}}>
   {expanded.id!=='OS'&&<button className="organization-overview" onClick={()=>{setOpen('');onNavigate(expanded.destination);}}>{expanded.label} 업무 전체</button>}
   {expanded.children.map(child=><button key={child.id} aria-label={child.label} aria-describedby={child.description?'organization-role-'+child.id:undefined} onClick={()=>{setOpen('');onNavigate(child.destination);}}><span>{child.label}</span>{child.description&&<small id={'organization-role-'+child.id}>{child.description}</small>}</button>)}
  </div>,document.body)}
 </>;
}
