'use client';
import { useEffect, useState } from 'react';
import ServiceReviewPanel from './service-review-panel';
import HospitalBrief from './hospital-brief';
import HospitalAdminHealth from './hospital-admin-health';
import ServiceDetail from './ss-service-detail';
import SSApproval from './ss-approval';
import ServiceSettlement from './service-settlement';
import { weekState } from '@/lib/ss-week-state';
import { SERVICE_RULES } from '@/lib/ss-service-policy';
import './ss-service-center.css';
const slug = (h: any) =>
  /플로체|플로츠/.test(h.data.name)
    ? 'floce'
    : h.data.name.includes('플랜미')
      ? 'planme'
      : /연세/.test(h.data.name)
        ? 'yonsei'
        : /레아|레하/.test(h.data.name)
          ? 'rea'
          : null;
const today = () =>
  new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function monday(day: string) {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const labels = [
  '전체 보기',
  ...SERVICE_RULES.map((s) => s.name),
  'CTI · 미제공',
  '해외환자 번역 · 미제공',
];
const internal = [
  '',
  '진료 후 케어',
  '예약 맞춤 안내',
  '검사 결과 알림',
  '상담 후 관리',
  '장기미내원 관리',
  'CTI · 구상',
  '해외환자 번역 · 구상',
];
export default function ServiceCenter({
  hospitals,
  state,
  onTask,
  onNewTask,
  onSave,
  onNavigate,
  focus,
}: any) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [billingOpen, setBillingOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [selected, setSelected] = useState(focus?.clinic || ''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [service, setService] = useState(0),
    [date, setDate] = useState(today()),
    [start, setStart] = useState(monday(today())),
    [snap, setSnap] = useState<any>({}),
    [week, setWeek] = useState<any[]>([]),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const owner = state.member.role === 'DO',
    h = hospitals.find((x: any) => x.key === selected),
    hs = h ? slug(h) : null;
  const filtered = hospitals.filter((x: any) => x.data.name.includes(query)),
    shown = filtered.slice(page * 20, page * 20 + 20);
  function select(key: string) {
    if (dirty && !confirm('저장하지 않은 내용을 버리고 이동하시겠습니까?'))
      return;
    setSelected(key);
    setBillingOpen(false);
    setService(0);
    setDirty(false);
    setDate(today());
  }
  useEffect(() => {
    if (!owner) return;
    let alive = true,
      inflight = false;
    const read = async () => {
      if (inflight) return;
      inflight = true;
      await Promise.allSettled(
        ['floce', 'planme'].map(async (s) => {
          try {
            const cached = await fetch(
              '/api/ss-today?hospital=' + s + '&cached=1',
              { cache: 'no-store', signal: AbortSignal.timeout(10000) },
            );
            if (cached.ok) {
              const previous: any = await cached.json();
              if (alive) setSnap((v: any) => ({ ...v, [s]: previous }));
            }
            const r = await fetch('/api/ss-today?hospital=' + s, {
              cache: 'no-store',
              signal: AbortSignal.timeout(55000),
            });
            if (!r.ok) throw Error();
            const b: any = await r.json();
            if (alive) setSnap((v: any) => ({ ...v, [s]: b }));
          } catch {
            if (alive)
              setError(
                '일부 병원 결과 조회 실패 · 마지막 확인값을 보존합니다.',
              );
          }
        }),
      );
      inflight = false;
    };
    void read();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [owner, refreshTick]);
  useEffect(() => {
    if (!owner || !hs || !['floce', 'planme'].includes(hs)) {
      setWeek([]);
      return;
    }
    const a = new AbortController();
    setWeek([]);
    fetch(`/api/ss-week?hospital=${hs}&start=${start}`, {
      signal: a.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        const b: any = await r.json();
        if (!r.ok) throw Error(b.error);
        setWeek(b.days);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => a.abort();
  }, [hs, start, owner]);
  const d = hs ? snap[hs || '']?.delivery : null;
  const tasks = h
    ? state.records.filter(
        (r: any) => r.kind === 'task' && r.data.customer === h.data.name,
      )
    : [];
  return (
    <div className="ss-center">
      <header className="section-heading">
        <div>
          <h2>{h ? h.data.name : '전체 병원 서비스 운영'}</h2>
          <p>
            {h
              ? '전체 현황을 확인하고 서비스별 실행으로 이동합니다.'
              : '병원을 검색해서 오늘 할 일과 주간 운영을 확인합니다.'}
          </p>
        </div>
        {h && (
          <div className="actions">
            <button onClick={() => select('')}>전체 병원 · 통합 승인</button>
            <button
              onClick={() => onNavigate?.('세팅', { clinic: h.key, mode: 'S' })}
            >
              공통 세팅
            </button>
          </div>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {owner && !h && (
        <SSApproval
          onRefresh={() => setRefreshTick((v) => v + 1)}
          snap={snap}
          onOpen={(s: string) => {
            const target = hospitals.find((x: any) => slug(x) === s);
            if (target) select(target.key);
          }}
        />
      )}
      {!h ? (
        <>
          {!owner && (
            <>
              <div className="section-heading">
                <input
                  aria-label="서비스 병원 검색"
                  placeholder="병원 검색"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
                <span>
                  {filtered.length}곳 · 오늘 {today()}
                </span>
              </div>
              <table className="ss-clinic-table">
                <thead>
                  <tr>
                    <th>병원</th>
                    <th>오늘 제작</th>
                    <th>발송·수신</th>
                    <th>다음 확인</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((x: any) => {
                    const v = snap[slug(x) || ''],
                      r = v?.delivery;
                    return (
                      <tr key={x.key}>
                        <td>
                          <button onClick={() => select(x.key)}>
                            {x.data.name} →
                          </button>
                        </td>
                        <td>{v ? v.prepared + '명' : '자료 연결 확인'}</td>
                        <td>
                          {r
                            ? `접수 ${r.accepted} · 수신 ${r.delivered} · 처리 중 ${r.pending} · 실패 ${r.failed}`
                            : '실적 미확인'}
                        </td>
                        <td>
                          {r?.pending
                            ? '통신사 처리 결과'
                            : r?.unsent
                              ? '검수·발송 승인'
                              : '자료·서비스 준비 확인'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="actions">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  이전
                </button>
                <span>
                  {page + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}
                </span>
                <button
                  disabled={(page + 1) * 20 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="ss-clinic-switch">
            <label>
              병원 이동{' '}
              <select
                aria-label="병원 이동"
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                {hospitals.map((x: any) => (
                  <option key={x.key} value={x.key}>
                    {x.data.name}
                  </option>
                ))}
              </select>
            </label>
            <span>오늘 {today()}</span>
          </div>
          <nav className="ss-center-tabs" aria-label="병원 서비스 선택">
            {labels.slice(0, 6).map((l, i) => (
              <button
                key={l}
                aria-current={service === i ? 'page' : undefined}
                onClick={() => {
                  if (
                    dirty &&
                    !confirm('저장하지 않은 내용을 버리고 이동하시겠습니까?')
                  )
                    return;
                  setService(i);
                  setDirty(false);
                }}
              >
                <strong>{l.replace(' · 미제공', '')}</strong>
              </button>
            ))}
          </nav>
          {service === 0 ? (
            <>
              <section className="ss-today-focus">
                <div className="section-heading">
                  <div>
                    <span className="ss-eyebrow">TODAY · {today()}</span>
                    <h3>오늘의 장기미내원 관리</h3>
                    <p>
                      {d?.failed
                        ? `실패 ${d.failed}건을 먼저 확인해 주세요.`
                        : d?.pending
                          ? '통신사 수신 결과를 확인하고 있습니다.'
                          : '오늘 대상과 검수·발송 결과를 확인하세요.'}
                    </p>
                  </div>
                  <button
                    className="ss-primary"
                    onClick={() => {
                      setDate(today());
                      setService(5);
                    }}
                  >
                    대상·검수·결과 확인 →
                  </button>
                </div>
                <div className="ss-ops-metrics">
                  {[
                    ['제작 대상', snap[hs || '']?.prepared],
                    ['발송 접수', d?.accepted],
                    ['수신 완료', d?.delivered],
                    ['처리 중', d?.pending],
                    ['실패', d?.failed],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <b>
                        {value ?? '—'}
                        <small>명</small>
                      </b>
                    </div>
                  ))}
                </div>
              </section>
              <HospitalBrief
                compact
                key={h.key}
                hospital={h}
                tasks={tasks}
                onTask={onTask}
                onNewTask={onNewTask}
              />
              <section className="ss-center-section">
                <div className="section-heading">
                  <h3>주간 발송 현황 · 장기미내원</h3>
                  <label>
                    주간 조회{' '}
                    <input
                      aria-label="주간 시작일"
                      type="date"
                      value={start}
                      onChange={(e) => {
                        if (e.target.value) setStart(monday(e.target.value));
                      }}
                    />
                  </label>
                </div>
                <p>
                  선택한 주의 계획, 준비, 검수, 실제 발송을 구분해 확인합니다.
                </p>
                <div className="ss-calendar">
                  {Array.from({ length: 7 }, (_, i) => {
                    const dt = new Date(Date.parse(start) + i * 86400000)
                        .toISOString()
                        .slice(0, 10),
                      w = week.find((x) => x.date === dt);
                    return (
                      <button
                        key={dt}
                        onClick={() => {
                          setDate(dt);
                          setService(5);
                        }}
                        aria-current={dt === today() ? 'date' : undefined}
                      >
                        <b>
                          {['월', '화', '수', '목', '금', '토', '일'][i]}{' '}
                          {dt.slice(5)}
                        </b>
                        <span>계획 {w?.target ?? '미정'}명</span>
                        <span>
                          제작 {w?.prepared ?? '—'} · 검수{' '}
                          {w?.prechecked ?? '—'}
                        </span>
                        <strong className={'ss-status-' + weekState(w).tone}>
                          {weekState(w).label}
                        </strong>
                        <small>{weekState(w).detail}</small>
                      </button>
                    );
                  })}
                </div>
                {d && (
                  <p className="ss-today-line">
                    오늘 접수 <b>{d.accepted}</b> · 수신 <b>{d.delivered}</b> ·
                    처리 중 <b>{d.pending}</b> · 실패 <b>{d.failed}</b>
                    <small>
                      {' '}
                      · 확인{' '}
                      {d.checkedAt
                        ? new Date(d.checkedAt).toLocaleTimeString('ko-KR')
                        : '미확인'}
                      {snap[hs || '']?.stale ? ' · 최신 결과 조회 중' : ''}
                    </small>
                  </p>
                )}
              </section>
              {owner && h.record?.id && (
                <details
                  className="ss-center-section"
                  open={billingOpen}
                  onToggle={(e) => setBillingOpen(e.currentTarget.open)}
                >
                  <summary>요금·정산</summary>
                  {billingOpen && (
                    <ServiceSettlement
                      key={h.record.id}
                      hospitalId={h.record.id}
                      compact
                    />
                  )}
                </details>
              )}
              {owner && (
                <details
                  className="ss-support-panel"
                  onToggle={(e) => setHealthOpen(e.currentTarget.open)}
                >
                  <summary>병원 관리자 · 계정 및 점검 이력</summary>
                  {healthOpen && <HospitalAdminHealth compact hospital={h} />}
                </details>
              )}
              <details className="ss-support-panel">
                <summary>준비 중인 서비스</summary>
                <div className="actions">
                  {labels.slice(6).map((l, i) => (
                    <button key={l} onClick={() => setService(i + 6)}>
                      {l}
                    </button>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <ServiceDetail
              key={h.key + ':' + service}
              hospital={h}
              slug={hs}
              service={service}
              date={date}
              onDate={setDate}
              owner={owner}
              onSave={onSave}
              onTask={onTask}
              onDirty={setDirty}
            />
          )}
        </>
      )}
    </div>
  );
}
