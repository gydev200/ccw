CREATE TABLE IF NOT EXISTS academy_answer_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  attempt_version INTEGER NOT NULL,
  person TEXT NOT NULL,
  status TEXT NOT NULL,
  answer_count INTEGER NOT NULL,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  UNIQUE(attempt_id,attempt_version)
);
INSERT OR IGNORE INTO academy_answer_backups(attempt_id,attempt_version,person,status,answer_count,payload,saved_at)
SELECT h.id,h.version,h.person,json_extract(h.data,'$.status'),
 (SELECT count(*) FROM json_each(h.data,'$.answers') WHERE value IS NOT NULL AND trim(CAST(value AS TEXT))<>''),h.data,h.updated_at
FROM hr_entries h WHERE h.kind='academy_attempt';
