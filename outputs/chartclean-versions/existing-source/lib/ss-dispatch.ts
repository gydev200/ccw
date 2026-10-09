import {assessQuality,type QualityEvidence} from './ss-quality';
export const DISPATCH_CHECKS=['identity','eligibility','freshness','lms','screen31','screen32','links','dashboard','independentReview'] as const;
export type DispatchReceipt={hospital:string;date:string;runHash:string;issuedAt:string;expiresAt:string;quality?:QualityEvidence;patients:Array<{ref:string;patientId:string;batchId:string;checks:Record<string,boolean>}>};
export async function hashRun(run:any){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({hospital:run.hospital,date:run.date,rows:run.rows})));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
export async function checkReceipt(run:any,envelope:any,secret:string|undefined,at=Date.now()){
 const empty={status:'pending',reviewedAt:null as string|null,expiresAt:null as string|null,ready:false,passed:0,total:run?.rows?.length||0,reason:'검수 결과가 아직 연결되지 않았습니다.',receipt:null as DispatchReceipt|null};if(!run||!secret||!envelope?.payload||typeof envelope.signature!=='string')return empty;
 const p=envelope.payload as DispatchReceipt,key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!/^[a-f0-9]{64}$/.test(envelope.signature))return {...empty,reason:'검수 서명 오류'};
 const signature=Uint8Array.from(envelope.signature.match(/../g)!, (s:string)=>parseInt(s,16));if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(JSON.stringify(p))))return {...empty,reason:'검수 서명 불일치'};
 if(p.hospital!==run.hospital||p.date!==run.date||p.runHash!==await hashRun(run))return {...empty,reason:'제작본 변경으로 재검수가 필요합니다.'};
 const issued=Date.parse(p.issuedAt),expires=Date.parse(p.expiresAt);if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>at||expires<=at||expires-issued>12*3600000)return {...empty,status:'expired',reviewedAt:p.quality?.finishedAt||p.issuedAt,expiresAt:p.expiresAt,reason:'검수 유효시간이 지났습니다. 발송 전 재검수가 필요합니다.'};
 if(!Array.isArray(p.patients)||p.patients.length!==run.rows.length||new Set(p.patients.map(x=>x.ref)).size!==p.patients.length||new Set(p.patients.map(x=>x.patientId)).size!==p.patients.length)return {...empty,reason:'검수 명단이 맞지 않습니다.'};
 const quality=assessQuality(p.quality,p.runHash,run.rows.length,at);
 const expiredQuality=[p.quality?.finishedAt,p.quality?.heartbeatAt,p.quality?.dataBasis?.knownExclusionsCheckedAt].some(value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&at-Date.parse(value)>2*3600000);
 const limits=[expires,...[p.quality?.finishedAt,p.quality?.heartbeatAt,p.quality?.dataBasis?.knownExclusionsCheckedAt].filter((v):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))).map(v=>Date.parse(v)+2*3600000)];const effectiveExpiresAt=new Date(Math.min(...limits)).toISOString();
 const ids=/^[a-f0-9-]{36}$/i;const passed=p.patients.filter(x=>ids.test(x.patientId)&&ids.test(x.batchId)&&run.rows.some((r:any)=>r.ref===x.ref)&&DISPATCH_CHECKS.every(c=>x.checks?.[c]===true)).length;
 return {...empty,status:expiredQuality?'expired':quality.ok&&passed===run.rows.length?'valid':'held',reviewedAt:p.quality?.finishedAt||p.issuedAt,expiresAt:effectiveExpiresAt,ready:quality.ok&&passed===run.rows.length&&passed>0,passed:quality.ok?passed:0,total:run.rows.length,reason:expiredQuality?'검수 실행 또는 제외·중복 대조 후 2시간이 지났습니다. 발송 전 재검수가 필요합니다.':!quality.ok?quality.reason:passed===run.rows.length?'대시보드 포함 9개 검수 통과 · '+quality.reason:'미통과 대상이 있습니다.',receipt:p};
}
