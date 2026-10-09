export const SERVICES={naverworks:'네이버웍스',chatgpt:'ChatGPT Business'} as const;
export type ServiceId=keyof typeof SERVICES;
export type AccountEntry={id:string;memberId:string;person:string;name:string;service:ServiceId;purpose:string;status:'requested'|'approved'|'active'|'rejected'|'reclaimed';login:string;workspace:string;url:string;note:string;updatedAt:string;createdAt:string};
export function text(value:unknown,label:string,max=500,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(label+'을 확인해 주세요.');return value.trim();}
export function transitionAccount(entry:AccountEntry,action:string,body:any):AccountEntry{
 const next={...entry,updatedAt:new Date().toISOString()};
 if(action==='approve'&&entry.status==='requested')next.status='approved';
 else if(action==='reject'&&entry.status==='requested'){next.status='rejected';next.note=text(body.note,'반려 사유',500,true);}
 else if(action==='register'&&['approved','active'].includes(entry.status)){
  next.login=text(body.login,'로그인 아이디·이메일',160,true);next.workspace=text(body.workspace,'소속 워크스페이스',160,true);next.url=text(body.url||'','접속 주소',500);next.note=text(body.note||'','배정 안내',500);
  if(next.url){const u=new URL(next.url);if(u.protocol!=='https:'||u.username||u.password)throw Error('접속 주소는 HTTPS 주소로 입력해 주세요.');}
  next.status='active';
 }else if(action==='reclaim'&&['active','approved'].includes(entry.status)){next.status='reclaimed';next.note=text(body.note,'회수 내역',500,true);}
 else throw Error('현재 상태에서 처리할 수 없습니다. 새로고침 후 확인해 주세요.');
 return next;
}
