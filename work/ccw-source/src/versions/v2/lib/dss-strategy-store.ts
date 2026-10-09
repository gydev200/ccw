import { STRATEGY_KEY, emptyStrategy, type Strategy } from './dss-strategy';
export async function strategySnapshot(database: D1Database) {
  const row = await database
    .prepare('SELECT value FROM settings WHERE key=?')
    .bind(STRATEGY_KEY)
    .first<{ value: string }>();
  return {
    raw: row?.value || '',
    data: row ? (JSON.parse(row.value) as Strategy) : emptyStrategy(),
  };
}
export function strategyWrite(
  database: D1Database,
  raw: string,
  next: Strategy,
) {
  return database
    .prepare(
      "INSERT INTO settings(key,value) SELECT ?,? WHERE COALESCE((SELECT value FROM settings WHERE key=?),'')=? ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(STRATEGY_KEY, JSON.stringify(next), STRATEGY_KEY, raw);
}
export function strategyBackup(database: D1Database, next: Strategy) {
  return database
    .prepare('INSERT INTO settings(key,value) SELECT ?,? WHERE changes()>0')
    .bind('dss:strategy:backup:' + next.version, JSON.stringify(next));
}
export async function saveStrategy(
  database: D1Database,
  raw: string,
  next: Strategy,
) {
  const out = await database.batch([
    strategyWrite(database, raw, next),
    strategyBackup(database, next),
  ]);
  return !!out[0].meta.changes;
}
