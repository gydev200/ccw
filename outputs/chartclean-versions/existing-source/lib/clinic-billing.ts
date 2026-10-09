import {channels, type Wallet} from './settlement';
// Explicit allowlist: the clinic never receives source costs, margin, audit notes or other tenants.
export function clinicWallet(w:Wallet){
 const visibleTrades=(w.trades||[]).filter(t=>t.kind!=='expense'&&!(t.kind==='reversal'&&(w.trades||[]).find(x=>x.id===t.targetId)?.kind==='expense'));
 return {version:w.version,balance:w.balance,reserved:w.reserved,available:w.balance-w.reserved,limit:w.limit,
 prices:channels.map(channel=>({channel,sale:w.prices[channel]?.sale??null})),
 topups:(w.topups||[]).map(t=>({id:t.id,amount:t.amount,payer:t.payer,at:t.at,status:t.status,reason:t.reason})),
 events:w.events.filter(e=>['charge','refund','usage','reserve','cancel'].includes(e.kind)).map(e=>({id:e.id,at:e.at,kind:e.kind,amount:e.amount})),
 trades:visibleTrades.map(t=>({id:t.id,date:t.date,kind:t.kind,category:t.category,amount:t.amount,description:t.description,invoiceId:t.invoiceId,targetId:t.targetId}))};
}
export type ClinicWallet=ReturnType<typeof clinicWallet>;
export async function signature(secret:string,message:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))),v=>v.toString(16).padStart(2,'0')).join('')}
export async function verifySignature(secret:string,message:string,hex:string){if(!/^[a-f0-9]{64}$/.test(hex))return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,Uint8Array.from(hex.match(/../g)!,v=>parseInt(v,16)),new TextEncoder().encode(message))}
