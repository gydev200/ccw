param(
    [ValidateSet('existing', 'v2')][string]$Version = 'existing',
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$taskRegistryPath = Join-Path $PSScriptRoot 'versions.json'
$taskRegistry = Get-Content -LiteralPath $taskRegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskVersion = $taskRegistry.versions.$Version
if (-not $taskVersion.deploymentUrl -or -not $taskVersion.deploymentId) {
    throw '선택한 버전에는 확인된 배포가 등록되지 않았습니다.'
}
Write-Output ('복원 대상: ' + $taskVersion.label)
Write-Output ('프로젝트: ' + $taskRegistry.project)
Write-Output ('대상 배포: ' + $taskVersion.deploymentId)
Write-Output ('운영 주소: ' + $taskRegistry.productionUrl)
Write-Output ('배포 관리: ' + $taskVersion.dashboardUrl)
if (-not $Apply) {
    Write-Output '확인 모드입니다. 실제 배포 변경은 실행하지 않았습니다.'
    exit 0
}
$taskVercel = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $taskVercel) {
    $taskPnpm = 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd'
    if (-not (Test-Path -LiteralPath $taskPnpm)) { throw 'Vercel CLI 또는 Codex의 pnpm 실행기가 필요합니다.' }
    & $taskPnpm dlx vercel rollback $taskVersion.deploymentUrl --scope $taskRegistry.team --timeout 30s
    if ($LASTEXITCODE -ne 0) { throw '복원 요청이 성공하지 않았습니다.' }
    & $taskPnpm dlx vercel rollback status $taskRegistry.project --scope $taskRegistry.team --timeout 30s
    if ($LASTEXITCODE -ne 0) { throw '복원 상태를 확인하지 못했습니다.' }
    exit 0
}
& $taskVercel.Source rollback $taskVersion.deploymentUrl --scope $taskRegistry.team --timeout 30s
if ($LASTEXITCODE -ne 0) { throw '복원 요청이 성공하지 않았습니다. 현재 운영 버전은 확인 후 판단하세요.' }
& $taskVercel.Source rollback status $taskRegistry.project --scope $taskRegistry.team --timeout 30s
if ($LASTEXITCODE -ne 0) { throw '복원 상태 확인을 완료하지 못했습니다. 배포 관리 화면을 확인하세요.' }
Write-Output 'Vercel 복원 상태 확인이 끝났습니다. 운영 도메인의 배포 ID와 로그인·SS 화면을 확인한 후 versions.json의 currentVersion을 갱신하세요.'
