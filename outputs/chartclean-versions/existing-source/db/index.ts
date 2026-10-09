import { env } from '@/lib/runtime';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      '웍스 자료 저장소 연결을 확인해 주세요.',
    );
  }

  return drizzle(env.DB, { schema });
}
