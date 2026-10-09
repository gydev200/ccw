import {controlReport} from '@/lib/fm-control';
import {emptyWallet} from '@/lib/settlement';
import {unavailableFinancePeople} from '@/lib/finance-assignees';
import { makeFinanceBackup } from '@/lib/ccfm-backup';
import { db, member, origin, json, fail, HttpError, now } from '@/lib/server';
import {
  financeAccess,
  sourcesFromWallets,
  reduceFinance,
  financeReport,
  kstDate,
  ACCOUNTS,
} from '@/lib/ccfm';
import { financeSnapshot, saveFinance } from '@/lib/ccfm-store';
import humans from '@/lib/human-roster';
import { ORGS } from '@/lib/model';
export const dynamic = 'force-dynamic';
async function authorized() {
  const m = await member();
  if (!financeAccess(m))
    throw new HttpError(403, 'CCFM 재무관리은 이사님 내부 권한이 필요합니다.');
  return m;
}
export async function GET(req: Request) {
  try {
    await authorized();
    const requestedBackup = new URL(req.url).searchParams.get('backup');
    if (requestedBackup) {
      if (!/^[1-9]\d{0,6}$/.test(requestedBackup))
        throw Error('보관본 번호를 확인해 주세요.');
      const saved = await db()
        .prepare('SELECT value FROM settings WHERE key=?')
        .bind('ccfm:backup:' + requestedBackup)
        .first<any>();
      if (!saved) throw new HttpError(404, '보관본을 찾을 수 없습니다.');
      return new Response(saved.value, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition':
            'attachment; filename="ccfm-backup-' + requestedBackup + '.json"',
          'Cache-Control': 'no-store',
        },
      });
    }
    const snapshot = await financeSnapshot(db()),
      date = new URL(req.url).searchParams.get('date') || kstDate(),
      sources = sourcesFromWallets(snapshot.wallets);
    const controls = await db()
      .prepare(
        "SELECT id,person,org,data,version FROM control_entries WHERE kind='payment' ORDER BY id DESC",
      )
      .all<any>();
    const backup = await db()
      .prepare('SELECT key FROM settings WHERE key=?')
      .bind('ccfm:backup:' + snapshot.ledger.version)
      .first();
    const report = financeReport(snapshot.ledger, sources, date),
      monthRows = report.allCashRows.filter((r) =>
        r.date.startsWith(date.slice(0, 7)),
      );
    const monthReport = {
      cashIn: monthRows
        .filter((r) => r.cash > 0)
        .reduce((n, r) => n + r.cash, 0),
      cashOut: -monthRows
        .filter((r) => r.cash < 0)
        .reduce((n, r) => n + r.cash, 0),
      net: monthRows.reduce((n, r) => n + r.cash, 0),
    };
    const customers=await db().prepare("SELECT id,data FROM records WHERE kind='customer' ORDER BY id").all<{id:number;data:string}>();
    const wallets=new Map(snapshot.wallets.map(w=>[w.key,JSON.parse(w.value)]));
    const hospitals=customers.results.map(h=>({id:h.id,name:JSON.parse(h.data).name,wallet:wallets.get('service-settlement:v1:'+h.id)||emptyWallet()}));
    const members=await db().prepare('SELECT person,active FROM members').all<{person:string;active:number}>();
    const unavailable=unavailableFinancePeople(members.results);
    const data = {
      financialControl:controlReport(snapshot.ledger,hospitals,date),
      financeCustomers:hospitals.map(h=>({id:h.id,name:h.name})),
      assignmentPeople:humans.filter(h=>!unavailable.has(h.id)).map(h=>({id:h.id,name:h.name})),
      monthReport,
      ledger: snapshot.ledger,
      sources,
      report: financeReport(snapshot.ledger, sources, date),
      people: humans.map((h) => ({ id: h.id, name: h.name })),
      orgs: ORGS.map((o) => ({ id: o.id, name: o.name })),
      accounts: ACCOUNTS,
      payments: controls.results.map((r) => ({
        ...r,
        data: JSON.parse(r.data),
      })),
      backup: { version: snapshot.ledger.version, available: !!backup },
      company: '(주)에이치에스투에쿼티',
    };
    if (new URL(req.url).searchParams.get('export') === '1')
      return new Response(
        JSON.stringify(
          await makeFinanceBackup(snapshot.ledger, snapshot.wallets, now()),
          null,
          2,
        ),
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition':
              'attachment; filename="chartclean-finance-backup.json"',
            'Cache-Control': 'no-store',
          },
        },
      );
    return json(data);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    origin(req);
    const m = await authorized();
    const raw = await req.text();
    if (raw.length > 20000) throw Error('요청이 너무 큽니다.');
    const c = JSON.parse(raw),
      snapshot = await financeSnapshot(db()),
      at = now();
    if(c.action==='financialControl'&&c.kind==='contract'){
      const h=await db().prepare("SELECT id FROM records WHERE kind='customer' AND id=?").bind(c.item?.hospitalId??0).first();
      if(!h)throw new HttpError(400,'등록된 거래처를 선택해 주세요.');
    }
    if(['createWork','ensureRoutines','configureRoutines','financialControl'].includes(c.action)){
      const assigned=c.action==='financialControl'?c.item?.owner:c.action==='createWork'?c.item?.person:c.action==='configureRoutines'?c.policy?.person:c.person;
      const members=await db().prepare('SELECT person,active FROM members').all<{person:string;active:number}>();
      if(assigned&&unavailableFinancePeople(members.results).has(assigned))throw new HttpError(409,'사용 중인 담당자를 선택해 주세요.');
    }
    const after = reduceFinance(
      snapshot.ledger,
      c,
      m,
      sourcesFromWallets(snapshot.wallets),
      humans.map((h) => h.id),
      ORGS.map((o) => o.id),
      at,
    );
    if (after === snapshot.ledger)
      return json({ ok: true, duplicate: true, version: after.version });
    if (!(await saveFinance(db(), snapshot, after, at)))
      throw new HttpError(
        409,
        '원장이나 서비스 거래가 변경됐습니다. 새로고침 후 대조해 주세요.',
      );
    return json({ ok: true, version: after.version, backup: true });
  } catch (e) {
    return fail(e);
  }
}
