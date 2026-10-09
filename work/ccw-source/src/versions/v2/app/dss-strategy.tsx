'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, ArrowUpRight, RotateCw } from 'lucide-react';
import {
  LENSES,
  blankAgenda,
  emptyStrategy,
  type Agenda,
  type Strategy,
  type Lens,
  type Direction,
  type RegisterItem,
} from '@/versions/v2/lib/dss-strategy';
import { kstDay } from '@/versions/v2/lib/work-orders';
import { journeyStage } from './customer-journey';
import AgendaEditor, { InputField, type Review } from './dss-agenda-editor';
import './dss-strategy.css';
type Row = {
  id: number;
  kind: string;
  org: string;
  assignee: string;
  data: Record<string, string>;
};
type Data = {
  strategy: Strategy;
  reviews: Review[];
  executions: (Row & { dedup: string })[];
};
type Props = {
  initialAgendaId?: string;
  section: string;
  state: { records: Row[] };
  onNavigate: (tab: string) => void;
  onTask: (id: number) => void;
};
const labels: Record<string, string> = {
  home: '경영 의사결정',
  agendas: '의사결정 안건',
  direction: '목표·방향',
  advisors: '외부 검토',
  execution: '결정 후 실행',
  information: '정보전략관리',
  security: '보안관리',
};
async function readStrategy() {
  const r = await fetch('/api/dss-strategy');
  const d = (await r.json()) as Data & { error?: string };
  if (!r.ok) throw Error(d.error || '경영 자료를 불러오지 못했습니다.');
  return d;
}
export default function DssStrategy({
  section,
  initialAgendaId,
  state,
  onNavigate,
  onTask,
}: Props) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Agenda | null>(null),
    [dirty, setDirty] = useState(false),
    [filter, setFilter] = useState('전체'),
    [query, setQuery] = useState(''),
    [goal, setGoal] = useState<Direction | null>(null),
    [item, setItem] = useState<RegisterItem | null>(null);
  const strategy = data?.strategy || emptyStrategy(),
    today = kstDay(),
    records = state.records || [];
  const load = useCallback(async () => {
    const d = await readStrategy();
    setData(d);
    return d;
  }, []);
  useEffect(() => {
    let active = true;
    readStrategy()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(()=>{if(initialAgendaId&&data){const found=data.strategy.agendas.find(a=>a.id===initialAgendaId);if(found)setDraft(found);}},[initialAgendaId,data===null]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(a: Agenda) {
    setDraft(a);
    setDirty(true);
    setNotice('');
  }
  function open(a: Agenda) {
    if (
      (dirty || document.querySelector('[data-aux-dirty="true"]')) &&
      !confirm('저장하지 않은 입력이 있습니다. 이동하시겠습니까?')
    )
      return;
    setDraft(structuredClone(a));
    setDirty(false);
    setError('');
  }
  function newAgenda(
    lens: Lens = LENSES[0],
    title = '',
    evidence = '',
    domain = '경영',
  ) {
    if (
      (dirty || document.querySelector('[data-aux-dirty="true"]')) &&
      !confirm('저장하지 않은 입력이 있습니다. 이동하시겠습니까?')
    )
      return;
    const a = blankAgenda(lens);
    a.title = title;
    a.evidence = evidence;
    a.domain = domain;
    a.goalId = strategy.directions[0]?.id || '';
    setDraft(a);
    setDirty(true);
    setError('');
  }
  async function send(action: string, extra: object = {}) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (action !== 'reload') {
        const r = await fetch('/api/dss-strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, version: strategy.version, ...extra }),
        });
        const d = (await r.json()) as { error?: string };
        if (!r.ok) throw Error(d.error || '저장하지 못했습니다.');
      }
      const fresh = await load();
      if (draft && action !== 'revoke') {
        const saved = fresh.strategy.agendas.find((a) => a.id === draft.id);
        if (saved) setDraft(saved);
      }
      if (action !== 'revoke') setDirty(false);
      setNotice(
        action === 'execute'
          ? '내부 업무로 배정했습니다.'
          : action === 'revoke'
            ? '검토 링크를 종료했습니다.'
            : action === 'reload'
              ? '최신 내용을 불러왔습니다.'
              : '저장했습니다.',
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const pending = records.filter(
    (r) =>
      ['task', 'work_order'].includes(r.kind) &&
      !['완료', '보류'].includes(r.data.status),
  );
  const overdue = pending.filter(
      (r) => r.data.due && String(r.data.due).slice(0, 10) < today,
    ),
    waiting = pending.filter((r) => /대기|필요|요청/.test(r.data.status || ''));
  const current = strategy.directions[0];
  const isRegister = section === 'information' || section === 'security';
  const listed = strategy.agendas.filter(
    (a) =>
      (filter === '전체' || a.lens === filter) &&
      (!query || [a.title, a.question, a.domain].join(' ').includes(query)),
  );
  const due = strategy.agendas.filter(
    (a) =>
      (a.deadline && a.deadline <= today && a.status !== '결정') ||
      (a.reviewDate && a.reviewDate <= today),
  );
  const outstandingReviews = (data?.reviews || []).filter(
    (r) => !r.revoked && !r.submitted && r.expiresAt.slice(0, 10) >= today,
  );
  function agendaTable(rows: Agenda[]) {
    return rows.length ? (
      <div className="ds-table-wrap">
        <table className="ds-agendas">
          <thead>
            <tr>
              <th>결정할 안건</th>
              <th>영역·관점</th>
              <th>기한</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <button
                    className="ds-link ds-title-link"
                    onClick={() => open(a)}
                  >
                    {a.title}
                  </button>
                  <small>{a.question}</small>
                </td>
                <td>
                  {a.domain}
                  <small>{a.lens}</small>
                </td>
                <td>{a.deadline || '미정'}</td>
                <td>{a.executionKey ? '실행 연결' : a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="ds-empty">
        <h3>결정할 질문부터 시작하세요</h3>
        <p>
          새 안건을 만들거나 아래 업무에서 판단할 항목을 가져올 수 있습니다.
        </p>
        <button onClick={() => newAgenda()}>
          첫 안건 등록 <Plus size={16} />
        </button>
      </div>
    );
  }
  function tasks(rows: Row[]) {
    return rows.length ? (
      <ul className="ds-work-list">
        {rows.slice(0, 6).map((r) => (
          <li key={r.id}>
            <div>
              <button
                className="ds-link"
                onClick={() =>
                  r.kind === 'work_order'
                    ? onNavigate('업무 지시')
                    : onTask(r.id)
                }
              >
                {r.data.title}
              </button>
              <small>
                {r.org} · {r.data.status} · {r.data.due || '기한 미정'}
              </small>
            </div>
            <button
              onClick={() =>
                newAgenda(
                  '문제·이상',
                  r.data.title + ' 판단',
                  '업무 #' +
                    r.id +
                    ' · ' +
                    r.data.status +
                    '\n' +
                    (r.data.blocker ||
                      r.data.nextAction ||
                      r.data.criterion ||
                      ''),
                )
              }
            >
              안건으로
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="ds-muted">해당 상태의 업무가 없습니다.</p>
    );
  }
  return (
    <div className="ds" data-dirty={dirty ? 'true' : undefined}>
      <header className="ds-heading">
        <div>
          <h1>{labels[section] || labels.home}</h1>
        </div>
        <div className="ds-actions">
          <button
            aria-label="경영 자료 새로고침"
            disabled={busy}
            onClick={() => {
              if (
                (!dirty &&
                  !document.querySelector('[data-aux-dirty="true"]')) ||
                confirm('입력 중인 내용을 버리고 최신 자료를 불러올까요?')
              )
                void send('reload');
            }}
          >
            <RotateCw size={17} />
          </button>
          {!isRegister && (
            <button className="ds-primary" onClick={() => newAgenda()}>
              <Plus size={17} />
              안건 등록
            </button>
          )}
        </div>
      </header>
      {error && (
        <p className="ds-error" role="alert">
          {error}
        </p>
      )}
      {notice && <output className="ds-notice">{notice}</output>}
      {!data && !error && <output>경영 자료를 불러옵니다.</output>}
      {data && draft ? (
        <AgendaEditor
          key={draft.id}
          draft={draft}
          setDraft={change}
          strategy={strategy}
          reviews={data.reviews}
          busy={busy}
          send={send}
          save={async () => {
            await send('agenda', { data: draft });
          }}
          dirty={dirty}
          close={() => {
            if (
              (!dirty && !document.querySelector('[data-aux-dirty="true"]')) ||
              confirm('저장하지 않은 입력이 있습니다. 목록으로 돌아갈까요?')
            ) {
              setDraft(null);
              setDirty(false);
            }
          }}
        />
      ) : (
        data && (
          <>
            {(section === 'home' || section === 'direction') && (
              <section className="ds-direction">
                <div>
                  <h2>현재 목표·방향</h2>
                  {current ? (
                    <>
                      <strong>{current.direction}</strong>
                      <p>{current.target}</p>
                      <div className="ds-meta">
                        <span>판단 지표 {current.measure}</span>
                        <span>목표 시점 {current.horizon}</span>
                      </div>
                    </>
                  ) : (
                    <p className="ds-muted">
                      확정한 방향과 판단 지표를 등록하세요.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setGoal({
                      id: '',
                      direction: current?.direction || '',
                      target: current?.target || '',
                      measure: current?.measure || '',
                      horizon: current?.horizon || '',
                      guardrail: current?.guardrail || '',
                      changeTrigger: current?.changeTrigger || '',
                      reason: '',
                      at: '',
                    });
                    setDirty(true);
                  }}
                >
                  {current ? '방향 재검토' : '목표 설정'}
                  <ArrowUpRight size={16} />
                </button>
              </section>
            )}
            {goal && (
              <form
                className="ds-paper ds-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await send('direction', { data: goal })) setGoal(null);
                }}
              >
                <h2>{current ? '목표·방향 수정' : '목표·방향 설정'}</h2>
                {(
                  [
                    ['direction', '회사 방향'],
                    ['target', '목표'],
                    ['measure', '판단 지표'],
                    ['guardrail', '지킬 조건'],
                    ['changeTrigger', '방향을 바꿀 조건'],
                    ['reason', '설정·변경 이유'],
                  ] as const
                ).map(([key, label]) => (
                  <InputField
                    key={key}
                    label={label}
                    value={goal[key]}
                    onChange={(v) => {
                      setGoal({ ...goal, [key]: v });
                      setDirty(true);
                    }}
                    area={key === 'reason'}
                    required={key !== 'guardrail'}
                  />
                ))}
                <InputField
                  label="목표 시점"
                  type="date"
                  value={goal.horizon}
                  onChange={(v) => {
                    setGoal({ ...goal, horizon: v });
                    setDirty(true);
                  }}
                  required
                />
                <div className="ds-actions">
                  <button className="ds-primary" disabled={busy}>
                    새 기준으로 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGoal(null);
                      setDirty(false);
                    }}
                  >
                    취소
                  </button>
                </div>
              </form>
            )}
            {(section === 'home' || section === 'agendas') && (
              <div className="ds-command-grid">
                <section>
                  <div className="ds-section-head">
                    <h2>의사결정 안건</h2>
                    <input
                      aria-label="안건 검색"
                      placeholder="안건 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="ds-filter" aria-label="안건 관점">
                    {['전체', ...LENSES].map((x) => (
                      <button
                        key={x}
                        aria-pressed={filter === x}
                        onClick={() => setFilter(x)}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                  {agendaTable(listed)}
                  <div className="ds-lens-start">
                    <span>새 안건 시작</span>
                    {LENSES.map((l) => (
                      <button key={l} onClick={() => newAgenda(l)}>
                        {l}
                        <Plus size={13} />
                      </button>
                    ))}
                  </div>
                </section>
                <aside className="ds-review-queue">
                  <h2>판단 일정</h2>
                  {due.length ? (
                    due.map((a) => (
                      <button
                        className="ds-schedule"
                        key={a.id}
                        onClick={() => open(a)}
                      >
                        <span>
                          {a.reviewDate && a.reviewDate <= today
                            ? '재검토'
                            : '결정 기한'}
                        </span>
                        <b>{a.title}</b>
                        <small>{a.reviewDate || a.deadline}</small>
                      </button>
                    ))
                  ) : (
                    <p className="ds-muted">오늘 기한인 안건이 없습니다.</p>
                  )}
                  <h3>외부 검토 대기</h3>
                  {outstandingReviews.length ? (
                    outstandingReviews.map((r) => (
                      <button
                        className="ds-schedule"
                        key={r.id}
                        onClick={() => {
                          const a = strategy.agendas.find(
                            (a) => a.id === r.agendaId,
                          );
                          if (a) open(a);
                        }}
                      >
                        <b>
                          {r.reviewer} · {r.role}
                        </b>
                        <small>{r.expiresAt.slice(0, 10)}까지</small>
                      </button>
                    ))
                  ) : (
                    <p className="ds-muted">진행 중인 검토 요청이 없습니다.</p>
                  )}
                  <button
                    className="ds-link"
                    onClick={() => onNavigate('ER:advisors')}
                  >
                    외부 검토 전체 <ArrowUpRight size={15} />
                  </button>
                </aside>
              </div>
            )}
            {section === 'home' && (
              <section className="ds-erp">
                <div className="ds-section-head">
                  <h2>ERP에서 판단할 일</h2>
                  <span className="ds-muted">저장된 업무·고객 기준</span>
                </div>
                <div className="ds-cols">
                  <section>
                    <h3>
                      기한 지난 업무 <span>{overdue.length}</span>
                    </h3>
                    {tasks(overdue)}
                  </section>
                  <section>
                    <h3>
                      확인·조율 대기 <span>{waiting.length}</span>
                    </h3>
                    {tasks(waiting)}
                  </section>
                </div>
                <div className="ds-journey-strip">
                  {['D', 'B', 'A', 'S'].map((stage) => (
                    <button
                      key={stage}
                      onClick={() =>
                        newAgenda(
                          '고객여정',
                          stage + ' 단계 개선 판단',
                          stage +
                            ' 단계 등록 병원 ' +
                            records.filter(
                              (r) =>
                                r.kind === 'customer' &&
                                journeyStage(r.data.stage) === stage,
                            ).length +
                            '곳',
                        )
                      }
                    >
                      <b>{stage}</b>
                      <span>
                        {
                          (
                            {
                              D: '소식지·전달',
                              B: 'EMR 확보',
                              A: '샘플·계약',
                              S: '세팅·서비스',
                            } as Record<string, string>
                          )[stage]
                        }
                      </span>
                      <strong>
                        {
                          records.filter(
                            (r) =>
                              r.kind === 'customer' &&
                              journeyStage(r.data.stage) === stage,
                          ).length
                        }
                        곳
                      </strong>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
                <div className="ds-actions">
                  <button onClick={() => onNavigate('HR:home')}>
                    인사 현황
                  </button>
                  <button onClick={() => onNavigate('FM:home')}>
                    재무 현황
                  </button>
                  <button onClick={() => onNavigate('ER:information')}>
                    정보전략
                  </button>
                  <button onClick={() => onNavigate('ER:security')}>
                    보안
                  </button>
                </div>
              </section>
            )}
            {section === 'direction' && (
              <>
                <section className="ds-paper">
                  <h2>기준 변경 이력</h2>
                  {strategy.directions.map((g, i) => (
                    <article className="ds-history" key={g.id}>
                      <header>
                        <b>{g.direction}</b>
                        <span>
                          {i === 0 ? '현재 기준' : '이전 기준'} ·{' '}
                          {g.at.slice(0, 10)}
                        </span>
                      </header>
                      <p>{g.target}</p>
                      <dl>
                        <dt>지표·시점</dt>
                        <dd>
                          {g.measure} · {g.horizon}
                        </dd>
                        <dt>지킬 조건</dt>
                        <dd>{g.guardrail || '미등록'}</dd>
                        <dt>변경 조건</dt>
                        <dd>{g.changeTrigger}</dd>
                        <dt>설정·변경 이유</dt>
                        <dd>{g.reason}</dd>
                      </dl>
                    </article>
                  ))}
                </section>
                <section className="ds-paper">
                  <h2>기존 ERP 경영 기준</h2>
                  {records.filter((r) => r.kind === 'metric').length ? (
                    records
                      .filter((r) => r.kind === 'metric')
                      .map((r) => (
                        <p key={r.id}>
                          {r.org} · {r.data.title} · 목표 {r.data.target}
                          {r.data.unit} · {r.data.start}~{r.data.end}
                        </p>
                      ))
                  ) : (
                    <p className="ds-muted">등록된 경영 기준이 없습니다.</p>
                  )}
                </section>
              </>
            )}
            {section === 'advisors' && (
              <section>
                <div className="ds-section-head">
                  <h2>안건별 외부 검토</h2>
                </div>
                <div className="ds-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>검토자·역할</th>
                        <th>안건</th>
                        <th>기한</th>
                        <th>상태</th>
                        <th>의견</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reviews.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.reviewer}
                            <small>{r.role}</small>
                          </td>
                          <td>
                            <button
                              className="ds-link"
                              onClick={() => {
                                const a = strategy.agendas.find(
                                  (a) => a.id === r.agendaId,
                                );
                                if (a) open(a);
                              }}
                            >
                              {strategy.agendas.find((a) => a.id === r.agendaId)
                                ?.title || '안건'}
                            </button>
                          </td>
                          <td>{r.expiresAt.slice(0, 10)}</td>
                          <td>
                            {r.revoked
                              ? '종료'
                              : r.submitted
                                ? '의견 도착'
                                : r.expiresAt.slice(0, 10) < today
                                  ? '기간 만료'
                                  : '회신 대기'}
                          </td>
                          <td>{r.opinion || '아직 없음'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.reviews.length && (
                  <div className="ds-empty">
                    <h3>검토할 안건을 선택하세요</h3>
                    <p>
                      안건의 ‘외부 검토’에서 이사·자문·고문별 요청 자료와 회신
                      기한을 정합니다.
                    </p>
                  </div>
                )}
                {agendaTable(strategy.agendas)}
              </section>
            )}
            {section === 'execution' && (
              <section>
                <h2>결정에서 실행까지</h2>
                {data.executions.length ? (
                  <div className="ds-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>내부 업무</th>
                          <th>결정 안건</th>
                          <th>담당·기한</th>
                          <th>상태·결과</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.executions.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="ds-link"
                                onClick={() =>
                                  r.kind === 'work_order'
                                    ? onNavigate('업무 지시')
                                    : onTask(r.id)
                                }
                              >
                                {r.data.title}
                              </button>
                            </td>
                            <td>
                              <button
                                className="ds-link"
                                onClick={() => {
                                  const a = strategy.agendas.find(
                                    (a) => a.executionKey === r.dedup,
                                  );
                                  if (a) open(a);
                                }}
                              >
                                {
                                  strategy.agendas.find(
                                    (a) => a.executionKey === r.dedup,
                                  )?.title
                                }
                              </button>
                            </td>
                            <td>
                              {r.assignee}
                              <small>{r.data.due}</small>
                            </td>
                            <td>
                              {r.data.status}
                              <small>{r.data.result || '결과 제출 전'}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="ds-muted">
                    결정한 안건에서 담당자·기한·완료 기준을 정해 내부 업무로
                    배정하세요.
                  </p>
                )}
                {agendaTable(
                  strategy.agendas.filter((a) => a.status === '결정'),
                )}
              </section>
            )}
            {isRegister && (
              <section>
                <div className="ds-section-head">
                  <h2>
                    {section === 'information'
                      ? '정보·시스템 관리대장'
                      : '보안 점검·조치'}
                  </h2>
                  <button
                    className="ds-primary"
                    onClick={() => {
                      setItem({
                        id: crypto.randomUUID(),
                        kind: section as 'information' | 'security',
                        name: '',
                        owner: '',
                        purpose: '',
                        classification:
                          section === 'security' ? '높음' : '내부',
                        source: '',
                        status: '확인 필요',
                        next: '',
                        due: '',
                        updatedAt: '',
                      });
                      setDirty(true);
                    }}
                  >
                    <Plus size={16} />
                    항목 등록
                  </button>
                </div>
                {item && (
                  <form
                    className="ds-paper ds-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await send('register', { data: item })) setItem(null);
                    }}
                  >
                    {(
                      [
                        [
                          'name',
                          section === 'information'
                            ? '정보·시스템명'
                            : '점검·위험 항목',
                        ],
                        ['owner', '담당자'],
                        [
                          'purpose',
                          section === 'information'
                            ? '지원할 경영 판단·업무'
                            : '발생 가능 영향',
                        ],
                        [
                          'classification',
                          section === 'information'
                            ? '공개·내부·비밀 구분'
                            : '위험도',
                        ],
                        ['source', '근거·관리 위치'],
                        ['next', '다음 조치'],
                      ] as const
                    ).map(([key, label]) => (
                      <InputField
                        key={key}
                        label={label}
                        value={item[key]}
                        onChange={(v) => {
                          setItem({ ...item, [key]: v });
                          setDirty(true);
                        }}
                        area={key === 'purpose' || key === 'next'}
                        required={['name', 'owner', 'purpose', 'next'].includes(
                          key,
                        )}
                      />
                    ))}
                    <div className="ds-cols">
                      <label>
                        상태
                        <select
                          value={item.status}
                          onChange={(e) => {
                            setItem({ ...item, status: e.target.value });
                            setDirty(true);
                          }}
                        >
                          {['확인 필요', '계획', '진행 중', '완료', '보류'].map(
                            (s) => (
                              <option key={s}>{s}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <InputField
                        label="점검·처리 기한"
                        type="date"
                        value={item.due}
                        onChange={(v) => {
                          setItem({ ...item, due: v });
                          setDirty(true);
                        }}
                        required
                      />
                    </div>
                    <div className="ds-actions">
                      <button className="ds-primary" disabled={busy}>
                        관리 항목 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItem(null);
                          setDirty(false);
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                )}
                <div className="ds-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th>담당·구분</th>
                        <th>상태</th>
                        <th>기한·다음 조치</th>
                        <th>판단</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.register
                        .filter((r) => r.kind === section)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="ds-link"
                                onClick={() => {
                                  setItem({ ...r });
                                  setDirty(false);
                                }}
                              >
                                {r.name}
                              </button>
                              <small>{r.purpose}</small>
                            </td>
                            <td>
                              {r.owner}
                              <small>{r.classification}</small>
                            </td>
                            <td>{r.status}</td>
                            <td>
                              {r.due}
                              <small>{r.next}</small>
                            </td>
                            <td>
                              <button
                                onClick={() =>
                                  newAgenda(
                                    '경영요소 통합',
                                    r.name + ' 판단',
                                    r.purpose + '\n' + r.next,
                                    section === 'information'
                                      ? '정보전략'
                                      : '보안',
                                  )
                                }
                              >
                                안건으로
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!strategy.register.some((r) => r.kind === section) && (
                  <div className="ds-empty">
                    <h3>
                      {section === 'information'
                        ? '판단에 필요한 정보와 시스템을 등록하세요'
                        : '점검할 자산과 위험을 등록하세요'}
                    </h3>
                    <p>
                      {section === 'information'
                        ? '데이터의 출처·책임자·활용 목적과 다음 개선 조치를 관리합니다.'
                        : '접근권한·백업·외부 공유·복구 항목의 책임자와 점검 근거를 관리합니다.'}
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
