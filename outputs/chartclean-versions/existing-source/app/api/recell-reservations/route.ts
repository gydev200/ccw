import { env } from '@/lib/runtime';
import {restoreUploadRequest} from '@/lib/direct-upload-server';
import {
  bucket,
  db,
  fail,
  HttpError,
  json,
  member,
  origin,
  owner,
} from '@/lib/server';
import { isPreparationWorker } from '@/lib/ss-preparation-worker';
import {
  publicRecellSyncJob,
  RECELL_SYNC_RULES,
  RECELL_SYNC_STATUSES,
  type RecellSyncFile,
  type RecellSyncJob,
  validateRecellSyncSummary,
} from '@/lib/recell-reservation-sync';

export const dynamic = 'force-dynamic';
const PREFIX = 'recell-sync:job:';
const MAX_FILE = 12 * 1024 * 1024;
const MAX_TOTAL = 30 * 1024 * 1024;

const fileKey = (jobId: string, fileId: string) =>
  `recell-sync/${jobId}/${fileId}`;
const jobKey = (id: string) => PREFIX + id;
const safeId = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : '';
const inputString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');

async function readJob(id: string) {
  if (!safeId(id)) throw new HttpError(400, '작업 번호를 확인해 주세요.');
  const row = await db()
    .prepare('SELECT value FROM settings WHERE key=?')
    .bind(jobKey(id))
    .first<{ value: string }>();
  if (!row) throw new HttpError(404, '예약 반영 작업을 찾을 수 없습니다.');
  return JSON.parse(row.value) as RecellSyncJob;
}

async function listJobs() {
  const rows = await db()
    .prepare('SELECT value FROM settings WHERE key LIKE ?')
    .bind(PREFIX + '%')
    .all<{ value: string }>();
  return rows.results
    .map((row) => JSON.parse(row.value) as RecellSyncJob)
    .sort((a: RecellSyncJob, b: RecellSyncJob) =>
      b.createdAt.localeCompare(a.createdAt),
    );
}

async function replaceJob(previous: RecellSyncJob, next: RecellSyncJob) {
  const result = await db()
    .prepare('UPDATE settings SET value=? WHERE key=? AND value=?')
    .bind(JSON.stringify(next), jobKey(previous.id), JSON.stringify(previous))
    .run();
  if (!result.meta.changes)
    throw new HttpError(
      409,
      '다른 처리가 먼저 진행됐습니다. 작업 목록을 다시 확인해 주세요.',
    );
  return next;
}

export async function GET(req: Request) {
  try {
    const worker = await isPreparationWorker(req, env.SS_DISPATCH_TOKEN);
    const url = new URL(req.url);
    const requestedFile = safeId(url.searchParams.get('file'));
    if (requestedFile) {
      if (!worker)
        throw new HttpError(403, '예약 처리 작업자만 원본을 받을 수 있습니다.');
      const job = await readJob(url.searchParams.get('job') || '');
      const file = job.files.find((item) => item.id === requestedFile);
      if (!file) throw new HttpError(404, '이 작업의 파일이 아닙니다.');
      const object = await bucket().get(fileKey(job.id, file.id));
      if (!object) throw new HttpError(404, '업로드 원본을 찾을 수 없습니다.');
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const jobs = await listJobs();
    if (worker && url.searchParams.get('worker') === '1') {
      return json({
        jobs: jobs
          .filter((job) =>
            ['queued', 'processing', 'approved'].includes(job.status),
          )
          .slice(0, 10),
        latestCompleted: jobs.find((job) => job.status === 'completed') || null,
        rules: RECELL_SYNC_RULES,
      });
    }
    owner(await member());
    return json({
      jobs: jobs.slice(0, 20).map(publicRecellSyncJob),
      rules: RECELL_SYNC_RULES,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const worker = await isPreparationWorker(req, env.SS_DISPATCH_TOKEN);
    if (worker) {
      const body = (await req.json()) as Record<string, unknown>;
      const job = await readJob(inputString(body.id));
      const now = new Date().toISOString();
      if (body.action === 'claim') {
        if (job.status !== 'queued')
          throw new HttpError(409, '이미 시작되었거나 종료된 작업입니다.');
        const next: RecellSyncJob = {
          ...job,
          status: 'processing',
          startedAt: now,
          updatedAt: now,
          worker: inputString(body.worker, 'recell-worker').slice(0, 100),
          stage: '원본 확인 · 현재 예약 대조',
        };
        return json({ job: await replaceJob(job, next) });
      }
      if (!['processing', 'approved'].includes(job.status))
        throw new HttpError(409, '처리 중이거나 승인된 작업만 기록할 수 있습니다.');
      if (body.action === 'progress') {
        const next: RecellSyncJob = {
          ...job,
          updatedAt: now,
          stage: inputString(body.stage, '대조 중').slice(0, 150),
        };
        return json({ job: await replaceJob(job, next) });
      }
      if (body.action === 'complete') {
        if (job.status !== 'approved')
          throw new HttpError(409, '대표 승인 후에만 반영을 완료할 수 있습니다.');
        const next: RecellSyncJob = {
          ...job,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
          stage: '신규·변경·취소 반영 및 공급자 검증 완료',
          summary: validateRecellSyncSummary(body.summary),
          error: undefined,
        };
        return json({ job: await replaceJob(job, next) });
      }
      if (body.action === 'prepared') {
        if (job.status !== 'processing')
          throw new HttpError(409, '대조 중인 작업만 검수 대기로 전환할 수 있습니다.');
        const next: RecellSyncJob = {
          ...job,
          status: 'prepared',
          updatedAt: now,
          stage: '신규·변경·취소 대조 완료 · 대표 검수 대기',
          summary: validateRecellSyncSummary(body.summary),
          error: undefined,
        };
        return json({ job: await replaceJob(job, next) });
      }
      if (body.action === 'review' || body.action === 'fail') {
        const status = body.action === 'review' ? 'review' : 'failed';
        if (!RECELL_SYNC_STATUSES.includes(status))
          throw Error('처리 상태 오류');
        const next: RecellSyncJob = {
          ...job,
          status,
          completedAt: now,
          updatedAt: now,
          stage:
            status === 'review'
              ? '자동 반영 중단 · 대표 확인 필요'
              : '처리 실패 · 재실행 전 원인 확인',
          error: inputString(body.error, '처리 결과를 확인해 주세요.').slice(
            0,
            500,
          ),
          summary: body.summary
            ? validateRecellSyncSummary(body.summary)
            : undefined,
        };
        return json({ job: await replaceJob(job, next) });
      }
      throw new HttpError(400, '예약 처리 작업을 확인해 주세요.');
    }

    origin(req);
    const current = await member();
    owner(current);
    req=await restoreUploadRequest(req,current.id);
    const type = req.headers.get('content-type') || '';
    if (type.toLowerCase().startsWith('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      if (body.action !== 'approve')
        throw new HttpError(400, '예약 반영 요청을 확인해 주세요.');
      const job = await readJob(inputString(body.id));
      if (job.status !== 'prepared')
        throw new HttpError(409, '검수 대기 중인 작업만 승인할 수 있습니다.');
      const now = new Date().toISOString();
      const next: RecellSyncJob = {
        ...job,
        status: 'approved',
        updatedAt: now,
        stage: '대표 승인 완료 · 솔라피 반영 대기',
      };
      return json({ job: publicRecellSyncJob(await replaceJob(job, next)) });
    }
    if (!type.toLowerCase().startsWith('multipart/form-data'))
      throw new HttpError(415, 'PDF 파일 업로드가 필요합니다.');
    if (
      Number(req.headers.get('content-length') || 0) >
      MAX_TOTAL + 1024 * 1024
    )
      throw new HttpError(
        413,
        '한 번에 올리는 파일은 합계 30MB 이하여야 합니다.',
      );
    const form = await req.formData();
    const files = form
      .getAll('files')
      .filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 6)
      throw new HttpError(
        400,
        '같은 시점에 수출한 예약 PDF를 1~6개 선택해 주세요.',
      );
    if (files.some((file) => file.size <= 0 || file.size > MAX_FILE))
      throw new HttpError(413, '각 PDF는 12MB 이하여야 합니다.');
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL)
      throw new HttpError(
        413,
        '한 번에 올리는 파일은 합계 30MB 이하여야 합니다.',
      );
    if (
      files.some(
        (file) =>
          file.type !== 'application/pdf' ||
          !file.name.toLowerCase().endsWith('.pdf'),
      )
    )
      throw new HttpError(400, 'EMR에서 수출한 PDF 파일만 올려 주세요.');

    const id = crypto.randomUUID();
    const saved: RecellSyncFile[] = [];
    try {
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const signature = new Uint8Array(bytes.slice(0, 5));
        if (new TextDecoder().decode(signature) !== '%PDF-')
          throw new HttpError(400, `${file.name} 파일 형식을 확인해 주세요.`);
        const fileId = crypto.randomUUID();
        const sha256 = hex(await crypto.subtle.digest('SHA-256', bytes));
        await bucket().put(fileKey(id, fileId), bytes, {
          httpMetadata: { contentType: 'application/pdf' },
          customMetadata: { sha256, uploadedAt: new Date().toISOString() },
        });
        saved.push({
          id: fileId,
          name: file.name.slice(0, 200),
          size: file.size,
          sha256,
        });
      }
      const now = new Date().toISOString();
      const job: RecellSyncJob = {
        id,
        status: 'queued',
        files: saved,
        createdAt: now,
        createdBy: current.id,
        updatedAt: now,
        stage: '업로드 완료 · 자동 대조 대기',
        rulesVersion: RECELL_SYNC_RULES.version,
      };
      await db()
        .prepare('INSERT INTO settings(key,value) VALUES(?,?)')
        .bind(jobKey(id), JSON.stringify(job))
        .run();
      return json({ job: publicRecellSyncJob(job) }, 201);
    } catch (error) {
      await Promise.all(
        saved.map((file) => bucket().delete(fileKey(id, file.id))),
      );
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}
