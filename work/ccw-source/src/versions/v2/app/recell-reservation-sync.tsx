'use client';
import {uploadForm} from '@/versions/v2/lib/direct-upload-client';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecellJob = {
  id: string;
  status: string;
  files: { name: string; size: number; sha256: string }[];
  createdAt: string;
  stage: string;
  error?: string | null;
  summary?: {
    addedReservations: number;
    changedReservations: number;
    cancelledReservations: number;
    reviewRequired: number;
  } | null;
};

type RecellJobsResponse = { jobs?: RecellJob[]; error?: string };

const statusLabel: Record<string, string> = {
  queued: '자동 대조 대기',
  processing: '자동 반영 중',
  prepared: '검수·승인 대기',
  approved: '승인됨 · 반영 대기',
  completed: '반영·검증 완료',
  review: '대표 확인 필요',
  failed: '처리 실패',
};

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '—';

export default function RecellReservationSync() {
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<RecellJob[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/recell-reservations', {
      cache: 'no-store',
    });
    const body = (await response.json()) as RecellJobsResponse;
    if (!response.ok)
      throw Error(body.error || '예약 반영 현황을 불러오지 못했습니다.');
    setJobs(body.jobs || []);
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        await load();
        if (alive) setError('');
      } catch (reason) {
        if (alive)
          setError(reason instanceof Error ? reason.message : '현황 조회 실패');
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [load]);

  async function upload() {
    if (!files.length) {
      setError('EMR에서 같은 시점에 수출한 예약 PDF를 선택해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      files.forEach((file) => data.append('files', file));
      const response = await uploadForm('/api/recell-reservations',data);
      const body = (await response.json()) as RecellJobsResponse;
      if (!response.ok) throw Error(body.error || '파일을 올리지 못했습니다.');
      setFiles([]);
      if (input.current) input.current.value = '';
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '파일 업로드 실패');
    } finally {
      setBusy(false);
    }
  }

  async function approve(job: RecellJob) {
    const summary = job.summary;
    if (
      !window.confirm(
        `신규 ${summary?.addedReservations || 0}건 · 변경 ${summary?.changedReservations || 0}건 · 취소 ${summary?.cancelledReservations || 0}건을 솔라피에 반영할까요?`,
      )
    )
      return;
    setApproving(job.id);
    setError('');
    try {
      const response = await fetch('/api/recell-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id: job.id }),
      });
      const body = (await response.json()) as RecellJobsResponse;
      if (!response.ok) throw Error(body.error || '검수 승인을 저장하지 못했습니다.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '검수 승인 실패');
    } finally {
      setApproving('');
    }
  }

  const latest = jobs[0];
  return (
    <section className="recell-sync" aria-label="연세리셀 예약 자동 반영">
      <header>
        <div>
          <span className="ss-eyebrow">YONSEI RECELL · RESERVATION SYNC</span>
          <h4>예약 PDF 올리기</h4>
          <p>
            EMR에서 수출한 예약 파일을 올리면 신규·변경·취소를 현재 예약과
            대조합니다. 건수를 검수·승인하면 솔라피 예약에 반영합니다.
          </p>
        </div>
        {latest && (
          <strong className={`recell-sync-status is-${latest.status}`}>
            {statusLabel[latest.status] || latest.status}
          </strong>
        )}
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <label className="recell-sync-drop">
          <span>같은 시점에 수출한 PDF 전체 선택</span>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
          <small>
            {files.length
              ? files.map((file) => file.name).join(' · ')
              : '예: 9월 예약 PDF + 10월 예약 PDF'}
          </small>
        </label>
        <button className="ss-primary" disabled={busy || !files.length}>
          {busy ? '안전하게 업로드 중…' : '업로드하고 자동 대조 시작'}
        </button>
      </form>
      <p className="recell-sync-rule">
        당일 10:00 · 전날 17:00 · 09:00/09:30/10:00 예약은 각각
        08:00/08:30/09:00 예외 적용 · 7일 이내는 당일 안내만 · 확정/즉시 발송
        없음
      </p>
      {error && (
        <p role="alert" className="recell-sync-error">
          {error}
        </p>
      )}
      <div className="recell-sync-history">
        {jobs.slice(0, 6).map((job) => (
          <article key={job.id}>
            <div>
              <b>{statusLabel[job.status] || job.status}</b>
              <span>
                {formatTime(job.createdAt)} · PDF {job.files.length}개
              </span>
              <small>{job.stage}</small>
            </div>
            {job.summary ? (
              <dl>
                <div>
                  <dt>신규</dt>
                  <dd>{job.summary.addedReservations}</dd>
                </div>
                <div>
                  <dt>변경</dt>
                  <dd>{job.summary.changedReservations}</dd>
                </div>
                <div>
                  <dt>취소</dt>
                  <dd>{job.summary.cancelledReservations}</dd>
                </div>
                <div>
                  <dt>확인 필요</dt>
                  <dd>{job.summary.reviewRequired}</dd>
                </div>
              </dl>
            ) : (
              <span className={`recell-sync-status is-${job.status}`}>
                {statusLabel[job.status] || job.status}
              </span>
            )}
            {job.status === 'prepared' && (
              <button
                type="button"
                className="ss-primary recell-sync-approve"
                disabled={approving === job.id}
                onClick={() => void approve(job)}
              >
                {approving === job.id ? '승인 저장 중…' : '검수 승인하고 반영'}
              </button>
            )}
            {job.error && <p role="alert">{job.error}</p>}
          </article>
        ))}
        {!jobs.length && <p>아직 업로드한 예약 파일이 없습니다.</p>}
      </div>
      <details>
        <summary>자동 반영 안전 기준</summary>
        <ul>
          <li>
            기존에 발송 완료된 문자는 보존하고 미발송 예약만 변경·취소합니다.
          </li>
          <li>
            발송 시각이 지났거나 환자 식별이 불확실한 건은 즉시 보내지 않고 확인
            필요로 남깁니다.
          </li>
          <li>
            고객 메모의 실제 환자명·전화번호를 우선 대조하되 추정으로 확정하지
            않습니다.
          </li>
          <li>
            환자 개인정보는 이 화면의 작업 이력과 오류 문구에 표시하지 않습니다.
          </li>
        </ul>
      </details>
    </section>
  );
}
