import {db,json,fail,HttpError} from '@/lib/server';
import {emptyWallet,reduceWallet} from '@/lib/settlement';
import {clinicWallet,verifySignature} from '../../../lib/clinic-billing';
type Config={secret?:string;organizations?:string};
export async function clinicBilling(req:Request,config:Config){try{
 if(!config.secret||config.secret.length<32||!config.organizations)throw new HttpError(503,'병원 요금 계정 연결을 준비 중입니다.');
 const raw=await req.text();if(raw.length>2000)throw new HttpError(413,'요청이 너무 큽니다.');
 const ts=req.headers.get('x-billing-time')||'',org=req.headers.get('x-billing-org')||'',actor=req.headers.get('x-billing-actor')||'';
 if(!/^\d{13}$/.test(ts)||Math.abs(Date.now()-Number(ts))>60000||!org||!actor||!await verifySignature(config.secret,[req.method,ts,org,actor,raw].join('\n'),req.headers.get('x-billing-signature')||''))throw new HttpError(401,'요금 계정 인증을 확인해 주세요.');
 const mapping=JSON.parse(config.organizations);const hospitalId=Object.hasOwn(mapping,org)?mapping[org]:null;
 if(!Number.isSafeInteger(hospitalId)||hospitalId<=0)throw new HttpError(403,'병원 요금 계정이 아직 연결되지 않았습니다.');
 const hospital=await db().prepare("SELECT id,data FROM records WHERE id=? AND kind='customer'").bind(hospitalId).first<any>();if(!hospital)throw new HttpError(404,'병원 요금 계정을 찾을 수 없습니다.');
 const key='service-settlement:v1:'+hospitalId,row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<any>();const before=row?JSON.parse(row.value):emptyWallet();
 if(req.method==='GET')return json({name:JSON.parse(hospital.data).name,wallet:clinicWallet(before),mode:'internal'});
 if(req.method!=='POST')throw new HttpError(405,'허용하지 않는 요청입니다.');
 const c=JSON.parse(raw);if(c.action!=='requestTopup')throw new HttpError(403,'병원에서는 충전 신청만 할 수 있습니다.');
 // Never forward client fields such as hospitalId, costs, role or action to the ledger.
 const after=reduceWallet(before,{action:'requestTopup',amount:c.amount,payer:c.payer,version:c.version,requestId:c.requestId},'clinic:'+actor);
 if(after!==before){const value=JSON.stringify(after);const saved=row?await db().prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(value,key,row.value).run():await db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(key,value).run();if(!saved.meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 신청해 주세요.');}
 return json({ok:true,wallet:clinicWallet(after)});
 }catch(e){return fail(e)}}
