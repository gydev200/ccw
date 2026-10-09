import { NAME, type RecordRow } from './model';
export const MANAGEMENT_AREAS = [
  ['all', '전체'],
  ['finance', '재무'],
  ['personnel', '인사'],
  ['sales', '영업'],
  ['production', '생산'],
  ['planning', '기획'],
  ['general', '총무'],
  ['strategy', '경영'],
] as const;
export type InboxState = 'pending' | 'processed' | 'returned' | 'report';
export type InboxItem = {
  id: string;
  department: string;
  type: string;
  title: string;
  person: string;
  submitted: string;
  due: string;
  amount: number | null;
  status: string;
  state: InboxState;
  source: 'control' | 'task' | 'agenda' | 'topup' | 'execution';
  raw: any;
};
export function normalizeArea(area: string) {
  return (
    (
      {
        DM: 'sales',
        OS: 'sales',
        SS: 'production',
        CA: 'production',
        PM: 'planning',
        PPM: 'planning',
        DSS: 'strategy',
        legal: 'general',
        protection: 'general',
      } as Record<string, string>
    )[area] || area
  );
}
const orgDepartment = (org: string) =>
  (
    ({
      DM: 'sales',
      OS: 'sales',
      SS: 'production',
      CA: 'production',
      PM: 'planning',
      PPM: 'planning',
      FM: 'finance',
      HR: 'personnel',
    }) as Record<string, string>
  )[org] || 'strategy';
const taskDepartment = (r: RecordRow) => {
  const group = /\[DSS:(finance|personnel|legal|protection|general):/.exec(
    String(r.data.notes || ''),
  )?.[1];
  return group ? normalizeArea(group) : orgDepartment(r.org);
};
const domainDepartment = (domain: string) =>
  (
    ({
      재무: 'finance',
      인사: 'personnel',
      영업: 'sales',
      생산: 'production',
      기획: 'planning',
      총무: 'general',
      법무: 'general',
      보안: 'general',
      정보전략: 'general',
    }) as Record<string, string>
  )[domain] || 'strategy';
export const departmentLabel = (id: string) =>
  MANAGEMENT_AREAS.find((a) => a[0] === id)?.[1] || '경영';
export function buildInbox({
  records,
  controls,
  agendas,
  topups,
  executions,
  people = [],
}: {
  records: RecordRow[];
  controls: any[];
  agendas: any[];
  topups: any[];
  executions: any[];
  people?: { id: string; name: string }[];
}): InboxItem[] {
  const name = (id: string) =>
    people.find((p) => p.id === id)?.name || NAME(id) || '미기재';
  const result: InboxItem[] = [];
  for (const r of controls) {
    const correction = r.kind === 'attendance' && r.data.correctionStatus;
    if (!['payment', 'leave', 'access'].includes(r.kind) && !correction)
      continue;
    const status = correction || r.data.status;
    const state: InboxState | undefined =
      status === 'DO 판단 대기'
        ? 'pending'
        : ['승인', '지급 기록', 'DO 정정 완료'].includes(status)
          ? 'processed'
          : ['반려', '취소'].includes(status)
            ? 'returned'
            : undefined;
    if (!state) continue;
    result.push({
      id: `AP-${r.id}`,
      department:
        r.kind === 'payment'
          ? 'finance'
          : ['leave', 'attendance'].includes(r.kind)
            ? 'personnel'
            : 'general',
      type: (
        {
          payment: '지출결의',
          leave: '휴가신청',
          attendance: '근태정정',
          access: '접근권한',
        } as any
      )[r.kind],
      title:
        r.data.title ||
        (r.kind === 'leave'
          ? `${r.data.type || '휴가'} 신청`
          : r.kind === 'attendance'
            ? '출퇴근 기록 정정'
            : '업무 사이트 접근 요청'),
      person: name(r.person),
      submitted: correction
        ? r.history?.findLast((h: any) => h.action === '근태 정정 요청')?.at ||
          (state === 'pending' ? r.updated_at : '')
        : r.created_at,
      due:
        r.kind === 'attendance'
          ? ''
          : r.data.due || r.data.start || r.data.until || '',
      amount: r.kind === 'payment' ? Number(r.data.amount) : null,
      status: state === 'pending' ? '결재 대기' : status,
      state,
      source: 'control',
      raw: r,
    });
  }
  for (const r of records) {
    if (r.kind !== 'task') continue;
    const status = String(r.data.status),
      pending = status.includes('판단');
    // A completed task without a recorded approval is not an approved document.
    const approved =
      r.data.approvedRevision != null &&
      r.data.approvedRevision === r.data.revision;
    if (!pending && !approved) continue;
    result.push({
      id: `CC-${String(r.id).padStart(5, '0')}`,
      department: taskDepartment(r),
      type: status === '등록 판단 대기' ? '업무기안' : '업무결재',
      title: r.data.title,
      person: name(r.data.assignee),
      submitted: r.data.waitSince || '',
      due: r.data.due || '',
      amount: null,
      status: pending ? '결재 대기' : '결재 완료',
      state: pending ? 'pending' : 'processed',
      source: 'task',
      raw: r,
    });
  }
  for (const a of agendas) {
    const pending =
      a.workflow?.stage === '상신' && ['검토 중', '재검토'].includes(a.status);
    const decided = ['결정', '배정'].includes(a.workflow?.stage);
    if (!pending && !decided) continue;
    result.push({
      id: `AG-${a.id}`,
      department: domainDepartment(a.domain),
      type: '경영품의',
      title: a.title,
      person: '미기재',
      submitted: a.workflow?.submittedAt || '',
      due: a.deadline || '',
      amount: null,
      status: pending ? '결재 대기' : '결정 완료',
      state: pending ? 'pending' : 'processed',
      source: 'agenda',
      raw: a,
    });
  }
  for (const t of topups) {
    if (t.status !== 'pending') continue;
    result.push({
      id: `FI-${t.hospitalId}-${t.id}`,
      department: 'finance',
      type: '입금확인',
      title: `${t.hospitalName} 충전 신청`,
      person: t.payer || '미기재',
      submitted: t.at,
      due: '',
      amount: Number(t.amount),
      status: '입금 확인 대기',
      state: 'pending',
      source: 'topup',
      raw: t,
    });
  }
  for (const w of executions) {
    const a = agendas.find((a) => a.executionKey === w.dedup);
    if (
      !a ||
      a.workflow?.report?.executionVersion !== w.version ||
      w.data.status !== '상사 확인 대기'
    )
      continue;
    result.push({
      id: `RP-${w.id}`,
      department: domainDepartment(a.domain),
      type: '결과보고',
      title: a.title,
      person: name(w.data.assignee),
      submitted: a.workflow.report.at || w.updated_at,
      due: a.deadline || '',
      amount: null,
      status: '결과 확인 대기',
      state: 'report',
      source: 'execution',
      raw: w,
    });
  }
  return result.sort(
    (a, b) => (Date.parse(b.submitted) || 0) - (Date.parse(a.submitted) || 0),
  );
}
export function inboxDate(value: string) {
  if (!value) return '미기재';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '미기재'
    : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}
export function isOverdue(item: InboxItem, today: string) {
  return (
    item.state === 'pending' &&
    !!item.due &&
    inboxDate(item.due) !== '미기재' &&
    inboxDate(item.due) < today
  );
}
