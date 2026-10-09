'use client';
import { useEffect, useRef, useState } from 'react';
export default function SSApproval({ snap = {}, onOpen, onRefresh }: any) {
  const [data, setData] = useState<any>(null),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState<any>(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [confirming, setConfirming] = useState(false);
  const lock = useRef(false);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/ss-approval', {
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        }),
        b: any = await r.json();
      if (!r.ok) throw Error(b.error || '서버 응답 오류');
      setData(b);
      setSelected((old) =>
        old.filter((h) =>
          b.hospitals.some((x: any) => x.hospital === h && x.ready),
        ),
      );
    } catch (e: any) {
      setError(
        '승인 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.',
      );
      setData(null);
      setSelected([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const rows = data?.hospitals || [],
    choices = rows.filter((h: any) => h.ready && selected.includes(h.hospital)),
    total = choices.reduce((n: number, h: any) => n + h.total, 0);
  function category(h: any) {
    const d = snap[h.hospital]?.delivery;
    return d?.failed ||
      h.result?.status === 'held' ||
      h.result?.status === 'unknown'
      ? 'issue'
      : h.ready
        ? 'ready'
        : h.result || d?.accepted
          ? 'result'
          : 'setup';
  }
  function status(h: any) {
    const d = snap[h.hospital]?.delivery;
    if (d?.failed) return `실패 ${d.failed}건 확인`;
    if (h.result?.status === 'unknown') return '발송 여부 미확인';
    if (h.result?.status === 'held') return '발송 중단 확인';
    if (h.ready) return '승인 대기';
    if (d?.pending) return '수신 결과 확인 중';
    if (d?.delivered) return '수신 결과 도착';
    if (h.result) return '요청 접수 · 결과 확인';
    if (h.hasRun === false) return '오늘 회차 미준비';
    return h.status === 'unconnected'
      ? '자료 연결 필요'
      : h.status === 'expired'
        ? '재검수 필요'
        : '준비 상태 확인';
  }
  async function send() {
    if (lock.current || !choices.length) return;
    lock.current = true;
    setBusy(true);
    setConfirming(false);
    setError('');
    try {
      const r = await fetch('/api/ss-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          date: data.date,
          hospitals: choices.map((h: any) => ({
            hospital: h.hospital,
            runHash: h.runHash,
          })),
          confirm: '선택 병원 검수완료 대상 일괄 발송',
        }),
      });
      const b: any = await r.json();
      if (!r.ok) throw Error(b.error || '요청 결과 미확인');
      setResult(b);
      setSelected([]);
      onRefresh?.();
      await load();
    } catch {
      setError(
        '발송 요청 결과가 확인되지 않았습니다. 중복 발송을 막기 위해 병원 상세에서 결과를 먼저 확인해 주세요.',
      );
      setSelected([]);
      await load();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section className="ss-approval" aria-label="병원별 운영 및 발송 승인">
      <div className="ss-ops-metrics">
        <div>
          <span>전체 병원</span>
          <b>
            {data ? rows.length : '—'}
            <small>곳</small>
          </b>
        </div>
        <div>
          <span>승인 대기</span>
          <b>
            {data ? rows.filter((h: any) => h.ready).length : '—'}
            <small>곳</small>
          </b>
        </div>
        <div>
          <span>결과 확인 필요</span>
          <b>
            {data
              ? rows.filter((h: any) =>
                  ['issue', 'result'].includes(category(h)),
                ).length
              : '—'}
            <small>곳</small>
          </b>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h3>병원별 오늘의 업무</h3>
          <p>{data?.date || '오늘'} · 발송 가능 월–토 10:00–18:00</p>
        </div>
        <button
          disabled={busy || loading}
          onClick={() => {
            setError('');
            setConfirming(false);
            onRefresh?.();
            void load();
          }}
        >
          {loading ? '조회 중…' : '상태 새로고침'}
        </button>
      </div>
      <div className="ss-toolbar">
        <div className="ss-filter" aria-label="업무 상태 필터">
          {[
            ['all', '전체'],
            ['ready', '승인 대기'],
            ['issue', '확인 필요'],
            ['setup', '준비 중'],
            ['result', '발송 결과'],
          ].map(([v, l]) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          aria-label="병원 검색"
          placeholder="병원 이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && (
        <p className="ss-alert" role="alert">
          {error}
        </p>
      )}
      <div className="ss-table-scroll">
        <table className="ss-clinic-table">
          <thead>
            <tr>
              <th>선택</th>
              <th>병원</th>
              <th>오늘 대상</th>
              <th>현재 상태</th>
              <th>발송 결과</th>
              <th>다음 행동</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter(
                (h: any) =>
                  h.name.includes(query) &&
                  (filter === 'all' || category(h) === filter),
              )
              .map((h: any) => {
                const d = snap[h.hospital]?.delivery;
                return (
                  <tr key={h.hospital}>
                    <td>
                      <input
                        aria-label={h.name + ' 발송 선택'}
                        type="checkbox"
                        checked={selected.includes(h.hospital)}
                        disabled={!h.ready || busy || loading}
                        onChange={(e) => {
                          setConfirming(false);
                          setSelected((v) =>
                            e.target.checked
                              ? [...v, h.hospital]
                              : v.filter((x) => x !== h.hospital),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className="ss-hospital-name"
                        onClick={() => onOpen?.(h.hospital)}
                      >
                        {h.name} <span>↗</span>
                      </button>
                    </td>
                    <td>
                      {h.status === 'unconnected' || h.status === 'error' ? (
                        '자료 미확인'
                      ) : h.hasRun === false ? (
                        '회차 미준비'
                      ) : (
                        <>
                          <b>{h.total ?? '—'}</b>명
                        </>
                      )}
                    </td>
                    <td>
                      <span className={'ss-badge ss-badge-' + category(h)}>
                        {status(h)}
                      </span>
                      <small className="ss-cell-note">
                        {h.ready
                          ? '전수 검수 통과'
                          : h.reason || h.reviewReason || '상세에서 확인'}
                      </small>
                    </td>
                    <td>
                      {d ? (
                        <>
                          <b>{d.delivered}</b> 수신{' '}
                          <span className="ss-cell-note">
                            처리 중 {d.pending} · 실패 {d.failed}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}{' '}
                    </td>
                    <td>
                      <button onClick={() => onOpen?.(h.hospital)}>
                        {category(h) === 'setup' ? '준비 확인' : '상세 확인'} →
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {!data && !error && (
        <p className="ss-empty">병원별 검수 상태를 불러오고 있습니다.</p>
      )}
      {data &&
        !rows.some(
          (h: any) =>
            h.name.includes(query) &&
            (filter === 'all' || category(h) === filter),
        ) && <p className="ss-empty">해당 조건의 병원이 없습니다.</p>}
      <div className="ss-selection-bar">
        <div>
          <b>
            {choices.length}곳 · {total}명 선택
          </b>
          <small>검수 완료된 병원만 선택할 수 있습니다.</small>
        </div>
        <button
          className="ss-primary"
          disabled={busy || loading || !choices.length}
          onClick={() => setConfirming(true)}
        >
          {busy ? '발송 요청 처리 중…' : '선택 대상 발송 검토 →'}
        </button>
      </div>
      {confirming && (
        <div className="ss-confirm" role="region" aria-label="발송 최종 확인">
          <b>
            {choices.map((h: any) => h.name).join(', ')} · 총 {total}명에게
            문자를 발송합니다.
          </b>
          <p>
            승인 시 검수·명단·기발송 이력을 다시 대조합니다. 요청 접수와 실제
            수신 결과는 구분해 기록됩니다.
          </p>
          <div className="actions">
            <button onClick={() => setConfirming(false)}>돌아가기</button>
            <button
              className="ss-primary"
              disabled={busy || loading || !choices.length}
              onClick={() => void send()}
            >
              승인하고 실제 발송
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="ss-confirm" role="status">
          <b>
            {result.status === 'requested'
              ? '발송 요청 완료 · 수신 결과 확인 필요'
              : '일부 요청 중단 · 상세 결과 확인 필요'}
          </b>
        </div>
      )}
    </section>
  );
}
