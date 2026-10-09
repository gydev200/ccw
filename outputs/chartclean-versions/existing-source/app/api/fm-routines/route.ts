import {env} from '@/lib/runtime';
import {db,member,owner,origin,json,fail,HttpError} from '@/lib/server';
import {financeSnapshot,saveFinance} from '@/lib/ccfm-store';
import {scheduledFinance} from '@/lib/fm-scheduler';
import {unavailableFinancePeople} from '@/lib/finance-assignees';
import {isPreparationWorker} from '@/lib/ss-preparation-worker';
import humans from '@/lib/human-roster';
const key='fm-routine-worker:latest';
export async function GET(){try{owner(await member());const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();return json({lastRun:row?JSON.parse(row.value):null})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 const token=(env as unknown as {FM_ROUTINE_TOKEN?:string}).FM_ROUTINE_TOKEN;
 const worker=!!token&&token.length>=32&&await isPreparationWorker(req,token);
 if(!worker){origin(req);owner(await member());}
 const at=new Date().toISOString(),database=db();
 try{
  const before=await financeSnapshot(database),members=await database.prepare('SELECT person,active FROM members').all<{person:string;active:number}>();
  const result=scheduledFinance(before.ledger,at,humans.map(h=>h.id),unavailableFinancePeople(members.results));
  if(result.ledger!==before.ledger&&!await saveFinance(database,before,result.ledger,at))throw new HttpError(409,'원장이나 자동 등록 기준이 변경됐습니다. 다음 실행에서 다시 확인합니다.');
  const report={at,ok:true,created:result.created,reason:result.reason,trigger:worker?'scheduler':'owner-check'};
  await database.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(report)).run();return json(report);
 }catch(e){await database.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify({at,ok:false,error:e instanceof Error?e.message:'자동 등록 오류',trigger:worker?'scheduler':'owner-check'})).run();throw e;}
}catch(e){return fail(e)}}
