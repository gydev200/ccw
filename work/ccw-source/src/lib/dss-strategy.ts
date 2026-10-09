export const STRATEGY_KEY = 'dss:strategy:v1';
export const LENSES = [
  '문제·이상',
  '미래·기회',
  '경영요소 통합',
  '고객여정',
  '산업·쇠퇴',
  '세상 변화',
] as const;
export const DOMAINS = ['경영', '인사', '재무', '법무', '정보전략', '보안', '총무'] as const;
export type Lens = (typeof LENSES)[number];
export type Scenario = {
  name: string;
  customers: number | null;
  price: number | null;
  variable: number | null;
  fixed: number | null;
  investment: number | null;
  cash: number | null;
  hours: number | null;
  capacity: number | null;
};
export type Option = {
  id: string;
  name: string;
  basis: string;
  benefit: string;
  risk: string;
  people: string;
  cash: string;
  customer: string;
  information: string;
  security: string;
  reversible: string;
  scenario: Scenario;
};
export type ReviewNote = {
  id: string;
  author: string;
  role: string;
  opinion: string;
  dissent: string;
  source: string;
  at: string;
};
export type Agenda = {
  workflow?: {stage:'준비'|'상신'|'결정'|'배정';submittedAt?:string;submittedRevision?:number;recommendation?:string;report?:{summary:string;executionVersion:number;at:string}};
  id: string;
  revision: number;
  title: string;
  lens: Lens;
  domain: string;
  question: string;
  evidence: string;
  sourceUrl: string;
  goalId: string;
  criteria: string;
  deadline: string;
  status: string;
  options: Option[];
  selected: string;
  reason: string;
  reviewDate: string;
  stopRule: string;
  executionKey: string;
  notes: ReviewNote[];
  createdAt: string;
  updatedAt: string;
};
export type Direction = {
  id: string;
  direction: string;
  target: string;
  measure: string;
  horizon: string;
  guardrail: string;
  changeTrigger: string;
  reason: string;
  at: string;
};
export type RegisterItem = {
  id: string;
  kind: 'information' | 'security';
  name: string;
  owner: string;
  purpose: string;
  classification: string;
  source: string;
  status: string;
  next: string;
  due: string;
  updatedAt: string;
};
export type Strategy = {
  version: number;
  directions: Direction[];
  agendas: Agenda[];
  register: RegisterItem[];
  history: { at: string; actor: string; action: string; id: string }[];
};
export const emptyStrategy = (): Strategy => ({
  version: 0,
  directions: [],
  agendas: [],
  register: [],
  history: [],
});
export const blankScenario = (name = '기준'): Scenario => ({
  name,
  customers: null,
  price: null,
  variable: null,
  fixed: null,
  investment: null,
  cash: null,
  hours: null,
  capacity: null,
});
export const blankOption = (name: string): Option => ({
  id: crypto.randomUUID(),
  name,
  basis: '',
  benefit: '',
  risk: '',
  people: '',
  cash: '',
  customer: '',
  information: '',
  security: '',
  reversible: '',
  scenario: blankScenario(name),
});
export const blankAgenda = (lens: Lens = LENSES[0]): Agenda => ({
  id: crypto.randomUUID(),
  revision: 0,
  title: '',
  lens,
  domain: '경영',
  question: '',
  evidence: '',
  sourceUrl: '',
  goalId: '',
  criteria: '',
  deadline: '',
  status: '검토 중',
  options: [
    blankOption('현상 유지'),
    blankOption('대안 A'),
    blankOption('대안 B'),
  ],
  selected: '',
  reason: '',
  reviewDate: '',
  stopRule: '',
  executionKey: '',
  notes: [],
  createdAt: '',
  updatedAt: '',
});
export function text(v: unknown, label: string, max = 6000, required = false) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    throw Error(label + '을(를) 확인해 주세요.');
  return v.trim();
}
export function day(v: unknown, label: string, required = false) {
  const s = text(v, label, 10, required);
  if (
    s &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s)
  )
    throw Error(label + '을(를) 확인해 주세요.');
  return s;
}
export function safeUrl(v: unknown) {
  const s = text(v || '', '근거 주소', 2000);
  if (s) {
    const u = new URL(s);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
      throw Error('http 또는 https 근거 주소를 입력해 주세요.');
  }
  return s;
}
export function simulate(s: Scenario) {
  const vals = [
    s.customers,
    s.price,
    s.variable,
    s.fixed,
    s.investment,
    s.cash,
    s.hours,
    s.capacity,
  ];
  if (vals.some((v) => v === null)) return null;
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0))
    throw Error('가정값은 0 이상의 유한한 수로 입력해 주세요.');
  const revenue = s.customers! * s.price!,
    cost = s.customers! * s.variable! + s.fixed!,
    monthly = revenue - cost,
    available = s.cash! - s.investment!,
    load = s.customers! * s.hours!;
  return {
    revenue,
    cost,
    monthly,
    available,
    runway: available < 0 ? 0 : monthly < 0 ? available / -monthly : null,
    load,
    remaining: s.capacity! - load,
  };
}
function validateScenario(raw: Scenario): Scenario {
  const out = { name: text(raw.name, '시나리오명', 100) } as Scenario;
  for (const key of [
    'customers',
    'price',
    'variable',
    'fixed',
    'investment',
    'cash',
    'hours',
    'capacity',
  ] as const) {
    const v = raw[key];
    if (
      v !== null &&
      (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12)
    )
      throw Error('가정값의 범위를 확인해 주세요.');
    out[key] = v;
  }
  return out;
}
export function validateAgenda(raw: Agenda, old?: Agenda): Agenda {
  if (
    !LENSES.includes(raw.lens) ||
    !DOMAINS.includes(raw.domain as (typeof DOMAINS)[number])
  )
    throw Error('안건의 관점을 선택해 주세요.');
  if (
    !Array.isArray(raw.options) ||
    raw.options.length < 2 ||
    raw.options.length > 5
  )
    throw Error('대안을 2~5개 작성해 주세요.');
  const options = raw.options.map((o) => {
    const x = {
      id: text(o.id, '대안 번호', 100, true),
      scenario: validateScenario(o.scenario),
    } as Option;
    for (const k of [
      'name',
      'basis',
      'benefit',
      'risk',
      'people',
      'cash',
      'customer',
      'information',
      'security',
      'reversible',
    ] as const)
      x[k] = text(
        o[k],
        k === 'name' ? '대안 이름' : '대안 내용',
        3000,
        k === 'name',
      );
    return x;
  });
  if (new Set(options.map((o) => o.id)).size !== options.length)
    throw Error('대안 번호가 중복됐습니다.');
  const a = {
    ...raw,
    id: text(raw.id, '안건 번호', 100, true),
    title: text(raw.title, '안건명', 250, true),
    question: text(raw.question, '결정할 질문', 3000, true),
    evidence: text(raw.evidence, '근거', 10000),
    sourceUrl: safeUrl(raw.sourceUrl),
    criteria: text(raw.criteria, '결정 기준', 6000),
    goalId: text(raw.goalId, '목표 연결', 100),
    deadline: day(raw.deadline, '결정 기한'),
    selected: text(raw.selected, '선택한 대안', 100),
    reason: text(raw.reason, '결정 이유', 6000),
    reviewDate: day(raw.reviewDate, '재검토일'),
    stopRule: text(raw.stopRule, '중단·수정 기준', 3000),
    options,
    workflow: old?.workflow || {stage:'준비' as const},
    executionKey: old?.executionKey || '',
    notes: old?.notes || [],
    createdAt: old?.createdAt || '',
    revision: old?.revision || 0,
  };
  if (!['검토 중', '결정', '보류', '재검토'].includes(a.status))
    throw Error('안건 상태를 확인해 주세요.');
  if (
    a.status === '결정' &&
    (!a.criteria ||
      !a.reason ||
      !a.reviewDate ||
      !a.stopRule ||
      !options.some((o) => o.id === a.selected))
  )
    throw Error(
      '결정 기준·선택 대안·결정 이유·재검토일·중단 기준을 입력해 주세요.',
    );
  if (old?.executionKey)
    throw Error(
      '실행으로 넘긴 안건은 원본을 보존합니다. 후속 안건으로 변경 판단을 남겨 주세요.',
    );
  return a;
}
export function reduceStrategy(
  before: Strategy,
  action: string,
  data: unknown,
  actor: string,
  at: string,
): Strategy {
  const next = structuredClone(before);
  let id = '';
  if (action === 'agenda') {
    const raw = data as Agenda;
    const old = next.agendas.find((a) => a.id === raw.id);
    const a = validateAgenda(raw, old);
    if(a.status==='결정'&&old?.status!=='결정'&&old?.workflow?.stage!=='상신')throw Error('DSS에서 근거·대안·권고를 준비하여 먼저 상신해 주세요.');
    if(a.status==='결정'&&old&&['title','question','evidence','sourceUrl','criteria','deadline','options','domain'].some(k=>JSON.stringify((a as any)[k])!==JSON.stringify((old as any)[k])))throw Error('상신 근거가 바뀌었습니다. 준비 상태로 저장한 뒤 다시 상신해 주세요.');
    if(a.status==='결정')a.workflow={...a.workflow,stage:'결정'};
    else a.workflow={stage:'준비'};
    a.revision = (old?.revision || 0) + 1;
    a.createdAt = old?.createdAt || at;
    a.updatedAt = at;
    id = a.id;
    if (a.goalId && !next.directions.some((g) => g.id === a.goalId))
      throw Error('연결할 목표를 다시 선택해 주세요.');
    if (old) next.agendas[next.agendas.indexOf(old)] = a;
    else next.agendas.unshift(a);
  } else if (action === 'direction') {
    const d = data as Direction;
    id = crypto.randomUUID();
    next.directions.unshift({
      id,
      direction: text(d.direction, '회사 방향', 3000, true),
      target: text(d.target, '목표', 3000, true),
      measure: text(d.measure, '판단 지표', 3000, true),
      horizon: day(d.horizon, '목표 시점', true),
      guardrail: text(d.guardrail, '지킬 조건', 3000),
      changeTrigger: text(d.changeTrigger, '방향 변경 조건', 3000, true),
      reason: text(d.reason, '설정·변경 이유', 6000, true),
      at,
    });
  } else if (action === 'note') {
    const d = data as ReviewNote & { agendaId: string };
    const a = next.agendas.find((a) => a.id === d.agendaId);
    if (!a) throw Error('안건을 선택해 주세요.');
    id = a.id;
    a.notes.push({
      id: crypto.randomUUID(),
      author: text(d.author, '검토자', 200, true),
      role: text(d.role, '역할', 100, true),
      opinion: text(d.opinion, '검토 의견', 6000, true),
      dissent: text(d.dissent, '반대·조건', 6000),
      source: text(d.source, '원문·회의 근거', 3000, true),
      at,
    });
    a.updatedAt = at;
  } else if (action === 'register') {
    const d = data as RegisterItem;
    if (!['information', 'security'].includes(d.kind))
      throw Error('관리 구분을 선택해 주세요.');
    id = text(d.id, '관리 번호', 100, true);
    const item = {
      id,
      kind: d.kind,
      name: text(d.name, '관리 항목', 250, true),
      owner: text(d.owner, '담당자', 200, true),
      purpose: text(d.purpose, '목적·영향', 4000, true),
      classification: text(d.classification, '중요도', 100),
      source: safeUrl(d.source),
      status: text(d.status, '상태', 100, true),
      next: text(d.next, '다음 조치', 4000, true),
      due: day(d.due, '점검일', true),
      updatedAt: at,
    };
    const index = next.register.findIndex((r) => r.id === id);
    if (index >= 0) next.register[index] = item;
    else next.register.unshift(item);
  } else throw Error('지원하지 않는 작업입니다.');
  next.version++;
  next.history.unshift({ at, actor, action, id });
  return next;
}
