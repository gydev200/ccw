export const RECELL_SYNC_RULES = {
  version: 1,
  hospital: 'yonsei',
  sender: '025153333',
  sameDay: '10:00',
  dayBefore: '17:00',
  earlySameDay: {
    '09:00': '08:00',
    '09:30': '08:30',
    '10:00': '09:00',
  },
  dayBeforeAfterDays: 7,
  confirmation: false,
  immediate: false,
} as const;

export const RECELL_SYNC_STATUSES = [
  'queued',
  'processing',
  'prepared',
  'approved',
  'completed',
  'review',
  'failed',
] as const;

export type RecellSyncStatus = (typeof RECELL_SYNC_STATUSES)[number];

export type RecellSyncFile = {
  id: string;
  name: string;
  size: number;
  sha256: string;
};

export type RecellSyncSummary = {
  addedReservations: number;
  changedReservations: number;
  cancelledReservations: number;
  addedMessages: number;
  cancelledMessages: number;
  unchangedReservations: number;
  reviewRequired: number;
  scheduledTotal: number | null;
};

export type RecellSyncJob = {
  id: string;
  status: RecellSyncStatus;
  files: RecellSyncFile[];
  createdAt: string;
  createdBy: string | number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  worker?: string;
  stage: string;
  error?: string;
  summary?: RecellSyncSummary;
  rulesVersion: number;
};

export const emptyRecellSyncSummary = (): RecellSyncSummary => ({
  addedReservations: 0,
  changedReservations: 0,
  cancelledReservations: 0,
  addedMessages: 0,
  cancelledMessages: 0,
  unchangedReservations: 0,
  reviewRequired: 0,
  scheduledTotal: null,
});

export function validateRecellSyncSummary(value: unknown): RecellSyncSummary {
  if (!value || typeof value !== 'object') throw Error('처리 결과가 없습니다.');
  const input = value as Record<string, unknown>;
  const result = emptyRecellSyncSummary();
  for (const key of Object.keys(result) as (keyof RecellSyncSummary)[]) {
    const current = input[key];
    if (key === 'scheduledTotal' && current === null) {
      result[key] = null;
      continue;
    }
    if (
      !Number.isSafeInteger(current) ||
      Number(current) < 0 ||
      Number(current) > 10000
    )
      throw Error('처리 건수 형식을 확인해 주세요.');
    if (key === 'scheduledTotal') result[key] = Number(current);
    else result[key] = Number(current);
  }
  return result;
}

export function publicRecellSyncJob(job: RecellSyncJob) {
  return {
    id: job.id,
    status: job.status,
    files: job.files.map(({ name, size, sha256 }) => ({ name, size, sha256 })),
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    updatedAt: job.updatedAt,
    stage: job.stage,
    error: job.error || null,
    summary: job.summary || null,
    rulesVersion: job.rulesVersion,
  };
}

