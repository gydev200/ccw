# 차트클린 웍스 — Vercel 독립판

운영 주소: https://erp.chartclean.com

이 소스는 ChatGPT Sites 서버를 거쳐 실행하지 않습니다. Next.js 앱과 업무 API는 Vercel에서 실행되고, 기존 Supabase의 `chartclean_erp` 전용 영역과 비공개 첨부 저장소를 사용합니다.

## 수정·재배포

Node.js 22 이상에서 `npm ci`, `npm run build`로 확인합니다. Vercel에서 `happyshs747-3030s-projects` 팀의 `chartclean-erp` 프로젝트에 편집자를 초대해 주세요. 아무에게나 공개 편집 권한을 주지 않습니다.

편집자는 이 소스를 수정한 후 자신의 Vercel 계정으로 `vercel login`, `vercel link --project chartclean-erp --scope happyshs747-3030s-projects`, `vercel --prod --scope happyshs747-3030s-projects`를 실행하면 됩니다. ChatGPT 계정은 필요하지 않습니다. Vercel 관리 화면 자체가 일반 코드 편집기는 아니므로 소스 편집기는 별도로 사용합니다.

운영 비밀값은 Vercel 환경 변수에만 보관되어 있으며 이 소스 묶음에는 없습니다. 기존 프로젝트를 연결하면 운영 환경 변수를 다시 입력할 필요가 없습니다. `SUPABASE_SECRET_KEY`를 공개 변수로 만들거나 파일에 넣지 마세요.

## 보안·저장소

웍스 로그인과 직원별 권한 검사를 유지합니다. DB 호출은 서버 전용이며 공개 Supabase 키로 전용 DB 함수를 실행할 수 없습니다. 첨부는 비공개이며 계정·업무 권한을 검사합니다. 파일은 한시적 업로드 주소를 사용해 Vercel의 요청 크기 제한을 넘지 않고 저장합니다.

`npm run test:storage`는 SQL 변환, 동시 변경, 변경 이력, 롤백, 공개 DB 접근 차단을 검사합니다. `supabase/migrations/20261008_chartclean.sql`은 이미 운영 DB에 적용되어 있습니다. 평상시 배포 때 다시 실행하지 마세요.

기존 업무에 기록된 별도 병원 BA 편집기 등 외부 서비스 링크는 별도 서비스입니다. 이 저장소에 그 별도 서비스의 소스는 포함되지 않습니다.
