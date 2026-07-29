# =====================================================================
#  What version of AXIS Audio Manager Pro is on this server?
#
#  Run this ON the AMP server. Read-only — it looks, it does not touch.
#  Right-click -> Run with PowerShell, or:  powershell -File version.ps1
#
#  Pair it with probe.js (browser console). Between the two you get the
#  full picture: which API surfaces exist, and which build is installed.
# =====================================================================

$ErrorActionPreference = 'SilentlyContinue'

Write-Host "`n=== INSTALLED (uninstall registry) ===" -ForegroundColor Cyan
$keys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$found = Get-ItemProperty $keys |
  Where-Object { $_.DisplayName -match 'Audio Manager|AAM|AXIS' } |
  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation
if ($found) { $found | Format-List } else { Write-Host "  (nothing matched 'Audio Manager' / 'AXIS')" }

Write-Host "`n=== SERVICES ===" -ForegroundColor Cyan
$svc = Get-Service | Where-Object { $_.Name -match 'aam|axis|audio' -or $_.DisplayName -match 'AXIS|Audio Manager' } |
  Select-Object Name, DisplayName, Status, StartType
if ($svc) { $svc | Format-Table -AutoSize } else { Write-Host "  (no matching services)" }

Write-Host "`n=== INSTALL FOLDERS ===" -ForegroundColor Cyan
$dirs = Get-ChildItem 'C:\Program Files','C:\Program Files (x86)' -Directory |
  Where-Object { $_.Name -match 'AXIS|Audio' }
if ($dirs) {
  $dirs | ForEach-Object { Write-Host ("  " + $_.FullName) }
} else { Write-Host "  (none found under Program Files)" }

Write-Host "`n=== BINARY FILE VERSIONS ===" -ForegroundColor Cyan
# The registry can lie after an in-place upgrade; the .exe on disk cannot.
$exes = $dirs | ForEach-Object { Get-ChildItem $_.FullName -Recurse -Filter *.exe -Depth 2 }
if ($exes) {
  $exes | Select-Object -First 25 |
    Select-Object Name, @{n='FileVersion';e={$_.VersionInfo.FileVersion}},
                        @{n='ProductVersion';e={$_.VersionInfo.ProductVersion}},
                        @{n='Modified';e={$_.LastWriteTime}} |
    Format-Table -AutoSize
} else { Write-Host "  (no executables found)" }

Write-Host "`n=== WINDOWS ===" -ForegroundColor Cyan
$os = Get-CimInstance Win32_OperatingSystem
Write-Host ("  " + $os.Caption + "  build " + $os.BuildNumber)
Write-Host ("  PowerShell " + $PSVersionTable.PSVersion)
Write-Host ("  curl.exe present: " + [bool](Get-Command curl.exe))

Write-Host "`nSend this whole output back along with the probe.js table.`n" -ForegroundColor Yellow
