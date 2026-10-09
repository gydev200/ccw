# ChartClean Works workflow

The user designated ccw32 (kyunghwa / 고경화) as the version 2 review workspace.
Make requested frontend changes only in versions/v2 until the user approves promotion to DO.
Keep the canonical DO frontend unchanged while reviewing v2. Shared authentication, APIs,
data models and root CSS affect both versions; inspect those changes separately.
Use VERSION-WORKFLOW.md and scripts/promote-v2.mjs for review and promotion.
Never replace the existing baseline deployment in the external versions registry.
"기존 버전으로 가" means restore the exact registered existing deployment, preserving current business data.

The v2 employee menu follows the latest user revision: 내 업무 (daily plan), 업무 일지,
결재·신청, 출퇴근, 공지·일정, 교육·매뉴얼, 내 인사·고과, 계정·설정. Preserve electronic-approval
integration from the referenced 온라인 결재시스템 task when editing these menus.
The temporary DO / 직원 switch changes presentation only. For service-account
approvals always use member(true) and check the actual DO role, never the preview role.
The v2 staff-portal API explicitly permits account requests from ccw32 while other
business APIs retain the original preview write protection.

V2 SS hospital information/setup/operations/common forms use isolated v2-hospital-profile
and v2-hospital-emr storage. Only actual DO or the designated V2 account can edit.
Draft changes preserve the previously confirmed hospital screen. Public patient access,
hospital employee authentication, EMR analysis and dispatch are not enabled by the preview.
Keep source material medical-review status visible; do not mark unreviewed drafts approved.

The user corrected the daily-plan placement on 2026-10-09: it belongs on the
ccw32 / 고경화 staff login landing screen only. Canonical DO remains unchanged.
Daily-plan GET permits the designated V2 reviewer; writes require the actual DO role.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

V2 document archive permits actual DO and ccw32: DO reads all; ccw32 reads only their own uploads.
Archive files stay private and download authorization repeats the same owner check.
Easy-administration remote-install button creates a 24-hour hospital invitation through /api/v2/remote-install-link. Other stages are presentation only; no dispatch, install or report issuance.
Staff sidebar shows approval submenus only when electronic approval is selected.

2026-10-09 staff navigation: 내 업무 opens the daily plan; 업무 일지 is separate.
Approval navigation occupies the full left sidebar and includes vacation and account requests/history.
Personal appraisal stays inline. Hospital setup adds basic info, administration, screen/services,
diagnosis/fee upload, material matching review, and final preview. Matching is exact code/name
comparison only, with human/medical review; unmatched does not prove clinical uniqueness.
