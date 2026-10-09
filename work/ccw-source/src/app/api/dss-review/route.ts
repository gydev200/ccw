import { db, json, fail, HttpError, origin, now } from '@/lib/server';
import { digest } from '@/lib/local-auth';
import { text } from '@/lib/dss-strategy';
export const dynamic = 'force-dynamic';
async function review(req: Request) {
  const token = req.headers.get('X-DSS-Review') || '';
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(404, '검토 링크를 확인해 주세요.');
  const hash = await digest(token),
    index = await db()
      .prepare('SELECT value FROM settings WHERE key=?')
      .bind('dss:review-token:' + hash)
      .first<{ value: string }>();
  if (!index) throw new HttpError(404, '검토 링크를 확인해 주세요.');
  const key = 'dss:review:' + index.value,
    row = await db()
      .prepare('SELECT value FROM settings WHERE key=?')
      .bind(key)
      .first<{ value: string }>();
  if (!row) throw new HttpError(404, '검토 요청을 찾을 수 없습니다.');
  const data = JSON.parse(row.value);
  if (data.revoked || Date.parse(data.expiresAt) < Date.now())
    throw new HttpError(
      410,
      '종료된 검토 요청입니다. 이사님에게 새 검토 요청을 받아 주세요.',
    );
  return { key, raw: row.value, data };
}
export async function GET(req: Request) {
  try {
    const { data: d } = await review(req);
    return json({
      reviewer: d.reviewer,
      role: d.role,
      brief: d.brief,
      expiresAt: d.expiresAt,
      submitted: d.submitted,
      opinion: d.opinion || '',
      dissent: d.dissent || '',
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    origin(req);
    const r = await review(req);
    if (r.data.submitted)
      throw new HttpError(
        409,
        '이미 제출한 의견입니다. 추가 의견은 이사님에게 새 요청을 받아 주세요.',
      );
    const raw = await req.text();
    if (raw.length > 30000) throw new HttpError(413, '의견을 줄여 주세요.');
    const b = JSON.parse(raw),
      opinion = text(b.opinion, '검토 의견', 10000, true),
      dissent = text(b.dissent, '반대·조건', 10000);
    const value = {
      ...r.data,
      opinion,
      dissent,
      submitted: true,
      submittedAt: now(),
    };
    const out = await db()
      .prepare('UPDATE settings SET value=? WHERE key=? AND value=?')
      .bind(JSON.stringify(value), r.key, r.raw)
      .run();
    if (!out.meta.changes)
      throw new HttpError(409, '요청이 변경됐습니다. 다시 불러와 주세요.');
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
