import {env} from '@/lib/runtime';
import {HttpError} from './server';
export const hospitalAccounts={floce:{email:'floce@chaenggyeo.kr',name:'플로체 여성의원'},planme:{email:'planme@chaenggyeo.kr',name:'플랜미의원'}};
export function hospitalAccount(value:unknown){if(typeof value!=='string'||!Object.hasOwn(hospitalAccounts,value))throw new HttpError(400,'연결된 병원을 선택해 주세요.');return {slug:value,...hospitalAccounts[value as keyof typeof hospitalAccounts]};}
export async function ticketKey(ticket:string){return 'hospital-sso:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ticket))),b=>b.toString(16).padStart(2,'0')).join('');}
async function key(){if(!env.SS_DISPATCH_TOKEN)throw new HttpError(503,'병원 인증 연결 설정을 확인해 주세요.');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hospital-password-v1:'+env.SS_DISPATCH_TOKEN)),'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptPassword(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value)));return JSON.stringify({iv:Array.from(iv),data:Array.from(data)});}
export async function decryptPassword(value:string){const b=JSON.parse(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b.iv)},await key(),new Uint8Array(b.data)));}
