# ============================================================
#  rename-amp-devices.ps1
#  Bulk-rename AXIS Audio Manager Pro devices using AMP's own
#  signed psql.exe — nothing to install on the server.
#
#  Run ON the AMP server. Sets each speaker's AMP name to
#  "<prefix> <original AXIS name>", driven by amp_devices.csv.
#
#  First set the DB password (from AamPro.ini [PostgreSQL] Password=):
#     $env:PGPASSWORD = '...'
#  Then:
#     .\rename-amp-devices.ps1 preview     # show current -> new, no changes
#     .\rename-amp-devices.ps1 apply       # rename, skip already-prefixed (default)
#     .\rename-amp-devices.ps1 override    # re-prefix even if already named
#     .\rename-amp-devices.ps1 undo        # strip all prefixes
# ============================================================
param([string]$mode = "preview")

$psql = "C:/Program Files/AXIS Communications/AXIS Audio Manager Pro/Manager/db/bin/psql.exe"
$csv  = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'amp_devices.csv')
$pg   = @('-h','127.0.0.1','-p','5433','-U','aampro','-d','aampro')

if (-not $env:PGPASSWORD) {
    Write-Host "Set the DB password first:" -ForegroundColor Yellow
    Write-Host "  `$env:PGPASSWORD = '<AamPro.ini  [PostgreSQL] Password=>'"
    exit 1
}

switch ($mode) {

  "preview" {
        (Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
            "SELECT '$($_.serial)' serial, name current_name, '$($_.prefix) ' || name new_name FROM aam_dev WHERE stringid='$($_.serial)' AND position('AXIS' in name)=1;"
        }) -join "`n" | & $psql @pg
  }

  "apply" {
        # SKIP already-prefixed (only rows whose name still starts with AXIS)
        (Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
            "UPDATE aam_dev SET name='$($_.prefix) ' || name WHERE stringid='$($_.serial)' AND position('AXIS' in name)=1;"
        }) -join "`n" | & $psql @pg
  }

  "override" {
        # Re-prefix even if already named — strips back to the AXIS portion first
        (Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
            "UPDATE aam_dev SET name='$($_.prefix) ' || substring(name from position('AXIS' in name)) WHERE stringid='$($_.serial)' AND position('AXIS' in name)>0;"
        }) -join "`n" | & $psql @pg
  }

  "undo" {
        # Strip all prefixes back to stock AXIS names
        "UPDATE aam_dev SET name=substring(name from position('AXIS' in name)) WHERE position(' AXIS' in name)>0;" | & $psql @pg
  }

  default { Write-Host "Usage: .\rename-amp-devices.ps1 preview|apply|override|undo" }
}
