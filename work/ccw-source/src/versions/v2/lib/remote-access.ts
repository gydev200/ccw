import {env} from '@/versions/v2/lib/runtime';
import {HttpError} from './server';

async function key(pwSeed=false){
 const token=pwSeed?(env as any).PW_REFERENCE_KEY:env.SS_DISPATCH_TOKEN;
 if(!token)throw new HttpError(503,'접속 정보 암호화 설정을 확인해 주세요.');
 const material=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('remote-password-v1:'+token));
 return crypto.subtle.importKey('raw',material,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptRemotePassword(value:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value)));
 return {iv:Array.from(iv),data:Array.from(cipher)};
}
export async function decryptRemotePassword(value:{iv:number[],data:number[]},pwSeed=false){
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv)},await key(pwSeed),new Uint8Array(value.data)));
}
