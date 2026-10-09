const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fm-scheduler-'));
try{
 for(const n of ['ccfm','fm-scheduler','fm-routines'])require('esbuild').buildSync({entryPoints:['lib/'+n+'.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(dir,n+'.cjs')});
 const {scheduledFinance}=require(path.join(dir,'fm-scheduler.cjs')),{emptyFinance,reduceFinance}=require(path.join(dir,'ccfm.cjs')),{validateRoutinePolicy,ROUTINE_CYCLES}=require(path.join(dir,'fm-routines.cjs'));
 const actor={id:'qa',person:'do',role:'DO',active:1};let f=emptyFinance();
 const policy={enabled:true,person:'do',time:'09:00',cycles:ROUTINE_CYCLES.map(([cycle])=>({cycle,dueDays:2}))};
 assert.equal(scheduledFinance(f,'2026-09-24T00:00:00Z',['do'],new Set()).reason,'paused');
 f=reduceFinance(f,{action:'configureRoutines',date:'2026-09-24',policy,version:0,requestId:'config'},actor,[],['do'],['DSS']);
 assert.equal(scheduledFinance(f,'2026-09-23T23:59:00Z',['do'],new Set()).reason,'before-time');
 const first=scheduledFinance(f,'2026-09-24T00:00:00Z',['do'],new Set());assert.equal(first.created,40);assert.ok(first.ledger.work.every(w=>w.due==='2026-09-26'));assert.deepEqual(first.ledger.journals,[]);
 assert.equal(scheduledFinance(first.ledger,'2026-09-24T08:00:00Z',['do'],new Set()).ledger,first.ledger);
 const next=scheduledFinance(first.ledger,'2026-09-25T00:00:00Z',['do'],new Set());assert.equal(next.created,9);assert.equal(next.ledger.work.length,49);
 const month=scheduledFinance(first.ledger,'2026-10-01T00:00:00Z',['do'],new Set());assert.ok(month.created>9);assert.equal(new Set(month.ledger.work.map(w=>w.routineKey)).size,month.ledger.work.length);
 assert.throws(()=>scheduledFinance(f,'2026-09-24T00:00:00Z',['do'],new Set(['do'])));
 for(const bad of [{...policy,time:'25:00'},{...policy,cycles:[]},{...policy,person:'missing'},{...policy,cycles:[{cycle:'daily',dueDays:-1}]},{...policy,cycles:[{cycle:'daily',dueDays:0},{cycle:'daily',dueDays:1}]}])assert.throws(()=>validateRoutinePolicy(bad,['do']));
 assert.throws(()=>reduceFinance(f,{action:'configureRoutines',date:'2026-09-24',policy,version:f.version,requestId:'staff'}, {...actor,role:'staff'},[],['do'],['DSS']));
 console.log('Scheduler: paused/time boundary/40 tasks/idempotency/day and month rollover/inactive staff/invalid policies/owner access passed');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
