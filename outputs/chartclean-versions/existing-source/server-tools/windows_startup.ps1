# Run as the employee's Windows user. Opens ERP on sign-in; does not claim device lockdown.
$ErrorActionPreference = 'Stop'
$erpUrl = 'https://erp.chartclean.com/'
$edgeExe = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (!(Test-Path $edgeExe)) { $edgeExe = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
if (!(Test-Path $edgeExe)) { throw 'Microsoft Edge not found.' }
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'ChartClean ERP.lnk'
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $edgeExe
$shortcut.Arguments = "--app=$erpUrl"
$shortcut.Save()
Write-Output 'ERP startup shortcut installed. Remove ChartClean ERP.lnk from Startup to undo.'
