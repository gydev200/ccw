'use client';
import RoutineControl from './fm-routine-control';
import {ROUTINE_CYCLES,routineTemplates,routineCoverage} from '@/versions/v2/lib/fm-routines';
import { useState } from 'react';
import type { WorkItem } from '@/versions/v2/lib/ccfm';
const amount = (n: number | null | undefined) =>
  n == null ? '확인 전' : n.toLocaleString('ko-KR') + '원';
export function CCFMWork({
  data,
  kind,
  busy,
  save,
  date,
  onReload,
}: {
  data: any;
  kind: 'task' | 'invoice';
  busy: boolean;
  save: (c: any) => Promise<any>;
  date: string;
  onReload?:()=>Promise<any>;
}) {
  const [cycle,setCycle]=useState('daily'),[reviewDate,setReviewDate]=useState(date),[routinePerson,setRoutinePerson]=useState('do');
  const [form, setForm] = useState<any>(null),
    [edit, setEdit] = useState<any>(null);
  const rows: WorkItem[] = (data.ledger.work || []).filter(
    (w: WorkItem) => w.kind === kind,
  );
  const coverage=kind==='task'?routineCoverage(data.ledger.work||[],date):[];
  const change = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <section>
      <div className="ir-heading">
        <h3>{kind === 'task' ? '업무현황' : '세금계산서 관리'}</h3>
        <button
          disabled={busy}
          onClick={() =>
            setForm({
              kind,
              title: '',
              person: 'do',
              org: 'DSS',
              due: date,
              evidence: '',
              direction: 'issue',
              party: '',
              base: '',
              vat: '',
              sourceKey: '',
              journalId: '',
            })
          }
        >
          {kind === 'task' ? '재무 업무 등록' : '수취·발행요청 등록'}
        </button>
      </div>
      {kind === 'task' ? (
        <>
          <p>
            수입·지출 증빙 확인, 전표 분개, 일계표 대조, 세금계산서 수취·발행
            준비, 일간·월간 보고와 미처리 항목을 관리합니다.
          </p>
          <ul className="ir-work-scope">
            <li>경리: 입출금 증빙·거래처·미수금·지급 요청 대조</li>
            <li>회계: 계정 분개·정정 이력·원장과 일계표 일치 확인</li>
            <li>세무: 공급시기·세액·세금계산서 증빙 확인과 발행 준비</li>
            <li>보고: 원장 기준시각·확인 필요 항목·담당자·처리기한 보고</li>
          </ul>
          <p>
            미연결 원본 거래 {data.report.pending.length}건 · 세금 확인 전{' '}
            {data.report.vat.unknown}건 · 원본 변경 {data.report.changed.length}
            건
          </p>
        </>
      ) : (
        <p>
          수취·검토·발행요청 상태를 저장합니다. 국세청 실행 연결은 준비
          전입니다. ‘외부 발행 확인’은 승인번호와 실제 증빙을 등록한 상태입니다.
        </p>
      )}
      {kind==='task'&&<section aria-label="주기별 업무 누락 점검">
        <h4>주기별 등록·처리 현황</h4>
        <p>{date} 기준 기간의 매뉴얼 업무입니다. 미등록은 아직 업무를 만들지 않은 상태이며, 법정 기한 초과를 뜻하지 않습니다.</p>
        <div className="ir-table"><table><thead><tr><th>주기·기간</th><th>기준 업무</th><th>미등록</th><th>진행·보류</th><th>완료</th><th>취소</th><th>내부 기한 초과</th><th>확인</th></tr></thead>
          <tbody>{coverage.map(c=><tr key={c.cycle}><td>{c.label} · {c.period}</td><td>{c.total}</td><td>{c.missing}</td><td>{c.open}</td><td>{c.completed}</td><td>{c.cancelled}</td><td>{c.overdue}</td><td><button onClick={()=>setCycle(c.cycle)}>항목 보기</button></td></tr>)}</tbody>
        </table></div>
        <details key={cycle} open><summary>{coverage.find(c=>c.cycle===cycle)?.label} · 등록할 업무와 현재 상태</summary>
          <ul>{coverage.find(c=>c.cycle===cycle)?.items.map(i=><li key={i.key}>{i.title} — <strong>{i.status}</strong>{i.due&&` · 내부 기한 ${i.due}`}{i.overdue&&' · 기한 초과'}</li>)}</ul>
        </details>
      </section>}
      {kind==='task'&&<RoutineControl policy={data.ledger.routinePolicy} people={data.assignmentPeople||data.people} save={c=>save({...c,date})} busy={busy} onReload={onReload}/>}
      {kind==='task'&&<fieldset className="ir-form"><legend>주기별 업무 생성</legend>
        <p>기존 업무 매뉴얼의 항목을 선택한 기간에 한 번만 등록합니다. 이전 미완료는 그대로 남습니다.</p>
        <div className="ir-fields"><label>주기<select value={cycle} onChange={e=>setCycle(e.target.value)}>{ROUTINE_CYCLES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>내부 점검 기한<input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label>
        <label>담당<select value={routinePerson} onChange={e=>setRoutinePerson(e.target.value)}>{(data.assignmentPeople||data.people).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
        <p>기간 기준: {date} · {routineTemplates(cycle,date).length}개 항목. 신고·납부·급여일은 계약과 공식 기한을 별도로 확인합니다.</p>
        <button disabled={busy||!reviewDate} onClick={()=>save({action:'ensureRoutines',date,cycle,due:reviewDate,person:routinePerson})}>이 기간 업무 등록</button>
        <small>수동 생성입니다. 자동 등록 기준과 실행 상태는 위에서 확인합니다.</small>
      </fieldset>}
      {form && (
        <form
          className="ir-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = await save({
              action: 'createWork',
              date,
              item: {
                ...form,
                base: form.base === '' ? null : Number(form.base),
                vat: form.vat === '' ? null : Number(form.vat),
              },
            });
            if (v !== false) setForm(null);
          }}
        >
          <h4>{kind === 'task' ? '업무 등록' : '세금계산서 관리 항목 등록'}</h4>
          <div className="ir-fields">
            {[
              ['title', '업무명', 'text'],
              ['due', '처리기한', 'date'],
              ['evidence', '근거·확인할 사항', 'text'],
            ].map(([k, l, t]) => (
              <label key={k}>
                {l}
                <input
                  required
                  type={t}
                  value={form[k]}
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ))}
            <label>
              담당 직원
              <select
                value={form.person}
                onChange={(e) => change('person', e.target.value)}
              >
                {(data.assignmentPeople||data.people).map((p: any) => (
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
                onChange={(e) => change('org', e.target.value)}
              >
                {data.orgs.map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.name}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'invoice' && (
              <>
                <label>
                  구분
                  <select
                    value={form.direction}
                    onChange={(e) => change('direction', e.target.value)}
                  >
                    <option value="issue">발행요청</option>
                    <option value="receive">수취</option>
                  </select>
                </label>
                <label>
                  거래처
                  <input
                    required
                    value={form.party}
                    onChange={(e) => change('party', e.target.value)}
                  />
                </label>
                <label>
                  확인 공급가액
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="미확인이면 비워둡니다"
                    value={form.base}
                    onChange={(e) => change('base', e.target.value)}
                  />
                </label>
                <label>
                  확인 세액
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.vat}
                    onChange={(e) => change('vat', e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              서비스·지급 원본 연결
              <select
                value={form.sourceKey}
                onChange={(e) => change('sourceKey', e.target.value)}
              >
                <option value="">연결 없음</option>
                {data.sources.map((s: any) => (
                  <option key={s.key} value={s.key}>
                    {s.ref} · {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              회계 전표 연결
              <select
                value={form.journalId}
                onChange={(e) => change('journalId', e.target.value)}
              >
                <option value="">연결 없음</option>
                {data.ledger.journals.map((j: any) => (
                  <option key={j.id} value={j.id}>
                    {j.ref} · {j.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={busy}>관리 항목 저장</button>
          <button type="button" onClick={() => setForm(null)}>
            취소
          </button>
        </form>
      )}
      <div className="ir-table">
        <table>
          <thead>
            <tr>
              <th>업무·근거</th>
              <th>담당·기한</th>
              <th>처리 상태</th>
              {kind === 'invoice' && <th>공급가액·세액</th>}
              <th>이력·처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td>
                  {w.title}
                  <small>{w.party || w.evidence}</small>
                  <details>
                    <summary>근거·연결</summary>
                    <p>{w.evidence}</p>
                    <p>{w.sourceKey || w.journalId || '원본 연결 전'}</p>
                    <p>{w.externalNumber && '승인번호 ' + w.externalNumber}</p>
                  </details>
                </td>
                <td>
                  {data.people.find((p: any) => p.id === w.person)?.name ||
                    w.person}
                  <small>
                    {w.org} · {w.due}
                  </small>
                  {w.due < date &&
                    !['완료', '취소', '수취 확인', '외부 발행 확인'].includes(
                      w.status,
                    ) && <b>기한 경과</b>}
                </td>
                <td>{w.status}</td>
                {kind === 'invoice' && (
                  <td>
                    {amount(w.base)}
                    <small>세액 {amount(w.vat)}</small>
                  </td>
                )}
                <td>
                  <button
                    onClick={() =>
                      setEdit({
                        ...w,
                        note: '',
                        evidence: w.evidence,
                        externalNumber: w.externalNumber || '',
                        base: w.base ?? '',
                        vat: w.vat ?? '',
                        status: '',
                      })
                    }
                  >
                    상태·근거 기록
                  </button>
                  <details>
                    <summary>처리 이력 {w.history.length}건</summary>
                    {w.history.map((h, i) => (
                      <p key={i}>
                        {h.at}
                        <br />
                        {h.status} · {h.note}
                        <br />
                        {h.actor}
                        {h.before && (
                          <small>
                            변경 전 {amount(h.before.base)} / 세액{' '}
                            {amount(h.before.vat)} → 변경 후{' '}
                            {amount(h.after?.base)} / 세액{' '}
                            {amount(h.after?.vat)}
                          </small>
                        )}
                      </p>
                    ))}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p>
          {kind === 'task'
            ? '등록된 재무 업무가 없습니다. 기한과 담당자가 정해진 업무를 등록해 주세요.'
            : '등록된 세금계산서 관리 항목이 없습니다.'}
        </p>
      )}
      {edit && (
        <form
          className="ir-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await save({
              action: 'updateWork',
              date,
              id: edit.id,
              status: edit.status,
              note: edit.note,
              evidence: edit.evidence,
              externalNumber: edit.externalNumber,
              ...(kind === 'invoice'
                ? {
                    base: edit.base === '' ? null : Number(edit.base),
                    vat: edit.vat === '' ? null : Number(edit.vat),
                  }
                : {}),
            });
            if (ok !== false) setEdit(null);
          }}
        >
          <h4>{edit.title} · 처리 기록</h4>
          <div className="ir-fields">
            <label>
              다음 상태
              <select
                required
                value={edit.status}
                onChange={(e) => setEdit({ ...edit, status: e.target.value })}
              >
                <option value="">선택</option>
                {(kind === 'task'
                  ? ['진행', '보류', '완료', '취소']
                  : [
                      '검토 중',
                      '보류',
                      '발행 준비',
                      '외부 발행 확인',
                      '수취 확인',
                      '취소',
                    ]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              처리 근거
              <input
                required
                value={edit.note}
                onChange={(e) => setEdit({ ...edit, note: e.target.value })}
              />
            </label>
            {kind === 'invoice' && (
              <>
                {[
                  ['base', '확인 공급가액', 'number'],
                  ['vat', '확인 세액', 'number'],
                  ['externalNumber', '실제 승인번호', 'text'],
                  ['evidence', '실제 증빙 위치', 'text'],
                ].map(([k, l, t]) => (
                  <label key={k}>
                    {l}
                    <input
                      type={t}
                      value={edit[k]}
                      onChange={(e) =>
                        setEdit({ ...edit, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </>
            )}
          </div>
          <button disabled={busy}>상태 저장</button>
          <button type="button" onClick={() => setEdit(null)}>
            취소
          </button>
        </form>
      )}
    </section>
  );
}
export function CCFMBot({
  data,
  date,
  busy,
  save,
}: {
  data: any;
  date: string;
  busy: boolean;
  save: (c: any) => Promise<any>;
}) {
  const [question, setQuestion] = useState(
    '오늘 입출금과 확인할 업무를 보고해 주세요.',
  );
  return (
    <section>
      <h3>경리봇 상담·업무보고</h3>
      <p>
        저장 원장을 집계하는 경리봇입니다. AI 대화 모델은 연결 전이며, 자유
        질문을 해석한 답변이나 외부 업무 실행을 제공하지 않습니다. 요청 원문과
        실제 원장 기준 보고를 함께 보관합니다.
      </p>
      <form
        className="ir-bot-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ action: 'botReport', date, question });
        }}
      >
        <label>
          상담·보고 요청
          <textarea
            required
            maxLength={2000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <button disabled={busy}>현재 원장으로 업무보고 받기</button>
      </form>
      {[...(data.ledger.reports || [])].reverse().map((r: any) => (
        <article className="ir-bot-report" key={r.id}>
          <h4>{r.date} 재무 업무보고</h4>
          <p>{r.question}</p>
          <p>
            입금 {amount(r.cashIn)} · 출금 {amount(r.cashOut)}
            <br />
            회계 연결 전 {r.pending}건 · 세금 미확인 {r.unknownTax}건 · 미완료
            업무 {r.openWorkIds.length}건
          </p>
          <p>
            기준시각 {r.at} · 원장 버전 {r.sourceVersion}
            <br />
            {r.basis}
          </p>
          <details>
            <summary>실제 근거 기록 보기</summary>
            <p>
              거래 원본 {r.sourceKeys.length}건 / 회계 전표{' '}
              {r.journalIds.length}건
            </p>
            <ul>
              {r.sourceKeys.map((id: string) => (
                <li key={id}>
                  {id} ·{' '}
                  {data.sources.find((s: any) => s.key === id)?.evidence ||
                    '현재 원본과 대조 필요'}
                </li>
              ))}
              {r.journalIds.map((id: string) => (
                <li key={id}>
                  {id} ·{' '}
                  {data.ledger.journals.find((j: any) => j.id === id)
                    ?.evidence || '전표 확인 필요'}
                </li>
              ))}
            </ul>
            <p>
              <a href={'/api/ccfm?backup=' + r.backupVersion}>
                보고 근거 보관본 {r.backupVersion} 내려받기
              </a>
            </p>
          </details>
        </article>
      ))}
    </section>
  );
}
