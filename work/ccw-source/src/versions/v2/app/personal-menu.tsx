'use client';
import type {ReactNode} from 'react';
import {Menu} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuGroup,DropdownMenuLabel,DropdownMenuItem} from '@/versions/v2/components/ui/dropdown-menu';

export default function PersonalMenu({items,active,onSelect,switcher}:{switcher?:ReactNode;items:{id:string;label:string}[];active?:string;onSelect:(tool:string)=>void}){
 return <nav className="works-personal-nav" aria-label="개인 업무">
  {switcher}<DropdownMenu>
   <DropdownMenuTrigger aria-label="개인 업무 메뉴" title="직원 메뉴" className="flex items-center justify-center" style={{minWidth:44,minHeight:44}}><Menu size={22} aria-hidden="true"/></DropdownMenuTrigger>
   <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-16px)] p-2" aria-label="직원 메뉴">
    <DropdownMenuGroup><DropdownMenuLabel className="px-3 py-2">직원 메뉴</DropdownMenuLabel>
     {items.map(item=><DropdownMenuItem key={item.id} className="px-3 py-2.5" aria-current={active===item.id?'page':undefined} onClick={()=>onSelect(item.id)}>{item.label}</DropdownMenuItem>)}
    </DropdownMenuGroup>

   </DropdownMenuContent>
  </DropdownMenu>
 </nav>;
}
