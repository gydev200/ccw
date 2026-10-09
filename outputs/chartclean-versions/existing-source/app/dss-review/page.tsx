'use client';
import BrandHome from '../brand-home';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../dss-strategy.css';
type ReviewData = {
  reviewer: string;
  role: string;
  brief: string;
  expiresAt: string;
  submitted: boolean;
  opinion: string;
  dissent: string;
  error?: string;
};
export default function ReviewPage() {
  const [data, setData] = useState<{
      reviewer: string;
      role: string;
      brief: string;
      expiresAt: string;
      submitted: boolean;
      opinion: string;
      dissent: string;
    } | null>(null),
    [error, setError] = useState(''),
    [opinion, setOpinion] = useState(''),
    [dissent, setDissent] = useState(''),
    [busy, setBusy] = useState(false);
  async function request(body?: object) {
    const r = await fetch('/api/dss-review', {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-DSS-Review': location.hash.slice(1),
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = (await r.json()) as ReviewData;
    if (!r.ok) throw Error(d.error || '검토 요청을 불러오지 못했습니다.');
    return d;
  }
  useEffect(() => {
    request()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="dss-review-page ds">
      <header>
        <BrandHome/>
        <h1>안건 검토</h1>
      </header>
      {error && (
        <p className="ds-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <output>검토 자료를 불러옵니다.</output>}
      {data && (
        <>
          <p>
            {data.reviewer} · {data.role}{' '}
            <span className="ds-muted">마감 {data.expiresAt.slice(0, 10)}</span>
          </p>
          <section className="ds-paper">
            <h2>검토 요청 자료</h2>
            <p className="ds-pre">{data.brief}</p>
          </section>
          {data.submitted ? (
            <section className="ds-paper">
              <h2>의견이 전달됐습니다</h2>
              <p className="ds-pre">{data.opinion}</p>
              <p className="ds-pre">{data.dissent}</p>
            </section>
          ) : (
            <form
              className="ds-paper"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await request({ opinion, dissent });
                  setData(await request());
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                검토 의견
                <textarea
                  required
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  rows={7}
                />
              </label>
              <label>
                반대 의견·조건·추가로 확인할 점
                <textarea
                  value={dissent}
                  onChange={(e) => setDissent(e.target.value)}
                  rows={4}
                />
              </label>
              <p className="ds-muted">
                링크를 전달받은 검토자의 의견으로 저장됩니다. 결정과 내부 실행은
                이사님이 진행합니다.
              </p>
              <button className="ds-primary" disabled={busy}>
                {busy ? '전달 중…' : '검토 의견 제출'}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
