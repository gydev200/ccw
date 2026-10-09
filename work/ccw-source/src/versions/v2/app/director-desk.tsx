'use client';
import { useEffect, useState } from 'react';
import { type RecordRow } from '@/versions/v2/lib/model';
import {
  buildInbox,
  departmentLabel,
  inboxDate,
  isOverdue,
  normalizeArea,
  type InboxItem,
  type InboxState,
} from '@/versions/v2/lib/director-inbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/versions/v2/components/ui/table';
import './director-desk.css';
export { MANAGEMENT_AREAS } from '@/versions/v2/lib/director-inbox';
const boxes: [InboxState, string][] = [
  ['pending', '결재 대기'],
  ['processed', '결재 완료'],
  ['returned', '반려·취소'],
  ['report', '결과 보고'],
];
export default function DirectorDesk({
  area,
  records,
  onTask,
  onAgenda,
  onControl,
  onNavigate,
  onExecution,
}: {
  area: string;
  records: RecordRow[];
  onExecution: (w: any) => void;
  onTask: (id: number) => void;
  onAgenda: (id: string) => void;
  onControl: (r: any) => void;
  onNavigate: (s: string) => void;
}) {
  const [data, setData] = useState<{
    controls: any[];
    agendas: any[];
    topups: any[];
    executions: any[];
    people: any[];
  }>({ controls: [], agendas: [], topups: [], executions: [], people: [] });
  const [errors, setErrors] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [box, setBox] = useState<InboxState>('pending'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('latest');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setErrors([]);
    async function read(path: string) {
      const r = await fetch(path, { signal: abort.signal });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error || '조회 실패');
      return d;
    }
    async function load() {
      const next = {
        controls: [] as any[],
        agendas: [] as any[],
        topups: [] as any[],
        executions: [] as any[],
        people: [] as any[],
      };
      const failures: string[] = [];
      await Promise.all([
        read('/api/control')
          .then((d) => {
            if (!Array.isArray(d.rows)) throw Error('결재 자료 확인 필요');
            next.controls = d.rows;
            next.people = d.people || [];
          })
          .catch((e) => failures.push('결재 요청: ' + e.message)),
        read('/api/dss-strategy')
          .then((d) => {
            if (!Array.isArray(d.strategy?.agendas))
              throw Error('안건 자료 확인 필요');
            next.agendas = d.strategy.agendas;
            next.executions = d.executions || [];
          })
          .catch((e) => failures.push('경영 품의: ' + e.message)),
        read('/api/service-settlement')
          .then((d) => {
            if (!Array.isArray(d.hospitals)) throw Error('정산 자료 확인 필요');
            next.topups = d.hospitals.flatMap((h: any) =>
              (h.wallet?.topups || []).map((t: any) => ({
                ...t,
                hospitalName: h.name,
                hospitalId: h.id,
              })),
            );
          })
          .catch((e) => failures.push('입금 확인: ' + e.message)),
      ]);
      if (!abort.signal.aborted) {
        setData(next);
        setErrors(failures);
        setLoading(false);
      }
    }
    load();
    return () => abort.abort();
  }, [refresh, records]);
  const department = normalizeArea(area),
    today = inboxDate(new Date().toISOString());
  const items = buildInbox({ records, ...data }).filter(
    (item) => department === 'all' || item.department === department,
  );
  const count = (state: InboxState) =>
    items.filter((i) => i.state === state).length;
  const rows = items
    .filter(
      (i) =>
        i.state === box &&
        `${i.id} ${i.title} ${i.person} ${i.type} ${departmentLabel(i.department)}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === 'due'
        ? (a.due || '9999').localeCompare(b.due || '9999')
        : sort === 'amount'
          ? (b.amount ?? -1) - (a.amount ?? -1)
          : 0,
    );
  const overdue = items.filter((i) => isOverdue(i, today)).length;
  function open(item: InboxItem) {
    if (item.source === 'task') onTask(item.raw.id);
    else if (item.source === 'agenda') onAgenda(item.raw.id);
    else if (item.source === 'control') onControl(item.raw);
    else if (item.source === 'execution') onExecution(item.raw);
    else onNavigate('FM:settlement');
  }
  const partial = errors.length > 0;
  return (
    <div className="approval-desk" aria-busy={loading}>
      <header className="approval-heading">
        <div>
          <p>전무이사 결재함</p>
          <h1>
            결재대기 <span>{departmentLabel(department)}</span>
          </h1>
        </div>
        <button
          className="approval-refresh"
          disabled={loading}
          onClick={() => setRefresh((v) => v + 1)}
        >
          {loading ? '불러오는 중' : '새로고침'}
        </button>
      </header>
      <div className="approval-summary">
        <strong>
          {loading ? (
            '결재 문서를 불러오고 있습니다.'
          ) : partial ? (
            '일부 문서를 불러오지 못했습니다.'
          ) : (
            <>
              결재 대기 <b>{count('pending')}</b>건
            </>
          )}
        </strong>
        {!loading && (
          <span>
            {partial
              ? '조회된 문서만 표시합니다.'
              : overdue > 0
                ? `처리기한 지난 문서 ${overdue}건`
                : '부서에서 상신한 문서를 확인해 주세요.'}
          </span>
        )}
      </div>
      {partial && (
        <div className="approval-error" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
          <button onClick={() => setRefresh((v) => v + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      <nav className="approval-boxes" aria-label="결재 문서 상태">
        {boxes.map(([id, label]) => (
          <button key={id} aria-pressed={box === id} onClick={() => setBox(id)}>
            {label}
            <span>
              {loading ? '…' : `${partial ? '확인된 ' : ''}${count(id)}`}
            </span>
          </button>
        ))}
      </nav>
      <section className="approval-list" aria-label="결재 문서 목록">
        <div className="approval-toolbar">
          <label>
            <span className="approval-sr">문서 검색</span>
            <input
              type="search"
              placeholder="제목·담당자·문서번호 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="approval-sr">정렬</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="latest">최근 상신순</option>
              <option value="due">처리기한순</option>
              <option value="amount">금액 높은순</option>
            </select>
          </label>
          <span aria-live="polite">
            {loading
              ? '조회 중'
              : `${partial ? '확인된 ' : ''}${rows.length}건`}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>부서</TableHead>
              <TableHead>문서·제목</TableHead>
              <TableHead>신청·담당자</TableHead>
              <TableHead>상신일</TableHead>
              <TableHead>처리기한</TableHead>
              <TableHead className="approval-money">금액</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading &&
              rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="approval-department">
                      {departmentLabel(item.department)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      className="approval-document"
                      onClick={() => open(item)}
                    >
                      <small>
                        {item.type} · {item.id}
                      </small>
                      <strong>{item.title}</strong>
                    </button>
                  </TableCell>
                  <TableCell>{item.person}</TableCell>
                  <TableCell>{inboxDate(item.submitted)}</TableCell>
                  <TableCell
                    className={
                      isOverdue(item, today) ? 'approval-overdue' : undefined
                    }
                  >
                    {item.due ? inboxDate(item.due) : '미지정'}
                    {isOverdue(item, today) && <small>기한 경과</small>}
                  </TableCell>
                  <TableCell className="approval-money">
                    {item.amount === null
                      ? '해당 없음'
                      : Number.isFinite(item.amount)
                        ? item.amount.toLocaleString('ko-KR') + '원'
                        : '금액 확인 필요'}
                  </TableCell>
                  <TableCell>
                    <span className={'approval-status ' + item.state}>
                      {item.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            {(loading || rows.length === 0) && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="approval-empty">
                    <strong>
                      {loading
                        ? '문서를 불러오고 있습니다.'
                        : partial
                          ? '조회된 문서 중 해당하는 문서가 없습니다.'
                          : query
                            ? '검색 조건에 맞는 문서가 없습니다.'
                            : `${departmentLabel(department)} ${boxes.find((b) => b[0] === box)?.[1]} 문서가 없습니다.`}
                    </strong>
                    <p>
                      {loading
                        ? ''
                        : partial
                          ? '조회 오류를 해결한 뒤 전체 내역을 확인해 주세요.'
                          : query
                            ? '검색어를 바꾸거나 지워 주세요.'
                            : box === 'pending'
                              ? '각 부서에서 상신하면 이 결재함에 표시됩니다.'
                              : '처리된 문서는 해당 상태에 모입니다.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <footer className="approval-footer">
          문서 제목을 누르면 신청 내용·증빙·결재 이력을 확인할 수 있습니다.
        </footer>
      </section>
    </div>
  );
}
