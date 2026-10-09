'use client';
import FinanceControl from './fm-control';
import BrandPurchasePanel from './brand-purchase-panel';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACCOUNTS,
  vatCalculation,
  type Journal,
} from '@/versions/v2/lib/ccfm';
import './ccfm.css';
import { CCFMWork, CCFMBot } from './ccfm-operations';
import ServiceSettlement from './service-settlement';
import SSMoney from './ss-money';
const sectionMap: Record<string, string> = {
  control:'경리 출근판',
  work:'업무현황',
  receivables:'수금·미수',
  home: '업무현황',
  consult: '경리봇 상담·보고',
  cash: '수입·지출/출납',
  journal: '경리·회계/일계표',
  invoices: '세금계산서',
  report: '일간·월간 재무보고',
  settlement: '정산·원가',
  approvals: '증빙·승인',
};
const money = (v: number | null) =>
  v === null ? '미확인' : v.toLocaleString('ko-KR') + '원';
const today = () =>
  new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const blank = () => ({
  date: today(),
  ref: '',
  description: '',
  evidence: '',
  person: 'do',
  org: 'DSS',
  sourceKey: '',
  lines: [
    { account: 'expense', debit: '', credit: '' },
    { account: 'cash', debit: '', credit: '' },
  ],
  tax: {
    type: 'unknown',
    effect: 'increase',
    direction: 'purchase',
    supplyDate: today(),
    base: '',
    vat: '',
    deductible: false,
    basis: '',
  },
});
export default function CCFM({
  activeSection,
  onSectionChange,
  hideSidebar = false,
}: {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
  hideSidebar?: boolean;
}) {
  const [loadedData, setData] = useState<any>(null),
    [date, setDate] = useState(today),
    [localTab, setTab] = useState(sectionMap[activeSection || 'home'] || '업무현황'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<any>(null),
    [reverse, setReverse] = useState<Journal | null>(null),
    [reason, setReason] = useState('');
  const pending = useRef<any>(null);
  const tab = activeSection ? sectionMap[activeSection] || localTab : localTab;
  const data = loadedData?.report.date === date ? loadedData : null;
  const navigate = (key: string) => {
    setTab(sectionMap[key] || key);
    onSectionChange?.(key);
  };
  const load = useCallback(async () => {
    const r = await fetch('/api/ccfm?date=' + date),
      v: any = await r.json();
    if (!r.ok) throw Error(v.error || '원장을 불러오지 못했습니다.');
    setData(v);
    return v;
  }, [date]);
  useEffect(() => {
    let active = true;
    fetch('/api/ccfm?date=' + date)
      .then(async (r) => {
        const v: any = await r.json();
        if (!r.ok) throw Error(v.error);
        if (active) {
          setData(v);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [date]);
  async function save(command: any) {
    setBusy(true);
    setError('');
    setNotice('');
    const candidate = JSON.stringify(command);
    if (!pending.current || pending.current.candidate !== candidate)
      pending.current = {
        candidate,
        body: {
          ...command,
          version: data.ledger.version,
          requestId: crypto.randomUUID(),
        },
      };
    try {
      const r = await fetch('/api/ccfm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending.current.body),
        }),
        v: any = await r.json();
      if (!r.ok) {
        if (r.status === 409) pending.current = null;
        throw Error(v.error);
      }
      pending.current = null;
      setForm(null);
      setReverse(null);
      setReason('');
      setNotice(
        command.action === 'post' || command.action === 'reverse'
          ? '전표와 보관본을 함께 저장했습니다.'
          : command.action === 'botReport'
            ? '원장 근거가 담긴 업무보고를 저장했습니다.'
            : '업무와 처리 근거를 저장했습니다.',
      );
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const field = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const tax = (k: string, v: any) =>
    setForm((f: any) => ({ ...f, tax: { ...f.tax, [k]: v } }));
  function sourceSelect(key: string) {
    const s = data.sources.find((s: any) => s.key === key);
    if (!s) {
      field('sourceKey', '');
      return;
    }
    setForm((f: any) => ({
      ...f,
      sourceKey: key,
      date: s.date,
      ref: s.ref,
      description: s.label,
      evidence: s.evidence,
      tax: { ...f.tax, supplyDate: s.date },
      lines:
        s.cash > 0
          ? [
              { account: 'cash', debit: String(s.amount), credit: '' },
              { account: 'deposit', debit: '', credit: String(s.amount) },
            ]
          : s.cash < 0
            ? [
                { account: 'expense', debit: String(s.amount), credit: '' },
                { account: 'cash', debit: '', credit: String(s.amount) },
              ]
            : [
                { account: 'receivable', debit: String(s.amount), credit: '' },
                { account: 'revenue', debit: '', credit: String(s.amount) },
              ],
    }));
  }
  const report = data?.report;
  return (
    <section className="ccfm" aria-label="CCFM · 차트클린 재무관리">
      <header className="ir-heading">
        <div>
          <h2>CCFM · 차트클린 재무관리</h2>
          <p>(주)에이치에스투에쿼티 · 차트클린 / 챙겨</p>
        </div>
        <button
          disabled={busy || !data}
          onClick={() => {
            setForm(blank());
            setReverse(null);
            setError('');
          }}
        >
          회계 전표 등록
        </button>
      </header>
      <p className="ir-context">
        DSS 재무 관리 · 원장에 기록한 금액을 대조합니다. 은행 기초잔액·실제
        잔액은 확인 전입니다.
      </p>
      <div className="ir-top-consult">
        <button onClick={() => navigate('consult')}>경리봇 상담·보고</button>
        <button onClick={() => navigate('home')}>오늘 할 일</button>
        <span>저장 원장 기반 · AI 대화 연결 전</span>
      </div>
      <div className="ir-toolbar">
        <label>
          조회 기준일{' '}
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value || today())}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          원장 새로고침
        </button>
        <a href={'/api/ccfm?export=1&date=' + date}>백업 내려받기</a>
        <a href="#settlement" onClick={e=>{e.preventDefault();navigate('settlement')}}>
          서비스 정산 열기
        </a>
      </div>
      <div
        className={hideSidebar ? 'ir-layout ir-layout-embedded' : 'ir-layout'}
      >
        {!hideSidebar && (
          <nav className="ir-tabs" aria-label="CCFM 업무 메뉴">
            {Object.entries(sectionMap).map(([key, t]) => (
              <button
                key={key}
                aria-current={tab === t ? 'page' : undefined}
                onClick={() => navigate(key)}
              >
                {t}
              </button>
            ))}
          </nav>
        )}
        <div className="ir-content">
          {error && (
            <p className="ir-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <output className="ir-notice">
              {notice}
            </output>
          )}
          {!data && !error && <output>원장을 불러오는 중입니다.</output>}
          {data && (
            <>
              <p className="ir-version">
                원장 버전 {data.ledger.version} ·{' '}
                {data.backup.available
                  ? '같은 버전의 자동 보관본 있음'
                  : data.ledger.version === 0
                    ? '첫 거래 저장 전'
                    : '보관본 확인 필요'}{' '}
                · 이사님 내부용
              </p>
              {(report.changed.length > 0 || report.collisions.length > 0) && (
                <p className="ir-error">
                  원본 변경 {report.changed.length}건 · 거래번호 충돌{' '}
                  {report.collisions.length}건. 합계를 확정하기 전에 원본과
                  전표를 대조해 주세요. {report.collisions.join(', ')}
                </p>
              )}
              <div hidden={tab !== '경리 출근판'}><FinanceControl data={data} date={date} busy={busy} save={save} navigate={navigate}/></div>
              <div hidden={tab !== '수금·미수'}><ServiceSettlement/></div>
              <div hidden={tab !== '업무현황'}>                <CCFMWork
                  data={data}
                  kind="task"
                  date={date}
                  busy={busy}
                  save={save}
                /></div>
              <div hidden={tab !== '세금계산서'}>                <CCFMWork
                  data={data}
                  kind="invoice"
                  date={date}
                  busy={busy}
                  save={save}
                /></div>
              <div hidden={tab !== '경리봇 상담·보고'}>                <CCFMBot data={data} date={date} busy={busy} save={save} /></div>
              <div hidden={tab !== '정산·원가'}><SSMoney /></div>
              {form && (
                <form
                  className="ir-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save({
                      action: 'post',
                      date: form.date,
                      journal: {
                        ...form,
                        lines: form.lines.map((l: any) => ({
                          ...l,
                          debit: Number(l.debit),
                          credit: Number(l.credit),
                        })),
                        tax: {
                          ...form.tax,
                          base:
                            form.tax.type === 'unknown'
                              ? null
                              : form.tax.base === ''
                                ? null
                                : Number(form.tax.base),
                          vat:
                            form.tax.type === 'unknown'
                              ? null
                              : form.tax.vat === ''
                                ? null
                                : Number(form.tax.vat),
                        },
                      },
                    });
                  }}
                >
                  <h3>회계 전표 등록</h3>
                  <p>
                    서비스 거래는 원본을 연결합니다. 분개 예시는 실제 증빙에
                    맞게 확인해 주세요.
                  </p>
                  <label>
                    기존 서비스 원본 연결
                    <select
                      value={form.sourceKey}
                      onChange={(e) => sourceSelect(e.target.value)}
                    >
                      <option value="">
                        회사 자체 거래 · 서비스 거래와 중복 없는 증빙
                      </option>
                      {data.sources.map((s: any) => (
                        <option key={s.key} value={s.key}>
                          {s.date} · {s.label} · {money(s.amount)} · {s.ref}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ir-fields">
                    {[
                      ['date', '거래일', 'date'],
                      ['ref', '증빙 거래번호', 'text'],
                      ['description', '거래 내용', 'text'],
                      ['evidence', '증빙 위치·확인 근거', 'text'],
                    ].map(([key, label, type]) => (
                      <label key={key}>
                        {label}
                        <input
                          required
                          type={type}
                          value={form[key]}
                          onChange={(e) => field(key, e.target.value)}
                        />
                      </label>
                    ))}
                    <label>
                      담당 직원
                      <select
                        value={form.person}
                        onChange={(e) => field('person', e.target.value)}
                      >
                        {data.people.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      책임 조직
                      <select
                        value={form.org}
                        onChange={(e) => field('org', e.target.value)}
                      >
                        {data.orgs.map((o: any) => (
                          <option key={o.id} value={o.id}>
                            {o.id} · {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <h4>차변·대변 분개</h4>
                  <p>
                    차변은 자산·비용 증가, 대변은 부채·자본·수익 증가에
                    사용합니다. 각 행은 한쪽 금액만 입력합니다.
                  </p>
                  {form.lines.map((l: any, i: number) => (
                    <div className="ir-line" key={i}>
                      <label>
                        계정과목 {i + 1}
                        <select
                          value={l.account}
                          onChange={(e) =>
                            field(
                              'lines',
                              form.lines.map((x: any, n: number) =>
                                n === i ? { ...x, account: e.target.value } : x,
                              ),
                            )
                          }
                        >
                          {Object.entries(ACCOUNTS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      {['debit', 'credit'].map((k) => (
                        <label key={k}>
                          {k === 'debit' ? '차변' : '대변'} {i + 1}
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l[k]}
                            onChange={(e) =>
                              field(
                                'lines',
                                form.lines.map((x: any, n: number) =>
                                  n === i ? { ...x, [k]: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        disabled={form.lines.length <= 2}
                        onClick={() =>
                          field(
                            'lines',
                            form.lines.filter((_: any, n: number) => n !== i),
                          )
                        }
                      >
                        행 삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={form.lines.length >= 20}
                    onClick={() =>
                      field('lines', [
                        ...form.lines,
                        { account: 'expense', debit: '', credit: '' },
                      ])
                    }
                  >
                    분개 행 추가
                  </button>
                  <h4>세금 확인</h4>
                  <div className="ir-fields">
                    <label>
                      과세 구분
                      <select
                        value={form.tax.type}
                        onChange={(e) =>
                          setForm((f: any) => ({
                            ...f,
                            tax: {
                              ...f.tax,
                              type: e.target.value,
                              base: '',
                              vat: '',
                              deductible: false,
                            },
                          }))
                        }
                      >
                        {[
                          ['unknown', '확인 전'],
                          ['standard', '일반 과세 10%'],
                          ['zero', '영세율 · 근거 필요'],
                          ['exempt', '면세 · 근거 필요'],
                          ['outside', '과세 대상 아님'],
                        ].map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      거래 방향
                      <select
                        value={form.tax.direction}
                        onChange={(e) => tax('direction', e.target.value)}
                      >
                        <option value="purchase">매입·지출</option>
                        <option value="sale">매출</option>
                      </select>
                    </label>
                    <label>
                      세액 증감
                      <select
                        value={form.tax.effect}
                        onChange={(e) => tax('effect', e.target.value)}
                      >
                        <option value="increase">일반 거래 · 증가</option>
                        <option value="decrease">감액·환입 · 감소</option>
                      </select>
                    </label>
                    <label>
                      공급시기 확인일
                      <input
                        required
                        type="date"
                        value={form.tax.supplyDate}
                        onChange={(e) => tax('supplyDate', e.target.value)}
                      />
                    </label>
                    {form.tax.type !== 'unknown' && (
                      <>
                        <label>
                          공급가액
                          <input
                            required
                            type="number"
                            min="0"
                            step="1"
                            value={form.tax.base}
                            onChange={(e) => tax('base', e.target.value)}
                          />
                        </label>
                        <label>
                          증빙에 기재된 세액
                          <input
                            required
                            type="number"
                            min="0"
                            step="1"
                            value={form.tax.vat}
                            onChange={(e) => tax('vat', e.target.value)}
                          />
                        </label>
                        <label className="ir-check">
                          <input
                            type="checkbox"
                            disabled={
                              form.tax.type !== 'standard' ||
                              form.tax.direction !== 'purchase'
                            }
                            checked={form.tax.deductible}
                            onChange={(e) =>
                              tax('deductible', e.target.checked)
                            }
                          />
                          매입세액 공제 요건 확인
                        </label>
                      </>
                    )}
                    <label>
                      과세·공급시기 판단 근거
                      <input
                        required
                        value={form.tax.basis}
                        onChange={(e) => tax('basis', e.target.value)}
                        placeholder="계약·세금계산서 또는 확인이 필요한 사항"
                      />
                    </label>
                  </div>
                  {form.tax.type !== 'unknown' &&
                    form.tax.base !== '' &&
                    Number(form.tax.base) >= 0 && (
                      <p>
                        계산 참고값:{' '}
                        {money(
                          vatCalculation(Number(form.tax.base), form.tax.type),
                        )}{' '}
                        · 1원 미만 절사. 저장 시 증빙 세액을 대조합니다.
                      </p>
                    )}
                  <div className="ir-actions">
                    <button disabled={busy} type="submit">
                      {busy ? '저장 중' : '전표와 보관본 저장'}
                    </button>
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => setForm(null)}
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}
              {reverse && (
                <form
                  className="ir-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save({
                      action: 'reverse',
                      targetId: reverse.id,
                      date,
                      reason,
                    });
                  }}
                >
                  <h3>원전표 보존 정정</h3>
                  <p>
                    {reverse.ref} · {reverse.description} · {date} 날짜로 반대
                    분개를 추가합니다. 수정 전표는 새로 등록합니다.
                  </p>
                  <label>
                    정정 사유
                    <input
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>반대 전표 저장</button>
                  <button type="button" onClick={() => setReverse(null)}>
                    취소
                  </button>
                </form>
              )}
              {tab === '일간·월간 재무보고' && (
                <>
                  <h3>{date} 일간보고</h3>
                  <dl className="ir-summary">
                    <div>
                      <dt>기록된 입금</dt>
                      <dd>{money(report.cashIn)}</dd>
                    </div>
                    <div>
                      <dt>기록된 출금</dt>
                      <dd>{money(report.cashOut)}</dd>
                    </div>
                    <div>
                      <dt>당일 순증감</dt>
                      <dd>{money(report.net)}</dd>
                    </div>
                    <div>
                      <dt>실제 은행 잔액</dt>
                      <dd>확인 전</dd>
                    </div>
                  </dl>
                  <p>
                    서비스 원장과 회사 자체 전표의 입출금을 합산했습니다. 연결
                    전표의 입출금은 다시 더하지 않습니다.
                  </p>
                  <h3>{date.slice(0, 7)} 월간보고 · 기준일까지</h3>
                  <p>
                    입금 {money(data.monthReport.cashIn)} · 출금{' '}
                    {money(data.monthReport.cashOut)} · 순증감{' '}
                    {money(data.monthReport.net)}
                  </p>
                  <h3>오늘 확인할 항목</h3>
                  <ul>
                    <li>
                      회계 전표 연결 전 서비스 기록: {report.pending.length}건
                    </li>
                    <li>
                      기준일까지의 전표 중 이번 달 공급분 세금 미확인:{' '}
                      {report.vat.unknown}건
                    </li>
                    <li>
                      오늘 등록된 분개 합계: 차변 {money(report.debit)} / 대변{' '}
                      {money(report.credit)}
                    </li>
                  </ul>
                  <p>
                    서비스 원가·잠정 손익은 기존 서비스 정산에서 확인합니다.
                    여기의 분개와 세금 집계는 입력 자료 범위의 회계
                    관리치입니다.
                  </p>
                </>
              )}
              {tab === '수입·지출/출납' && (
                <>
                  <h3>{date} 일계표</h3>
                  <p>
                    일간보고와 같은 원장 버전 {report.version}에서 계산했습니다.
                    입금 {money(report.cashIn)} · 출금 {money(report.cashOut)} ·
                    순증감 {money(report.net)}
                  </p>
                  <div className="ir-table">
                    <table>
                      <thead>
                        <tr>
                          <th>거래번호</th>
                          <th>내용</th>
                          <th>원본</th>
                          <th>입금</th>
                          <th>출금</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.cashRows.map((r: any) => (
                          <tr key={r.id}>
                            <td>{r.ref}</td>
                            <td>{r.label}</td>
                            <td>{r.origin}</td>
                            <td>{r.cash > 0 ? money(r.cash) : '—'}</td>
                            <td>{r.cash < 0 ? money(-r.cash) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!report.cashRows.length && (
                    <p>이 날짜에 기록된 입출금이 없습니다.</p>
                  )}
                  <p>
                    전체 기록 누적 순증감 {money(report.recordedCumulative)} ·
                    기초잔액과 은행 대조 전이므로 현재 보유현금으로 확정하지
                    않습니다.
                  </p>
                </>
              )}
              {tab === '경리·회계/일계표' && (
                <>
                  <h3>회계 전표와 정정 이력</h3>
                  <div className="ir-table">
                    <table>
                      <thead>
                        <tr>
                          <th>거래일·번호</th>
                          <th>내용·증빙</th>
                          <th>직원·조직</th>
                          <th>분개</th>
                          <th>기록자·정정</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.journals
                          .filter((j: Journal) => j.date <= date)
                          .map((j: Journal) => (
                            <tr key={j.id}>
                              <td>
                                {j.date}
                                <small>{j.ref}</small>
                              </td>
                              <td>
                                {j.description}
                                <details>
                                  <summary>증빙과 원본</summary>
                                  <p>{j.evidence}</p>
                                  <p>{j.sourceKey || '회사 자체 거래'}</p>
                                  <p>저장 {j.at}</p>
                                </details>
                              </td>
                              <td>
                                {data.people.find((p: any) => p.id === j.person)
                                  ?.name || j.person}
                                <small>{j.org}</small>
                              </td>
                              <td>
                                {j.lines.map((l, i) => (
                                  <div key={i}>
                                    {ACCOUNTS[l.account]} · 차 {money(l.debit)}{' '}
                                    / 대 {money(l.credit)}
                                  </div>
                                ))}
                              </td>
                              <td>
                                {j.actor}
                                <small>
                                  {j.reverses ? (
                                    '원전표 반대 분개'
                                  ) : data.ledger.journals.some(
                                      (r: Journal) => r.reverses === j.id,
                                    ) ? (
                                    '정정 전표 있음'
                                  ) : (
                                    <button
                                      disabled={busy}
                                      onClick={() => {
                                        setReverse(j);
                                        setForm(null);
                                      }}
                                    >
                                      정정 기록
                                    </button>
                                  )}
                                </small>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.ledger.journals.length && (
                    <p>
                      저장된 전표가 없습니다. 실제 증빙을 확인한 거래부터 등록해
                      주세요.
                    </p>
                  )}
                  <h3>계정별 합계잔액</h3>
                  <div className="ir-table">
                    <table>
                      <thead>
                        <tr>
                          <th>계정</th>
                          <th>누적 차변</th>
                          <th>누적 대변</th>
                          <th>차변 − 대변</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.accounts
                          .filter((a: any) => a.debit || a.credit)
                          .map((a: any) => (
                            <tr key={a.account}>
                              <td>{a.label}</td>
                              <td>{money(a.debit)}</td>
                              <td>{money(a.credit)}</td>
                              <td>{money(a.debit - a.credit)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === '일간·월간 재무보고' && (
                <>
                  <h3>{report.vat.month} 부가가치세 대조</h3>
                  <dl className="ir-summary">
                    <div>
                      <dt>기록된 매출세액</dt>
                      <dd>{money(report.vat.output)}</dd>
                    </div>
                    <div>
                      <dt>공제 확인 매입세액</dt>
                      <dd>{money(report.vat.input)}</dd>
                    </div>
                    <div>
                      <dt>차액 참고값</dt>
                      <dd>{money(report.vat.difference)}</dd>
                    </div>
                  </dl>
                  <p>
                    공급시기 기준 월 집계입니다. 미확인 {report.vat.unknown}건과
                    미연결 서비스 기록은 확정 계산에 포함하지 않습니다.
                    공제·가산세·예정고지 등을 모두 반영한 신고세액이 아닙니다.
                  </p>
                  <h3>적용 기준</h3>
                  <p>
                    일반 과세 참고 세율은 10%입니다. 사업자 과세유형,
                    면세·영세율, 공급시기와 공제 요건은 증빙으로 확인해
                    입력합니다. 계산값은 원 단위 절사 참고치이며 증빙 세액과
                    최대 1원 차이만 허용합니다.
                  </p>
                  <p>
                    <a
                      href="https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1031738829"
                      target="_blank"
                      rel="noreferrer"
                    >
                      부가가치세법 제30조
                    </a>{' '}
                    ·{' '}
                    <a
                      href="https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7696&mi=2275"
                      target="_blank"
                      rel="noreferrer"
                    >
                      국세청 세율 안내
                    </a>{' '}
                    · 확인일 2026-09-15
                  </p>
                  <h3>원천세·법인세</h3>
                  <p>
                    급여·용역 구분, 과세표준, 공제 자료 확인 전입니다. 자동
                    확정하지 않으며, 확인된 세액은 예수금·세금과공과 전표와
                    증빙으로 기록합니다. 실제 신고·납부·세금계산서 발행은 별도
                    승인 절차입니다.
                  </p>
                </>
              )}
              {tab === '증빙·승인' && (
                <>
                  <h3>CCHR 공통 직원 기준 · 지출 결재 대조</h3>
                  <p>
                    기존 인사·결재 기록을 직접 조회합니다. 승인액이나 지급 기록
                    등록시각을 실제 출금으로 간주하지 않습니다. 지급 증빙과
                    거래일을 확인해 회사 전표에 기록합니다.
                  </p>
                  <div className="ir-table">
                    <table>
                      <thead>
                        <tr>
                          <th>결재 번호</th>
                          <th>직원</th>
                          <th>내용</th>
                          <th>금액</th>
                          <th>상태·증빙</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payments.map((r: any) => (
                          <tr key={r.id}>
                            <td>지출 #{r.id}</td>
                            <td>
                              {data.people.find((p: any) => p.id === r.person)
                                ?.name || r.person}
                            </td>
                            <td>
                              {r.data.title}
                              <small>{r.data.payee}</small>
                            </td>
                            <td>{money(r.data.amount)}</td>
                            <td>
                              {r.data.status}
                              <small>{r.data.proof || '증빙 확인 전'}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.payments.length && <p>등록된 지출 결재가 없습니다.</p>}
                  <BrandPurchasePanel onChanged={load}/>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
