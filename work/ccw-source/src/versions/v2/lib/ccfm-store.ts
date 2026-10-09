import { makeFinanceBackup } from './ccfm-backup';
import { FINANCE_KEY, WALLET_PREFIX, emptyFinance, type Finance } from './ccfm';
// All writers must use the compare-and-swap guard. D1 batch is transactional.
export async function financeSnapshot(database: D1Database) {
  const rows = await database
    .prepare(
      'SELECT key,value FROM settings WHERE key=? OR key LIKE ? ORDER BY key',
    )
    .bind(FINANCE_KEY, WALLET_PREFIX + '%')
    .all<{ key: string; value: string }>();
  const raw = rows.results.find((r) => r.key === FINANCE_KEY)?.value;
  return {
    raw,
    ledger: raw ? (JSON.parse(raw) as Finance) : emptyFinance(),
    wallets: rows.results.filter((r) => r.key.startsWith(WALLET_PREFIX)),
  };
}
export async function saveFinance(
  database: D1Database,
  snapshot: Awaited<ReturnType<typeof financeSnapshot>>,
  after: Finance,
  at: string,
) {
  const value = JSON.stringify(after),
    walletJSON = JSON.stringify(
      snapshot.wallets.map((r) => ({ key: r.key, value: r.value })),
    );
  const guard =
    "COALESCE((SELECT value FROM settings WHERE key='ccfm:v1'),'')=? AND (SELECT json_group_array(json_object('key',key,'value',value)) FROM (SELECT key,value FROM settings WHERE key LIKE 'service-settlement:v1:%' ORDER BY key))=?";
  const save = database
    .prepare(
      `INSERT INTO settings (key,value) SELECT ?,? WHERE ${guard} ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    )
    .bind(FINANCE_KEY, value, snapshot.raw || '', walletJSON);
  // Immutable revision snapshots include referenced source wallets for isolated restore/reconciliation.
  const backup = JSON.stringify(
    await makeFinanceBackup(after, snapshot.wallets, at),
  );
  const result = await database.batch([
    save,
    database
      .prepare('INSERT INTO settings (key,value) SELECT ?,? WHERE changes()>0')
      .bind('ccfm:backup:' + after.version, backup),
  ]);
  return result[0].meta.changes > 0;
}
export function assertSettlementReference(
  ledger: Finance,
  c: any,
  wallets: { key: string; value: string }[] = [],
) {
  const raw =
    c.action === 'trade'
      ? c.trade?.ref
      : ['charge', 'refund', 'cost'].includes(c.action)
        ? c.ref || c.cost?.ref
        : undefined;
  const ref = typeof raw === 'string' ? raw.trim() : '';
  if (!ref) return;
  if (ledger.journals.some((j) => j.ref === ref))
    throw Error(
      'CCFM 재무관리에 이미 연결된 거래번호입니다. 원전표와 대조해 주세요.',
    );
  for (const row of wallets) {
    const w = JSON.parse(row.value);
    if (
      [
        ...(w.trades || []),
        ...(w.costEntries || []),
        ...(w.events || []).filter((e: any) =>
          ['charge', 'refund'].includes(e.kind),
        ),
      ].some((e: any) => e.ref === ref)
    )
      throw Error(
        '기존 서비스 원장에 있는 거래번호입니다. 병원 간 중복 여부를 대조해 주세요.',
      );
  }
}
