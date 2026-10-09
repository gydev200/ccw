'use client';
import { useEffect, useState } from 'react';
import {
  LENSES,
  DOMAINS,
  simulate,
  type Agenda,
  type Strategy,
  type Option,
} from '@/lib/dss-strategy';
import { STAFF, DEPARTMENTS, kstDay } from '@/lib/work-orders';
type Props = {
  draft: Agenda;
  setDraft: (a: Agenda) => void;
  strategy: Strategy;
  busy: boolean;
  save: () => Promise<void>;
  send: (action: string, extra: object) => Promise<boolean>;
  reviews: Review[];
  close: () => void;
  dirty: boolean;
};
export type Review = {
  id: string;
  agendaId: string;
  revision: number;
  reviewer: string;
  role: string;
  expiresAt: string;
  revoked: boolean;
  submitted: boolean;
  brief: string;
  opinion?: string;
  dissent?: string;
  submittedAt?: string;
};
export function InputField({
  label,
  value,
  onChange,
  area = false,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      {area ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </label>
  );
}
const roles = ['외부 이사', '자문', '고문', '이사님'];
export default function AgendaEditor({
  draft: a,
  setDraft,
  strategy,
  busy,
  save,
  send,
  reviews,
  close,
  dirty,
}: Props) {
  const [tab, setTab] = useState('안건'),
    [note, storeNote] = useState({
      author: '',
      role: roles[0],
      opinion: '',
      dissent: '',
      source: '',
    }),
    [request, storeRequest] = useState({
      reviewer: '',
      role: roles[0],
      expires: kstDay(),
      brief: '',
    }),
    [link, setLink] = useState(''),
    [localError, setLocalError] = useState('');
  const [recommendation,setRecommendation]=useState(a.workflow?.recommendation||''),[returnReason,setReturnReason]=useState('');
  const [order, storeOrder] = useState({
    title: a.title,
    org: 'DSS',
    assignee: STAFF[0].person as string,
    date: kstDay(),
    due: kstDay() + 'T18:00',
    instruction: '',
    criterion: '',
    sourceTitle: '경영 결정 후 내부 실행',
    sourceUrl: '',
  });
  const [auxDirty, setAuxDirty] = useState({
    note: false,
    request: false,
    order: false,
  });
  const hasAuxDirty = Object.values(auxDirty).some(Boolean);
  function setNote(value: typeof note) {
    storeNote(value);
    setAuxDirty((d) => ({ ...d, note: true }));
  }
  function setRequest(value: typeof request) {
    storeRequest(value);
    setAuxDirty((d) => ({ ...d, request: true }));
  }
  function setOrder(value: typeof order) {
    storeOrder(value);
    setAuxDirty((d) => ({ ...d, order: true }));
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasAuxDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasAuxDirty]);
  const stored = strategy.agendas.find((x) => x.id === a.id),
    frozen = !!a.executionKey;
  const put = (key: keyof Agenda, value: unknown) =>
    setDraft({ ...a, [key]: value });
  const option = (id: string, key: keyof Option, value: unknown) =>
    put(
      'options',
      a.options.map((o) => (o.id === id ? { ...o, [key]: value } : o)),
    );
  async function share() {
    setLocalError('');
    try {
      const r = await fetch('/api/dss-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          version: strategy.version,
          agendaId: a.id,
          ...request,
        }),
      });
      const d = (await r.json()) as { error?: string; url: string };
      if (!r.ok) throw Error(d.error || '검토 링크를 만들지 못했습니다.');
      setLink(d.url);
      setAuxDirty((v) => ({ ...v, request: false }));
      await send('reload', {});
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  function downloadBrief() {
    const blob = new Blob([request.brief], {
        type: 'text/plain;charset=utf-8',
      }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '안건-검토자료.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="ds-editor"
      aria-label="안건 작업공간"
      data-dirty={dirty || hasAuxDirty ? 'true' : undefined}
      data-aux-dirty={hasAuxDirty ? 'true' : undefined}
    >
      <header className="ds-section-head">
        <div>
          <button className="ds-link" onClick={close}>
            안건 목록으로
          </button>
          <h2>{a.title || '새 의사결정 안건'}</h2>
        </div>
        {frozen && (
          <button
            onClick={() =>
              setDraft({
                ...a,
                id: crypto.randomUUID(),
                revision: 0,
                title: a.title + ' · 후속 판단',
                status: '재검토',
                selected: '',
                reason: '',
                executionKey: '',
                notes: [],
                createdAt: '',
                updatedAt: '',
              })
            }
          >
            후속 안건 만들기
          </button>
        )}
        <button className="ds-primary" disabled={busy || frozen} onClick={save}>
          {busy ? '저장 중…' : '안건 저장'}
        </button>
      </header>
      <nav className="ds-tabs" aria-label="안건 작업 단계">
        {['안건', '대안·영향', '시뮬레이션', '외부 검토', '결정·실행'].map(
          (t) => (
            <button
              key={t}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </nav>
      {tab === '안건' && (
        <fieldset disabled={frozen} className="ds-form">
          <InputField
            label="안건명"
            value={a.title}
            onChange={(v) => put('title', v)}
            required
          />
          <div className="ds-cols">
            <label>
              발견 관점
              <select
                value={a.lens}
                onChange={(e) => put('lens', e.target.value)}
              >
                {LENSES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              경영 영역
              <select
                value={a.domain}
                onChange={(e) => put('domain', e.target.value)}
              >
                {DOMAINS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <InputField
              label="결정 기한"
              type="date"
              value={a.deadline}
              onChange={(v) => put('deadline', v)}
            />
          </div>
          <InputField
            label="무엇을 결정해야 합니까?"
            value={a.question}
            onChange={(v) => put('question', v)}
            area
            required
          />
          <InputField
            label="확인한 사실·변화 신호"
            value={a.evidence}
            onChange={(v) => put('evidence', v)}
            area
          />
          <InputField
            label="원문·근거 주소"
            value={a.sourceUrl}
            onChange={(v) => put('sourceUrl', v)}
          />
          <label>
            판단할 목표
            <select
              value={a.goalId}
              onChange={(e) => put('goalId', e.target.value)}
            >
              <option value="">목표 연결 전</option>
              {strategy.directions.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.direction} · {g.horizon}
                </option>
              ))}
            </select>
          </label>
          <InputField
            label="결정 기준·우선순위"
            value={a.criteria}
            onChange={(v) => put('criteria', v)}
            area
          />
        </fieldset>
      )}
      {tab === '대안·영향' && (
        <fieldset disabled={frozen}>
          <div className="ds-table-wrap">
            <table className="ds-matrix">
              <thead>
                <tr>
                  <th scope="col">비교 항목</th>
                  {a.options.map((o) => (
                    <th key={o.id}>
                      <input
                        aria-label={'대안 이름 ' + o.name}
                        value={o.name}
                        onChange={(e) => option(o.id, 'name', e.target.value)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['basis', '가정·근거'],
                    ['benefit', '기대효과'],
                    ['risk', '손실·부작용'],
                    ['people', '인력·시간'],
                    ['cash', '현금·비용'],
                    ['customer', '고객여정'],
                    ['information', '정보·시스템'],
                    ['security', '보안·노출'],
                    ['reversible', '되돌릴 방법'],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    {a.options.map((o) => (
                      <td key={o.id}>
                        <textarea
                          aria-label={o.name + ' ' + label}
                          rows={3}
                          value={o[key]}
                          onChange={(e) => option(o.id, key, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}
      {tab === '시뮬레이션' && (
        <fieldset disabled={frozen}>
          <p className="ds-muted">
            직접 입력한 월간 가정으로 계산합니다. 실제 원장과 세금은 반영하지
            않습니다.
          </p>
          <div className="ds-table-wrap">
            <table className="ds-matrix">
              <thead>
                <tr>
                  <th>월간 가정</th>
                  {a.options.map((o) => (
                    <th key={o.id}>{o.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['customers', '고객사 수'],
                    ['price', '고객사당 매출 · 원'],
                    ['variable', '고객사당 변동비 · 원'],
                    ['fixed', '월 고정비 · 원'],
                    ['investment', '초기 투자 · 원'],
                    ['cash', '시작 현금 · 원'],
                    ['hours', '고객사당 업무 · 시간'],
                    ['capacity', '월 가용시간'],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    {a.options.map((o) => (
                      <td key={o.id}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          aria-label={o.name + ' ' + label}
                          value={o.scenario[key] ?? ''}
                          onChange={(e) =>
                            option(o.id, 'scenario', {
                              ...o.scenario,
                              [key]:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {[
                  '월 매출',
                  '월 비용',
                  '월 현금 증감',
                  '투자 후 현금',
                  '현금 소진까지',
                  '업무시간 여유',
                ].map((label, i) => (
                  <tr className="ds-result" key={label}>
                    <th scope="row">{label}</th>
                    {a.options.map((o) => {
                      let r: ReturnType<typeof simulate> = null;
                      try {
                        r = simulate(o.scenario);
                      } catch {}
                      const v = r
                        ? [
                            r.revenue,
                            r.cost,
                            r.monthly,
                            r.available,
                            r.runway,
                            r.remaining,
                          ][i]
                        : null;
                      return (
                        <td key={o.id}>
                          {!r
                            ? '입력 전'
                            : v === null
                              ? '월 적자 없음'
                              : i === 4
                                ? v.toFixed(1) + '개월'
                                : v.toLocaleString('ko-KR') +
                                  (i === 5 ? '시간' : '원')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ds-muted">
            현금 소진까지 = 투자 후 현금 ÷ 월 적자. 업무시간 여유 = 월 가용시간
            − 고객사 수 × 고객사당 시간.
          </p>
        </fieldset>
      )}
      {tab === '외부 검토' && (
        <div className="ds-form">
          <section className="ds-paper">
            <h3>검토 요청</h3>
            <div className="ds-cols">
              <InputField
                label="검토자 이름"
                value={request.reviewer}
                onChange={(v) => setRequest({ ...request, reviewer: v })}
              />
              <label>
                역할
                <select
                  value={request.role}
                  onChange={(e) =>
                    setRequest({ ...request, role: e.target.value })
                  }
                >
                  {roles.slice(0, 3).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <InputField
                label="의견 마감"
                type="date"
                value={request.expires}
                onChange={(v) => setRequest({ ...request, expires: v })}
              />
            </div>
            <button
              onClick={() =>
                setRequest({
                  ...request,
                  brief: `${a.title}\n\n결정할 질문\n${a.question}\n\n판단 기준\n${a.criteria}\n\n대안\n${a.options.map((o) => o.name + ': ' + o.benefit + ' / 우려: ' + o.risk).join('\n')}\n\n검토 요청\n권고 대안, 반대 근거, 바꿔야 할 가정을 알려주세요.`,
                })
              }
            >
              검토자료 초안 채우기
            </button>
            <InputField
              label="외부에 보여줄 자료"
              area
              value={request.brief}
              onChange={(v) => setRequest({ ...request, brief: v })}
            />
            <p className="ds-muted">
              아래 링크는 이 자료만 보여줍니다. 링크를 가진 사람은 열 수
              있으므로 수신자와 내용을 확인해 전달하세요. 원장·직원 기록은
              포함되지 않습니다.
            </p>
            <div className="ds-actions">
              <button disabled={!request.brief} onClick={downloadBrief}>
                자료 내려받기
              </button>
              <button
                disabled={
                  busy ||
                  !stored ||
                  dirty ||
                  !request.brief ||
                  !request.reviewer
                }
                onClick={share}
              >
                검토 링크 만들기
              </button>
            </div>
            {(!stored || dirty) && <p>먼저 안건을 저장해 주세요.</p>}
            {localError && (
              <p role="alert" className="ds-error">
                {localError}
              </p>
            )}
            {link && (
              <label>
                전달할 검토 링크
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
          </section>
          {reviews
            .filter((r) => r.agendaId === a.id)
            .map((r) => (
              <article className="ds-review-row" key={r.id}>
                <header>
                  <b>
                    {r.reviewer} · {r.role}
                  </b>
                  <span>
                    {r.revoked
                      ? '종료'
                      : r.submitted
                        ? '의견 도착'
                        : '회신 대기'}{' '}
                    · {r.expiresAt.slice(0, 10)}
                  </span>
                </header>
                {r.revision !== a.revision && (
                  <p className="ds-muted">이전 안건 {r.revision}차 기준 의견</p>
                )}
                <p className="ds-pre">{r.opinion}</p>
                <p className="ds-pre">{r.dissent}</p>
                {!r.revoked && (
                  <button
                    disabled={busy}
                    onClick={() => send('revoke', { id: r.id })}
                  >
                    검토 링크 종료
                  </button>
                )}
              </article>
            ))}
          <details className="ds-paper">
            <summary>회의·전화로 받은 의견 기록</summary>
            <div className="ds-form">
              <div className="ds-cols">
                <InputField
                  label="의견을 준 분"
                  value={note.author}
                  onChange={(v) => setNote({ ...note, author: v })}
                />
                <label>
                  역할
                  <select
                    value={note.role}
                    onChange={(e) => setNote({ ...note, role: e.target.value })}
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </div>
              <InputField
                label="검토 의견"
                area
                value={note.opinion}
                onChange={(v) => setNote({ ...note, opinion: v })}
              />
              <InputField
                label="반대·조건"
                area
                value={note.dissent}
                onChange={(v) => setNote({ ...note, dissent: v })}
              />
              <InputField
                label="회의일·원문 등 기록 근거"
                value={note.source}
                onChange={(v) => setNote({ ...note, source: v })}
              />
              <button
                disabled={busy || !stored || dirty}
                onClick={async () => {
                  if (
                    await send('note', { data: { ...note, agendaId: a.id } })
                  ) {
                    setAuxDirty((v) => ({ ...v, note: false }));
                    storeNote({
                      author: '',
                      role: roles[0],
                      opinion: '',
                      dissent: '',
                      source: '',
                    });
                  }
                }}
              >
                받은 의견 저장
              </button>
            </div>
          </details>
          {a.notes.map((n) => (
            <article className="ds-review-row" key={n.id}>
              <b>
                {n.author} · {n.role}
              </b>
              <p>{n.opinion}</p>
              <p>{n.dissent}</p>
              <small>
                {n.source} · 이사님 대리 기록 · {n.at.slice(0, 10)}
              </small>
            </article>
          ))}
        </div>
      )}
      <section className="ds-paper"><h3>DSS 준비·상신</h3><p>현재 단계: {stored?.workflow?.stage||'준비'}. 준비한 안건을 상신해야 대표 판단함에 표시됩니다.</p><InputField label="DSS 권고안·선택 이유" area value={recommendation} onChange={setRecommendation}/><button className="ds-primary" disabled={busy||dirty||!stored||!!stored.executionKey||stored.workflow?.stage==='상신'||stored.status==='결정'} onClick={()=>send('submit',{agendaId:a.id,recommendation})}>대표에게 상신</button>{stored?.workflow?.stage==='상신'&&<><p>상신 뒤 안건 내용을 수정하여 저장하면 준비 단계로 돌아갑니다.</p><InputField label="대표 보완 요청" value={returnReason} onChange={setReturnReason}/><button disabled={busy||dirty||!returnReason.trim()} onClick={()=>send('return',{agendaId:a.id,reason:returnReason})}>DSS에 보완 요청</button></>}</section>
      {tab === '결정·실행' && (
        <div className="ds-form">
          <fieldset disabled={frozen}>
            <div className="ds-cols">
              <label>
                판단 상태
                <select
                  value={a.status}
                  onChange={(e) => put('status', e.target.value)}
                >
                  {['검토 중', '결정', '보류', '재검토'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                선택 대안
                <select
                  value={a.selected}
                  onChange={(e) => put('selected', e.target.value)}
                >
                  <option value="">선택 전</option>
                  {a.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <InputField
                label="재검토일"
                type="date"
                value={a.reviewDate}
                onChange={(v) => put('reviewDate', v)}
              />
            </div>
            <InputField
              label="결정 이유·기각한 의견의 근거"
              area
              value={a.reason}
              onChange={(v) => put('reason', v)}
            />
            <InputField
              label="실행 중단·방향 수정 기준"
              area
              value={a.stopRule}
              onChange={(v) => put('stopRule', v)}
            />
            <button className="ds-primary" disabled={busy} onClick={save}>
              판단 저장
            </button>
          </fieldset>
          <section className="ds-paper">
            <h3>내부 실행</h3>
            {frozen ? (
              <p>
                내부 업무로 연결됐습니다. 변경 판단은 후속 안건으로 남겨 주세요.
              </p>
            ) : (
              <>
                <div className="ds-cols">
                  <label>
                    담당자
                    <select
                      value={order.assignee}
                      onChange={(e) =>
                        setOrder({ ...order, assignee: e.target.value })
                      }
                    >
                      {STAFF.map((p) => (
                        <option key={p.person} value={p.person}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    실행 부서
                    <select
                      value={order.org}
                      onChange={(e) =>
                        setOrder({ ...order, org: e.target.value })
                      }
                    >
                      {DEPARTMENTS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <InputField
                    label="실행 기한"
                    type="datetime-local"
                    value={order.due}
                    onChange={(v) => setOrder({ ...order, due: v })}
                  />
                </div>
                <InputField
                  label="내부 업무명"
                  value={order.title}
                  onChange={(v) => setOrder({ ...order, title: v })}
                />
                <InputField
                  label="담당자에게 전달할 실행 지시"
                  area
                  value={order.instruction}
                  onChange={(v) => setOrder({ ...order, instruction: v })}
                />
                <InputField
                  label="완료 판단 기준"
                  area
                  value={order.criterion}
                  onChange={(v) => setOrder({ ...order, criterion: v })}
                />
                <button
                  className="ds-primary"
                  disabled={busy || dirty || stored?.status !== '결정'}
                  onClick={async () => {
                    if (await send('execute', { agendaId: a.id, order }))
                      setAuxDirty((v) => ({ ...v, order: false }));
                  }}
                >
                  결정을 내부 업무로 배정
                </button>
                <p className="ds-muted">
                  판단을 저장한 뒤 배정합니다. 전달할 실행 지시와 완료 기준만
                  담당자의 업무에 보입니다.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
