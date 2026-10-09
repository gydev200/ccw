import type { Finance } from './ccfm';
export async function makeFinanceBackup(
  ledger: Finance,
  wallets: { key: string; value: string }[],
  at: string,
) {
  const payload = JSON.stringify({
    format: 'chartclean-finance-backup-v1',
    at,
    ledger,
    wallets,
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  );
  return {
    format: 'chartclean-finance-envelope-v1',
    sha256: Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    payload,
  };
}
export async function verifyFinanceBackup(raw: unknown) {
  const e = raw as any;
  if (
    e?.format !== 'chartclean-finance-envelope-v1' ||
    typeof e.payload !== 'string' ||
    typeof e.sha256 !== 'string'
  )
    throw Error('CCFM 보관본 형식이 아닙니다.');
  const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(e.payload),
    ),
    actual = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  if (actual !== e.sha256) throw Error('보관본 내용과 검증값이 다릅니다.');
  const p = JSON.parse(e.payload);
  if (
    p.format !== 'chartclean-finance-backup-v1' ||
    !Number.isSafeInteger(p.ledger?.version) ||
    !Array.isArray(p.ledger?.journals) ||
    !Array.isArray(p.wallets)
  )
    throw Error('보관 데이터 구조를 확인해 주세요.');
  return p as {
    format: string;
    at: string;
    ledger: Finance;
    wallets: { key: string; value: string }[];
  };
}
