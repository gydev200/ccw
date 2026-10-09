import {env} from '@/versions/v2/lib/runtime';
import {HttpError} from './server';

type EncryptedToken={iv:number[];data:number[]};

async function key(){
 if(!env.SS_DISPATCH_TOKEN)throw new HttpError(503,'병원 안내 주소 보관 설정을 확인해 주세요.');
 const material=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('setup-invitation-v1:'+env.SS_DISPATCH_TOKEN));
 return crypto.subtle.importKey('raw',material,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptSetupToken(value:string):Promise<EncryptedToken>{
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value)));
 return {iv:Array.from(iv),data:Array.from(data)};
}
export async function decryptSetupToken(value:EncryptedToken):Promise<string>{
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv)},await key(),new Uint8Array(value.data)));
}
