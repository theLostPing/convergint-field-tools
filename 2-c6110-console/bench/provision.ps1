<#
  AMP lockdown provisioning - PowerShell that drives curl.exe (AMP's TLS
  renegotiation defeats .NET/Invoke-RestMethod, so curl is required).
  Non-interactive twin of provision.cmd. For the guided "match sounds + colours
  and export the console sheet" experience, use provision-wizard.ps1 instead.
  Needs curl.exe (Win10/11 + Server 2019+). Talks ONLY to the local AMP.

  Run on the server:  powershell -ExecutionPolicy Bypass -File provision.ps1

  Creates 11 sessions (locked with Brian):
    fire-announce        continuous VOICE (button plays repeat:0), no hold
    wv/tornado -announce + -hold (silent)          site-wide
    lightning  -announce + -hold                   HANGAR / TARMAC ONLY
    allclear (site) + lightning-allclear (hangar) + walk-test (green test)
    lobby-allclear       button 5 training - lobby speakers only
  Nothing auto-stops except the monthly walk TEST. Sessions survive AMP restarts.
#>

# ---- EDIT THESE (ids from YOUR server: this script lists them first) --------
$SERVER    = '127.0.0.1'
$User      = '<API_USER>'
$Pass      = '<API_PASSWORD>'

# SITE target = fire / wv / tornado / allclear / walk-test. Occupied site: stage
# it (lobby speakers -> small safe group -> all zones), re-run, buttons unchanged.
$TARGETS   = @('sit_1')
# LIGHTNING = HANGAR / TARMAC ONLY (own target + own all-clear). One or more zones.  <-- PLACEHOLDER.
$TARGETS_LIGHTNING = @('zon_hangar')
# LOBBY = the ~4 front-lobby speakers for TRAINING button 5 (lobby all-clear).  <-- PLACEHOLDER.
$TARGETS_LOBBY = @('lobby_spk1','lobby_spk2','lobby_spk3','lobby_spk4')

# visual profile id per session (strobe colour) - from the list below.
# CLEAR + TEST are both GREEN.
$PROFILE_FIRE=0; $PROFILE_WV=0; $PROFILE_TORNADO=0; $PROFILE_LIGHTNING=0
$PROFILE_CLEAR=0; $PROFILE_TEST=0
# ----------------------------------------------------------------------------

# AMP demands a TLS renegotiation that PowerShell/.NET (Invoke-RestMethod) refuses ->
# "could not create SSL/TLS secure channel". System curl.exe/Schannel handles it, so this
# drives curl.exe (Win10/11 + Server 2019+). On older Server, use provision.cmd or copy curl.exe.
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    Write-Host 'curl.exe not found - .NET cannot talk to AMP (TLS renegotiation). Use provision.cmd, or copy curl.exe onto the box.' -ForegroundColor Red
    return
}
$base = "https://$SERVER/api/v1.2"
function Api($method, $path, $body) {
    $cargs = @('-s','-k','--max-time','60','--digest','-u',"${User}:${Pass}",'-X',$method,"$base$path")
    $tmp = $null
    if ($null -ne $body) {
        $tmp = [IO.Path]::GetTempFileName()
        [IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Compress -Depth 10), [Text.UTF8Encoding]::new($false))
        $cargs += @('-H','Content-Type: application/json','--data-binary',"@$tmp")
    }
    $raw = & curl.exe @cargs
    if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    try { $raw | ConvertFrom-Json } catch { $raw }
}
function New-AmpSession($name, $prio, $prof, $target = $TARGETS) {
    Api DELETE "/audioSessions/custom/$name" $null | Out-Null   # clear any stale one
    $r = Api POST "/audioSessions" ([ordered]@{
        customId = $name; prio = $prio; targets = $target; type = 'HTTP'
        visualProfileEnabled = 'TRUE'; visualProfileId = [int]$prof
    })
    if ($r.visualProfileId) { Write-Host ("  {0,-18} OK (profile {1}, target {2})" -f $name, $r.visualProfileId, ($target -join ',')) }
    else { Write-Host ("  {0,-18} FAIL" -f $name) -ForegroundColor Red }
}

Write-Host "AMP: $base    site: $($TARGETS -join ', ')    lightning->hangar: $($TARGETS_LIGHTNING -join ', ')`n"
Write-Host '--- Audio files (fire/wv/tornado/lightning msgs + all-clear + test + silence-60s + silence-30s) ---'
Api GET '/audioFiles' $null      | Format-Table -Auto id, name, length
Write-Host '--- Visual profiles (the strobe colours) ---'
Api GET '/visualProfiles' $null  | Format-Table -Auto id, name
Write-Host '--- Targets (site / zones / speakers) ---'
Api GET '/targets' $null         | Format-Table -Auto id, type, niceName

if ($PROFILE_FIRE -eq 0) { Write-Host "`nPROFILE_* are still 0 - put the real ids in above and run again."; return }

Write-Host "`nCreating sessions..."
New-AmpSession 'fire-announce'      'HIGH' $PROFILE_FIRE                        # continuous voice, no hold
New-AmpSession 'wv-announce'        'HIGH' $PROFILE_WV
New-AmpSession 'wv-hold'            'LOW'  $PROFILE_WV
New-AmpSession 'tornado-announce'   'HIGH' $PROFILE_TORNADO
New-AmpSession 'tornado-hold'       'LOW'  $PROFILE_TORNADO
New-AmpSession 'lightning-announce' 'HIGH' $PROFILE_LIGHTNING $TARGETS_LIGHTNING
New-AmpSession 'lightning-hold'     'LOW'  $PROFILE_LIGHTNING $TARGETS_LIGHTNING
New-AmpSession 'allclear'           'HIGH' $PROFILE_CLEAR
New-AmpSession 'lightning-allclear' 'HIGH' $PROFILE_CLEAR     $TARGETS_LIGHTNING
New-AmpSession 'walk-test'          'LOW'  $PROFILE_TEST
New-AmpSession 'lobby-allclear'     'HIGH' $PROFILE_CLEAR    $TARGETS_LOBBY   # button 5 training - lobby only

Write-Host "`n200 = created. Count ELEVEN below (fire + wv/tornado x2 + lightning x2 + allclear + lightning-allclear + walk-test + lobby-allclear):"
Api GET '/audioSessions' $null | Format-Table -Auto customId, prio, visualProfileId
