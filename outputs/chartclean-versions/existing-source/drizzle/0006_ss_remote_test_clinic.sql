INSERT INTO records (kind, org, assignee, data, dedup, created_at, updated_at)
SELECT 'customer', 'SS', 'kyunghwa',
  json_object(
    'org', 'SS',
    'assignee', 'kyunghwa',
    'name', '테스트 병원',
    'stage', 'SS 세팅',
    'service', '미정',
    'serviceStatus', '세팅 중',
    'nextAction', '원격 프로그램 설치와 접속 정보 수신 시험',
    'due', '',
    'sourceUrl', '',
    'notes', '시험용 병원입니다. 실제 계약·환자 정보가 없으며 고경화님이 SS 화면에서 확인합니다.'
  ),
  'ss-remote-test-clinic-20260930',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (
  SELECT 1 FROM records
  WHERE kind = 'customer' AND json_extract(data, '$.name') = '테스트 병원'
);
