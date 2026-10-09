import {env} from '@/versions/v2/lib/runtime';
import {validateOrder} from './work-orders';

// One fixed owner-requested work order. No recipient data or dispatch operation.
export const orderKey = 'work-order:kyunghwa-planme-20260918-30';
export const order = validateOrder({
  org: 'SS', assignee: 'kyunghwa', date: '2026-09-18',
  due: '2026-09-18T18:00', deadlineProposed: true,
  title: '플랜미 발송 예정 60명',
  instruction: '오늘(9월 18일) 플랜미 발송 예정 인원은 60명입니다. 기존 업무 절차에 따라 발송 준비 현황을 확인하고 진행 결과를 남겨 주세요.',
  criterion: '플랜미 60명 발송 준비 현황과 진행 결과 기록. 예정과 실제 발송 결과를 구분해 주세요.',
  sourceTitle: '전무이사 업무 지시', sourceUrl: '',
});
let initialized: Promise<void> | undefined;
export async function ensurePlanmeSeptember18Order() {
  if (!env.DB) return;
  if (!initialized) initialized = (async () => {
    const at = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE records SET data=json_set(data,'$.title',?,'$.instruction',?,'$.criterion',?),version=version+1,updated_at=? WHERE dedup=? AND json_extract(data,'$.title')='플랜미 발송 예정 30명'").bind(order.title,order.instruction,order.criterion,at,orderKey),
      env.DB.prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT id,org,'owner-request:20260918','오늘 목표 60명으로 변경',?,? FROM records WHERE dedup=? AND changes()>0").bind(JSON.stringify({previousTarget:30,target:60,actualSent:0}),at,orderKey),
      env.DB.prepare("INSERT INTO records(kind,org,assignee,data,dedup,created_at,updated_at) VALUES('work_order',?,?,?,?,?,?) ON CONFLICT(dedup) DO NOTHING")
        .bind(order.org, order.assignee, JSON.stringify(order), orderKey, at, at),
      env.DB.prepare("INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT id,org,'owner-request:20260918','업무 지시 추가',?,? FROM records WHERE dedup=? AND changes()>0")
        .bind(JSON.stringify({title: order.title, source: '전무이사 서버 반영 지시', actualSent: 0}), at, orderKey),
    ]);
  })().catch(error => { initialized = undefined; throw error; });
  try { await initialized; } catch { console.error('Scheduled work order initialization failed'); }
}
