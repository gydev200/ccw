import {updateControl,type Control} from './fm-control';
import {routineTemplates,validateRoutinePolicy,type RoutinePolicy} from './fm-routines';
import type { Member } from './model';
import type { Wallet } from './settlement';
export const FINANCE_KEY = 'ccfm:v1';
export const WALLET_PREFIX = 'service-settlement:v1:';
export const ACCOUNTS = {
  cash: '현금·보통예금',
  receivable: '매출채권',
  prepaid: '선급금',
  asset: '유형자산',
  vatIn: '부가세 대급금',
  payable: '미지급금',
  deposit: '고객 선수금',
  withholding: '예수금·원천세',
  vatOut: '부가세 예수금',
  loan: '차입금',
  capital: '자본·기초잔액',
  revenue: '서비스 매출',
  expense: '일반 관리비',
  labor: '급여·인건비',
  outsourcing: '외주비',
  tax: '세금과공과',
} as const;
export type Account = keyof typeof ACCOUNTS;
export type Line = { account: Account; debit: number; credit: number };
export type Tax = {
  type: 'standard' | 'zero' | 'exempt' | 'outside' | 'unknown';
  effect?: 'increase' | 'decrease';
  direction: 'sale' | 'purchase';
  supplyDate: string;
  base: number | null;
  vat: number | null;
  deductible: boolean;
  basis: string;
};
export type Source = {
  key: string;
  ref: string;
  date: string;
  amount: number;
  cash: number;
  label: string;
  evidence: string;
  fingerprint: string;
  kind: string;
  reverses?: string;
};
export type Journal = {
  id: string;
  date: string;
  ref: string;
  description: string;
  evidence: string;
  person: string;
  org: string;
  lines: Line[];
  tax: Tax;
  sourceKey?: string;
  sourceFingerprint?: string;
  reverses?: string;
  actor: string;
  at: string;
};
export type WorkItem = {
  routineKey?:string;
  id: string;
  kind: 'task' | 'invoice';
  title: string;
  person: string;
  org: string;
  due: string;
  status: string;
  direction?: 'receive' | 'issue';
  base?: number | null;
  vat?: number | null;
  party?: string;
  sourceKey?: string;
  journalId?: string;
  externalNumber?: string;
  evidence: string;
  history: {
    at: string;
    actor: string;
    status: string;
    note: string;
    before?: any;
    after?: any;
  }[];
};
export type BotReport = {
  id: string;
  question: string;
  at: string;
  date: string;
  sourceVersion: number;
  backupVersion: number;
  cashIn: number;
  cashOut: number;
  pending: number;
  unknownTax: number;
  sourceKeys: string[];
  journalIds: string[];
  openWorkIds: string[];
  basis: '저장 원장 규칙 집계 · AI 미연결';
};
export type Finance = {
  control?:Control;
  routinePolicy?:RoutinePolicy;
  version: number;
  journals: Journal[];
  requests: Record<string, string>;
  work?: WorkItem[];
  reports?: BotReport[];
};
export const emptyFinance = (): Finance => ({
  version: 0,
  journals: [],
  requests: {},
});
export function financeAccess(m: Member) {
  return m.active === 1 && m.role === 'DO';
}
export function kstDate(at = new Date().toISOString()) {
  return new Date(new Date(at).getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 10);
}
function text(v: unknown, label: string, max = 500) {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw Error(label + '을 확인해 주세요.');
  return v.trim();
}
export function day(v: unknown, today = '9999-12-31') {
  const s = text(v, '날짜', 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s ||
    s > today
  )
    throw Error('유효한 날짜를 입력해 주세요.');
  return s;
}
function money(v: unknown) {
  if (
    typeof v !== 'number' ||
    !Number.isSafeInteger(v) ||
    v < 0 ||
    v > 1000000000
  )
    throw Error('금액은 0~10억원 정수로 입력해 주세요.');
  return v;
}
export function vatCalculation(base: unknown, type: string) {
  const n = money(base);
  if (type === 'unknown') return null;
  if (!['standard', 'zero', 'exempt', 'outside'].includes(type))
    throw Error('과세 구분을 확인해 주세요.');
  return type === 'standard' ? Math.floor(n / 10) : 0;
}
export function sourcesFromWallets(
  rows: { key: string; value: string }[],
): Source[] {
  const out: Source[] = [];
  for (const row of rows) {
    const w: Wallet = JSON.parse(row.value);
    const hospital = row.key.slice(WALLET_PREFIX.length);
    const prefix = 'settlement:' + hospital + ':';
    for (const t of (w.trades || []).filter((t) => t.kind !== 'apply')) {
      const target =
        t.kind === 'reversal'
          ? (w.trades || []).find((x) => x.id === t.targetId)
          : undefined;
      if (target?.kind === 'apply') continue;
      const signed = (kind: string, n: number) =>
        kind === 'receipt' ? n : ['refund', 'expense'].includes(kind) ? -n : 0;
      out.push({
        key: prefix + 'trade:' + t.id,
        ref: t.ref,
        date: t.date,
        amount: t.amount,
        cash: target
          ? -signed(target.kind, target.amount)
          : signed(t.kind, t.amount),
        label: '병원 #' + hospital + ' · ' + t.description,
        evidence: t.evidence,
        fingerprint: JSON.stringify(t),
        kind: t.kind,
        ...(target ? { reverses: prefix + 'trade:' + target.id } : {}),
      });
    }
    for (const e of w.events.filter((e) =>
      ['charge', 'refund', 'usage'].includes(e.kind),
    )) {
      out.push({
        key: prefix + 'event:' + e.id,
        ref: e.ref || e.id,
        date: kstDate(e.at),
        amount: e.amount,
        cash:
          e.kind === 'charge' ? e.amount : e.kind === 'refund' ? -e.amount : 0,
        label:
          '병원 #' +
          hospital +
          ' · ' +
          { charge: '발송 충전', refund: '발송 환불', usage: '발송 사용 확정' }[
            e.kind
          ],
        evidence: e.note,
        fingerprint: JSON.stringify(e),
        kind: e.kind,
      });
    }
  }
  return out;
}
export function reduceFinance(
  before: Finance,
  c: any,
  actor: Member,
  sources: Source[],
  people: string[],
  orgs: string[],
  at = new Date().toISOString(),
): Finance {
  if (!financeAccess(actor))
    throw Error('CCFM 재무관리은 이사님 내부 권한이 필요합니다.');
  const id = text(c.requestId, '요청 번호', 100),
    fingerprint = JSON.stringify({ ...c, version: undefined });
  if (before.requests[id]) {
    if (before.requests[id] !== fingerprint)
      throw Error('같은 요청 번호의 내용이 다릅니다.');
    return before;
  }
  if (c.version !== before.version)
    throw Error('다른 변경이 먼저 저장됐습니다. 새로고침해 주세요.');
  if (before.journals.length >= 2000)
    throw Error('원장 보관 한도입니다. 백업 후 기간 분리를 요청해 주세요.');
  const today = kstDate(at),
    date = day(c.date, today);
  if (['createWork', 'updateWork', 'botReport','financialControl','ensureRoutines','configureRoutines'].includes(c.action))
    return reduceWork(
      before,
      c,
      actor,
      sources,
      people,
      orgs,
      at,
      id,
      fingerprint,
      date,
    );
  let journal: Journal;
  if (c.action === 'reverse') {
    const target = before.journals.find((j) => j.id === c.targetId);
    if (
      !target ||
      target.reverses ||
      before.journals.some((j) => j.reverses === target.id)
    )
      throw Error('정정 가능한 원전표를 선택해 주세요.');
    if (date < target.date)
      throw Error('정정일은 원전표 날짜 이후여야 합니다.');
    journal = {
      ...structuredClone(target),
      id,
      date,
      ref: 'REV:' + id,
      description: '정정: ' + text(c.reason, '정정 사유'),
      reverses: target.id,
      lines: target.lines.map((l) => ({
        account: l.account,
        debit: l.credit,
        credit: l.debit,
      })),
      actor: actor.id,
      at,
    };
  } else if (c.action === 'post') {
    const a = c.journal || {},
      ref = text(a.ref, '증빙 거래번호', 100);
    if (ref.startsWith('REV:'))
      throw Error('정정 전용 번호는 사용할 수 없습니다.');
    if (
      before.journals.some(
        (j) =>
          j.ref === ref &&
          (!a.sourceKey || !before.journals.some((r) => r.reverses === j.id)),
      )
    )
      throw Error('이미 기록된 거래번호입니다. 원전표를 정정해 주세요.');
    const person = text(a.person, '직원 ID', 100),
      org = text(a.org, '조직 ID', 20);
    if (!people.includes(person) || !orgs.includes(org))
      throw Error('CCHR 공통 직원·조직 목록에서 선택해 주세요.');
    if (!Array.isArray(a.lines) || a.lines.length < 2 || a.lines.length > 20)
      throw Error('분개는 2~20줄로 입력해 주세요.');
    const lines: Line[] = a.lines.map((l: any) => {
      if (!Object.hasOwn(ACCOUNTS, l.account))
        throw Error('계정과목을 확인해 주세요.');
      const debit = money(l.debit),
        credit = money(l.credit);
      if (debit > 0 === credit > 0)
        throw Error('한 줄에는 차변 또는 대변 한쪽에만 금액을 넣으세요.');
      return { account: l.account, debit, credit };
    });
    const total = lines.reduce((n, l) => n + l.debit, 0);
    if (
      !total ||
      total !== lines.reduce((n, l) => n + l.credit, 0) ||
      !Number.isSafeInteger(total)
    )
      throw Error('차변과 대변 합계가 같아야 합니다.');
    const t = a.tax || {};
    if (
      !['standard', 'zero', 'exempt', 'outside', 'unknown'].includes(t.type) ||
      !['sale', 'purchase'].includes(t.direction)
    )
      throw Error('세금 구분을 확인해 주세요.');
    if (t.effect !== undefined && !['increase', 'decrease'].includes(t.effect))
      throw Error('세액 증감 구분을 확인해 주세요.');
    const tax: Tax = {
      type: t.type,
      effect: t.effect || 'increase',
      direction: t.direction,
      supplyDate: day(t.supplyDate, today),
      base: t.base === null ? null : money(t.base),
      vat: t.vat === null ? null : money(t.vat),
      deductible: t.deductible === true,
      basis: text(t.basis, '과세 판단 근거', 1000),
    };
    if (tax.type === 'unknown') {
      if (tax.base !== null || tax.vat !== null || tax.deductible)
        throw Error('미확인 세금은 금액을 확정하지 마세요.');
      if (lines.some((l) => ['vatIn', 'vatOut'].includes(l.account)))
        throw Error('미확인 세금은 부가세 계정에 확정 입력할 수 없습니다.');
    } else {
      if (tax.base === null || tax.vat === null)
        throw Error('공급가액과 증빙 세액이 필요합니다.');
      const calculated = vatCalculation(tax.base, tax.type)!;
      if (Math.abs(calculated - tax.vat) > 1)
        throw Error('세액을 공급가액·증빙과 다시 대조해 주세요.');
      if (tax.type !== 'standard' && tax.vat !== 0)
        throw Error('이 구분의 세액은 0원이어야 합니다.');
      if (
        tax.deductible &&
        (tax.direction !== 'purchase' || tax.type !== 'standard')
      )
        throw Error('공제 여부는 일반 과세 매입에서만 선택합니다.');
      const inVat = lines
          .filter((l) => l.account === 'vatIn')
          .reduce((n, l) => n + l.debit - l.credit, 0),
        outVat = lines
          .filter((l) => l.account === 'vatOut')
          .reduce((n, l) => n + l.credit - l.debit, 0);
      const expectedVat = tax.vat * (tax.effect === 'decrease' ? -1 : 1);
      if (
        tax.direction === 'sale'
          ? outVat !== expectedVat || inVat !== 0
          : outVat !== 0 || inVat !== (tax.deductible ? expectedVat : 0)
      )
        throw Error('부가세 계정 분개와 증빙 세액·공제 여부가 다릅니다.');
      if (tax.base + tax.vat !== total && tax.type !== 'outside')
        throw Error('전표 합계와 공급가액·세액 합계가 다릅니다.');
    }
    const sourceKey =
        typeof a.sourceKey === 'string' && a.sourceKey
          ? a.sourceKey
          : undefined,
      source = sources.find((s) => s.key === sourceKey);
    if (sourceKey && !source)
      throw Error('연결할 원본 거래를 찾을 수 없습니다.');
    if (source) {
      if (
        before.journals.some(
          (j) =>
            j.sourceKey === sourceKey &&
            !j.reverses &&
            !before.journals.some((r) => r.reverses === j.id),
        )
      )
        throw Error('이 원본은 이미 회계 전표에 연결됐습니다.');
      if (ref !== source.ref || total !== source.amount)
        throw Error('거래번호·전표 합계는 원본 거래와 일치해야 합니다.');
      if (date !== source.date)
        throw Error('연결 전표 날짜는 원본 거래일과 같아야 합니다.');
      const cash = lines
        .filter((l) => l.account === 'cash')
        .reduce((n, l) => n + l.debit - l.credit, 0);
      if (cash !== source.cash)
        throw Error('출납 분개와 원본 입출금이 다릅니다.');
    } else if (sources.some((s) => s.ref === ref))
      throw Error(
        '기존 서비스 원장 거래입니다. 원본 거래 연결에서 선택해 주세요.',
      );
    journal = {
      id,
      date,
      ref,
      description: text(a.description, '거래 내용'),
      evidence: text(a.evidence, '증빙 위치·확인 근거', 1000),
      person,
      org,
      lines,
      tax,
      actor: actor.id,
      at,
      ...(source ? { sourceKey, sourceFingerprint: source.fingerprint } : {}),
    };
  } else throw Error('지원하지 않는 재무 작업입니다.');
  const after: Finance = {
    ...before,
    version: before.version + 1,
    journals: [...before.journals, journal],
    requests: { ...before.requests, [id]: fingerprint },
  };
  if (JSON.stringify(after).length > 1500000)
    throw Error('원장 용량 한도입니다. 기간 분리를 요청해 주세요.');
  return after;
}
export function financeReport(
  ledger: Finance,
  sources: Source[],
  date: string,
) {
  day(date);
  const journals = ledger.journals.filter((j) => j.date <= date),
    daily = journals.filter((j) => j.date === date);
  const accounts = Object.entries(ACCOUNTS).map(([account, label]) => {
    const lines = journals
      .flatMap((j) => j.lines)
      .filter((l) => l.account === account);
    return {
      account,
      label,
      debit: lines.reduce((n, l) => n + l.debit, 0),
      credit: lines.reduce((n, l) => n + l.credit, 0),
    };
  });
  const cashRows = [
    ...sources.map((s) => ({
      id: s.key,
      date: s.date,
      ref: s.ref,
      label: s.label,
      cash: s.cash,
      origin: '서비스 원장',
    })),
    ...journals
      .filter((j) => !j.sourceKey)
      .map((j) => ({
        id: j.id,
        date: j.date,
        ref: j.ref,
        label: j.description,
        cash: j.lines
          .filter((l) => l.account === 'cash')
          .reduce((n, l) => n + l.debit - l.credit, 0),
        origin: '회사 전표',
      })),
  ].filter((r) => r.cash !== 0 && r.date <= date);
  const cashDay = cashRows.filter((r) => r.date === date);
  const cashIn = cashDay
      .filter((r) => r.cash > 0)
      .reduce((n, r) => n + r.cash, 0),
    cashOut = -cashDay
      .filter((r) => r.cash < 0)
      .reduce((n, r) => n + r.cash, 0);
  const pending = sources.filter(
    (s) =>
      s.date <= date &&
      s.amount > 0 &&
      !journals.some(
        (j) =>
          j.sourceKey === s.key &&
          !j.reverses &&
          !journals.some((r) => r.reverses === j.id),
      ),
  );
  const changed = journals.filter(
    (j) =>
      j.sourceKey &&
      !j.reverses &&
      !journals.some((r) => r.reverses === j.id) &&
      sources.find((s) => s.key === j.sourceKey)?.fingerprint !==
        j.sourceFingerprint,
  );
  const refs = new Map<string, Set<string>>();
  for (const s of sources) {
    const list = refs.get(s.ref) || new Set();
    list.add(s.key);
    refs.set(s.ref, list);
  }
  for (const j of journals.filter((j) => !j.sourceKey && !j.reverses)) {
    const list = refs.get(j.ref) || new Set();
    list.add(j.id);
    refs.set(j.ref, list);
  }
  const collisions = [...refs]
    .filter(([, keys]) => keys.size > 1)
    .map(([ref]) => ref);
  const month = date.slice(0, 7),
    taxRows = journals.filter((j) => j.tax.supplyDate.startsWith(month));
  const vatOutput = taxRows.reduce(
      (n, j) =>
        n +
        (j.tax.direction === 'sale'
          ? (j.reverses ? -1 : 1) *
            (j.tax.effect === 'decrease' ? -1 : 1) *
            (j.tax.vat || 0)
          : 0),
      0,
    ),
    vatInput = taxRows.reduce(
      (n, j) =>
        n +
        (j.tax.deductible
          ? (j.reverses ? -1 : 1) *
            (j.tax.effect === 'decrease' ? -1 : 1) *
            (j.tax.vat || 0)
          : 0),
      0,
    );
  return {
    date,
    version: ledger.version,
    daily,
    accounts,
    cashRows: cashDay,
    allCashRows: cashRows,
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    recordedCumulative: cashRows.reduce((n, r) => n + r.cash, 0),
    bankBalance: null,
    pending,
    changed,
    collisions,
    vat: {
      month,
      output: vatOutput,
      input: vatInput,
      difference: vatOutput - vatInput,
      unknown: taxRows.filter(
        (j) =>
          j.tax.type === 'unknown' &&
          !j.reverses &&
          !journals.some((r) => r.reverses === j.id),
      ).length,
    },
    debit: daily.flatMap((j) => j.lines).reduce((n, l) => n + l.debit, 0),
    credit: daily.flatMap((j) => j.lines).reduce((n, l) => n + l.credit, 0),
  };
}

function reduceWork(
  before: Finance,
  c: any,
  actor: Member,
  sources: Source[],
  people: string[],
  orgs: string[],
  at: string,
  id: string,
  fingerprint: string,
  date: string,
): Finance {
  const after: Finance = structuredClone(before);
  after.work ??= [];
  after.reports ??= [];
  if(c.action==='financialControl'){after.control=updateControl(before.control,c,actor.id,at,date,people);
  }else if(c.action==='configureRoutines'){after.routinePolicy=validateRoutinePolicy(c.policy,people);
  }else if(c.action==='ensureRoutines'){
    const person=text(c.person,'담당 직원',100),due=day(c.due);
    if(!people.includes(person)||!orgs.includes('DSS'))throw Error('담당 직원·조직을 확인해 주세요.');
    const fresh=routineTemplates(c.cycle,date).filter(t=>!after.work!.some(w=>w.routineKey===t.key));
    if(after.work.length+fresh.length>2000)throw Error('업무 보관 한도입니다.');
    for(const t of fresh){const evidence=('내부 점검 기한이며 법정 신고·납부일이 아닙니다. '+t.basis).slice(0,1000);after.work.push({id:t.key,routineKey:t.key,kind:'task',title:'['+t.period+'] '+t.title,person,org:'DSS',due,status:'대기',evidence,history:[{at,actor:actor.id,status:'등록',note:evidence}]});}
  }else if (c.action === 'botReport') {
    const r = financeReport(before, sources, date);
    if (after.reports.length >= 500) throw Error('보고 보관 한도입니다.');
    after.reports.push({
      id,
      question: text(c.question, '상담·보고 요청', 2000),
      at,
      date,
      sourceVersion: before.version,
      backupVersion: before.version + 1,
      cashIn: r.cashIn,
      cashOut: r.cashOut,
      pending: r.pending.length,
      unknownTax: r.vat.unknown,
      sourceKeys: sources.filter((s) => s.date <= date).map((s) => s.key),
      journalIds: before.journals
        .filter((j) => j.date <= date)
        .map((j) => j.id),
      openWorkIds: after.work
        .filter(
          (w) =>
            !['완료', '외부 발행 확인', '수취 확인', '취소'].includes(w.status),
        )
        .map((w) => w.id),
      basis: '저장 원장 규칙 집계 · AI 미연결',
    });
  } else if (c.action === 'createWork') {
    if (after.work.length >= 2000) throw Error('업무 보관 한도입니다.');
    const a = c.item || {},
      kind = a.kind;
    if (!['task', 'invoice'].includes(kind))
      throw Error('업무 종류를 확인해 주세요.');
    const person = text(a.person, '담당 직원', 100),
      org = text(a.org, '조직', 20);
    if (!people.includes(person) || !orgs.includes(org))
      throw Error('CCHR 공통 직원·조직을 선택해 주세요.');
    const item: WorkItem = {
      id,
      kind,
      title: text(a.title, '업무명'),
      person,
      org,
      due: day(a.due),
      status:
        kind === 'task'
          ? '대기'
          : a.direction === 'receive'
            ? '수취 대기'
            : '발행 요청',
      evidence: text(a.evidence, '근거·확인할 사항', 1000),
      history: [
        {
          at,
          actor: actor.id,
          status: '등록',
          note: text(a.evidence, '근거', 1000),
        },
      ],
    };
    if (a.sourceKey) {
      if (!sources.some((s) => s.key === a.sourceKey))
        throw Error('서비스 원본 연결을 확인해 주세요.');
      item.sourceKey = a.sourceKey;
    }
    if (a.journalId) {
      if (!before.journals.some((j) => j.id === a.journalId))
        throw Error('연결 전표를 확인해 주세요.');
      item.journalId = a.journalId;
    }
    if (kind === 'invoice') {
      if (!['receive', 'issue'].includes(a.direction))
        throw Error('수취 또는 발행요청을 선택해 주세요.');
      item.direction = a.direction;
      item.party = text(a.party, '거래처');
      item.base = a.base === null ? null : money(a.base);
      item.vat = a.vat === null ? null : money(a.vat);
      if ((item.base === null) !== (item.vat === null))
        throw Error('미확인 공급가액·세액은 함께 비워 주세요.');
      if (
        (item.sourceKey || item.journalId) &&
        after.work.some(
          (w) =>
            w.kind === 'invoice' &&
            w.status !== '취소' &&
            w.direction === item.direction &&
            ((item.sourceKey && w.sourceKey === item.sourceKey) ||
              (item.journalId && w.journalId === item.journalId)),
        )
      )
        throw Error('같은 원본의 세금계산서 관리 항목이 이미 있습니다.');
    }
    item.history[0].after = {
      status: item.status,
      base: item.base,
      vat: item.vat,
      evidence: item.evidence,
    };
    after.work.push(item);
  } else {
    const item = after.work.find((w) => w.id === c.id);
    if (!item) throw Error('업무를 찾을 수 없습니다.');
    const previous = {
      status: item.status,
      base: item.base,
      vat: item.vat,
      evidence: item.evidence,
      externalNumber: item.externalNumber,
    };
    const next = text(c.status, '처리 상태', 40),
      note = text(c.note, '처리 근거', 1000);
    const transitions: Record<string, string[]> =
      item.kind === 'task'
        ? {
            대기: ['진행', '보류', '취소'],
            진행: ['완료', '보류', '취소'],
            보류: ['진행', '취소'],
            완료: ['진행'],
            취소: [],
          }
        : item.direction === 'receive'
          ? {
              '수취 대기': ['검토 중', '취소'],
              '검토 중': ['수취 확인', '보류', '취소'],
              보류: ['검토 중', '취소'],
              '수취 확인': [],
              취소: [],
            }
          : {
              '발행 요청': ['검토 중', '취소'],
              '검토 중': ['발행 준비', '보류', '취소'],
              보류: ['검토 중', '취소'],
              '발행 준비': ['외부 발행 확인', '검토 중', '취소'],
              '외부 발행 확인': [],
              취소: [],
            };
    if (!transitions[item.status]?.includes(next))
      throw Error('현재 상태에서 변경할 수 없는 단계입니다.');
    if (item.kind === 'invoice' && c.base !== undefined) {
      item.base = c.base === null ? null : money(c.base);
      item.vat = c.vat === null ? null : money(c.vat);
    }
    if (
      item.kind === 'invoice' &&
      ['발행 준비', '수취 확인', '외부 발행 확인'].includes(next) &&
      (item.base === null || item.vat === null)
    )
      throw Error('증빙 공급가액·세액을 먼저 확인해 주세요.');
    if (['수취 확인', '외부 발행 확인'].includes(next)) {
      const number = text(c.externalNumber, '실제 세금계산서 승인번호', 100),
        evidence = text(c.evidence, '외부 발행·수취 증빙', 1000);
      if (
        after.work.some((w) => w.id !== item.id && w.externalNumber === number)
      )
        throw Error('이미 기록한 세금계산서 승인번호입니다.');
      item.externalNumber = number;
      item.evidence = evidence;
    }
    if (
      item.kind === 'invoice' &&
      ['발행 준비', '수취 확인', '외부 발행 확인'].includes(next)
    ) {
      const linkedSource = sources.find((s) => s.key === item.sourceKey),
        linkedJournal = before.journals.find((j) => j.id === item.journalId);
      const gross = item.base! + item.vat!;
      if (linkedSource && linkedSource.amount !== gross)
        throw Error('세금계산서 합계와 연결 서비스 원본 금액이 다릅니다.');
      if (
        linkedJournal &&
        linkedJournal.lines.reduce((n, l) => n + l.debit, 0) !== gross
      )
        throw Error('세금계산서 합계와 연결 전표 금액이 다릅니다.');
    }
    item.status = next;
    item.history.push({
      at,
      actor: actor.id,
      status: next,
      note,
      before: previous,
      after: {
        status: item.status,
        base: item.base,
        vat: item.vat,
        evidence: item.evidence,
        externalNumber: item.externalNumber,
      },
    });
  }
  after.version++;
  after.requests[id] = fingerprint;
  if (JSON.stringify(after).length > 1500000)
    throw Error('보관 용량 한도입니다.');
  return after;
}
