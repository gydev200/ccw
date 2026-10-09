import {
  db,
  member,
  owner,
  origin,
  json,
  fail,
  HttpError,
  now,
} from '@/lib/server';
import { reduceStrategy, text, day, type Strategy } from '@/lib/dss-strategy';
import {
  strategySnapshot,
  saveStrategy,
  strategyWrite,
  strategyBackup,
} from '@/lib/dss-strategy-store';
import { validateOrder, STAFF, defaultAccess } from '@/lib/work-orders';
import { digest, randomToken } from '@/lib/local-auth';
export const dynamic = 'force-dynamic';
async function authorized() {
  const m = await member();
  owner(m);
  return m;
}
export async function GET() {
  try {
    await authorized();
    const snapshot = await strategySnapshot(db());
    const reviews = await db()
      .prepare("SELECT key,value FROM settings WHERE key LIKE 'dss:review:%'")
      .all<{ key: string; value: string }>();
    const executions = await db()
      .prepare(
        "SELECT id,kind,org,assignee,version,data,dedup FROM records WHERE kind='work_order' AND dedup LIKE 'dss-execution:%' ORDER BY id DESC",
      )
      .all<{ id: number; data: string; dedup: string }>();
    return json({
      strategy: snapshot.data,
      people: STAFF,
      executions: executions.results.map((r) => ({
        ...r,
        data: JSON.parse(r.data),
      })),
      reviews: reviews.results.map((r) => {
        const v = JSON.parse(r.value);
        return {
          id: r.key.slice('dss:review:'.length),
          agendaId: v.agendaId,
          revision: v.revision,
          reviewer: v.reviewer,
          role: v.role,
          expiresAt: v.expiresAt,
          revoked: v.revoked,
          submitted: v.submitted,
          brief: v.brief,
          opinion: v.opinion,
          dissent: v.dissent,
          submittedAt: v.submittedAt,
        };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    origin(req);
    const m = await authorized();
    const raw = await req.text();
    if (raw.length > 180000)
      throw new HttpError(413, '안건 내용이 너무 큽니다.');
    const b = JSON.parse(raw),
      at = now();
    if (b.action === 'revoke') {
      const id = text(b.id, '검토 번호', 100, true);
      const row = await db()
        .prepare('SELECT value FROM settings WHERE key=?')
        .bind('dss:review:' + id)
        .first<{ value: string }>();
      if (!row) throw new HttpError(404, '검토 요청을 찾을 수 없습니다.');
      const r = JSON.parse(row.value);
      r.revoked = true;
      const out = await db()
        .prepare('UPDATE settings SET value=? WHERE key=? AND value=?')
        .bind(JSON.stringify(r), 'dss:review:' + id, row.value)
        .run();
      if (!out.meta.changes)
        throw new HttpError(
          409,
          '의견이 먼저 저장됐습니다. 새로 불러와 주세요.',
        );
      return json({ ok: true });
    }
    const snap = await strategySnapshot(db());
    if (b.version !== snap.data.version)
      throw new HttpError(
        409,
        '다른 변경이 먼저 저장됐습니다. 입력을 복사한 뒤 최신 내용을 불러와 주세요.',
      );
    if (['submit','return','followup'].includes(b.action)) {
      const next=structuredClone(snap.data),a=next.agendas.find(a=>a.id===b.agendaId);
      if(!a)throw Error('저장된 안건을 선택해 주세요.');
      if(b.action==='submit'){
        if(a.executionKey||!['검토 중','재검토'].includes(a.status)||a.workflow?.stage==='상신')throw Error('준비 중인 안건만 상신할 수 있습니다.');
        if(!a.evidence.trim()||!a.criteria.trim()||!a.deadline||a.options.length<2||a.options.some(o=>!o.basis.trim()||!o.benefit.trim()||!o.risk.trim()))throw Error('근거·결정 기준·기한과 2개 이상 대안의 근거·기대효과·위험을 채워 주세요.');
        a.workflow={stage:'상신',submittedAt:at,submittedRevision:a.revision,recommendation:text(b.recommendation,'DSS 권고안·이유',6000,true)};
      }else if(b.action==='return'){
        if(a.executionKey||a.workflow?.stage!=='상신')throw Error('상신된 미결 안건만 보완 요청할 수 있습니다.');
        const reason=text(b.reason,'보완 요청 내용',6000,true);a.workflow={stage:'준비'};a.status='재검토';a.notes.push({id:crypto.randomUUID(),author:m.label,role:'DO',opinion:reason,dissent:'',source:'대표 보완 요청',at});
      }else{
        if(!a.executionKey)throw Error('배정한 실행 업무가 필요합니다.');
        const row=await db().prepare("SELECT id,version,data FROM records WHERE kind='work_order' AND dedup=?").bind(a.executionKey).first<{id:number;version:number;data:string}>();
        if(!row||row.version!==b.executionVersion)throw new HttpError(409,'실행 결과가 바뀌었습니다. 최신 결과를 확인해 주세요.');
        const d=JSON.parse(row.data);if(d.status!=='상사 확인 대기'||!d.result||!d.evidence)throw Error('담당자가 결과·근거를 제출한 업무만 대표에게 보고합니다.');
        a.workflow={...a.workflow,stage:'배정',report:{summary:text(b.summary,'DSS 확인·보고 내용',6000,true),executionVersion:row.version,at}};
      }
      next.version++;next.history.unshift({at,actor:m.id,action:b.action,id:a.id});
      if(!await saveStrategy(db(),snap.raw,next))throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');
      return json({ok:true,version:next.version});
    }
    if (b.action === 'review') {
      const a = snap.data.agendas.find((a) => a.id === b.agendaId);
      if (!a) throw Error('먼저 안건을 저장해 주세요.');
      const reviewer = text(b.reviewer, '검토자', 200, true),
        role = text(b.role, '역할', 100, true),
        brief = text(b.brief, '외부 검토 자료', 20000, true);
      const expires = day(b.expires, '검토 마감', true) + 'T23:59:59+09:00';
      const ttl = Date.parse(expires) - Date.now();
      if (ttl <= 0 || ttl > 14 * 86400000)
        throw Error('검토 마감은 오늘부터 14일 이내로 정해 주세요.');
      const token = randomToken(),
        hash = await digest(token),
        id = crypto.randomUUID();
      const value = {
        id,
        hash,
        agendaId: a.id,
        revision: a.revision,
        reviewer,
        role,
        brief,
        expiresAt: expires,
        revoked: false,
        submitted: false,
        createdAt: at,
      };
      await db().batch([
        db()
          .prepare('INSERT INTO settings(key,value) VALUES(?,?)')
          .bind('dss:review:' + id, JSON.stringify(value)),
        db()
          .prepare('INSERT INTO settings(key,value) VALUES(?,?)')
          .bind('dss:review-token:' + hash, id),
      ]);
      return json({
        ok: true,
        url: new URL('/dss-review', req.url).origin + '/dss-review#' + token,
      });
    }
    if (b.action === 'execute') {
      const next = structuredClone(snap.data) as Strategy,
        a = next.agendas.find((a) => a.id === b.agendaId);
      if (!a || a.status !== '결정')
        throw Error('먼저 안건의 결정을 저장해 주세요.');
      if (a.executionKey) throw Error('이미 내부 업무로 연결된 결정입니다.');
      const d = validateOrder(b.order);
      const staff = await db()
        .prepare('SELECT id FROM members WHERE person=? AND active=1')
        .bind(d.assignee)
        .first();
      if (!staff) throw Error('현재 활성화된 담당 직원을 선택해 주세요.');
      const accessRow = await db()
        .prepare('SELECT value FROM settings WHERE key=?')
        .bind('staff-access:' + d.assignee)
        .first<{ value: string }>();
      const access = accessRow
        ? JSON.parse(accessRow.value)
        : defaultAccess(d.assignee);
      if (!access.orgs.includes(d.org))
        throw Error('담당자의 허용 부서를 확인해 주세요.');
      a.executionKey = 'dss-execution:' + a.id;
      a.workflow={...a.workflow,stage:'배정'};
      next.version++;
      next.history.unshift({ at, actor: m.id, action: 'execute', id: a.id });
      const out = await db().batch([
        strategyWrite(db(), snap.raw, next),
        db()
          .prepare(
            "INSERT INTO records(kind,org,assignee,data,dedup,created_at,updated_at) SELECT 'work_order',?,?,?,?,?,? WHERE changes()>0",
          )
          .bind(
            d.org,
            d.assignee,
            JSON.stringify({
              ...d,
              decisionId: a.id,
              decisionRevision: a.revision,
            }),
            a.executionKey,
            at,
            at,
          ),
        strategyBackup(db(), next),
      ]);
      if (!out[0].meta.changes)
        throw new HttpError(
          409,
          '다른 변경이 먼저 저장됐습니다. 최신 내용을 불러와 주세요.',
        );
      return json({ ok: true, version: next.version });
    }
    const next = reduceStrategy(snap.data, b.action, b.data, m.id, at);
    if (!(await saveStrategy(db(), snap.raw, next)))
      throw new HttpError(
        409,
        '다른 변경이 먼저 저장됐습니다. 최신 내용을 불러와 주세요.',
      );
    return json({ ok: true, version: next.version });
  } catch (e) {
    return fail(e);
  }
}
