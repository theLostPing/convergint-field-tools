<#
  C6110 BENCH test - PowerShell that drives curl.exe.  BENCH USE ONLY -
  do NOT run at an occupied site (it makes real noise). (AMP's TLS renegotiation
  defeats .NET/Invoke-RestMethod, so curl.exe is required - same as the .cmd.)
  Fires the exact play/stop calls a console button sends. Run the provisioner first.

  powershell -ExecutionPolicy Bypass -File test-buttons.ps1 fire
  powershell -ExecutionPolicy Bypass -File test-buttons.ps1 alert tornado
  powershell -ExecutionPolicy Bypass -File test-buttons.ps1 allclear | lightclear | test | teststop | status
#>
param([string]$Action = 'help', [string]$Name = '')

# ---- EDIT THESE (ids from YOUR server: run the provisioner to list them) ------
$SERVER = '127.0.0.1'
$User   = '<API_USER>'
$Pass   = '<API_PASSWORD>'
$FILE = @{ fire=0; wv=0; tornado=0; lightning=0; allclear=0; silence=0; test=0; silence30=0 }
$ANNOUNCE_TIMES = 2
$WALK_REPEAT    = 40      # 1800s / (test.mp3 length + 30s); test 15s -> 45s -> 40
# ------------------------------------------------------------------------------

if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { Write-Host 'curl.exe required (AMP TLS renegotiation defeats .NET). Use test-buttons.cmd.' -ForegroundColor Red; return }
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
    Write-Host "  $method $path"
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $raw | ConvertFrom-Json } catch { $raw } }
}

switch ($Action) {
    'fire' {
        Write-Host '== BUTTON: FIRE (continuous voice) =='
        Api POST '/audioSessions/custom/fire-announce/playAudioFiles' @{ fileIds = @("$($FILE.fire)"); repeat = 0 }
        Write-Host '  (talks continuously + strobe until SITE ALL CLEAR)'
    }
    'alert' {
        if ($Name -notin 'wv','tornado','lightning') { Write-Host '  alert needs a name: wv | tornado | lightning  (fire uses: test-buttons.ps1 fire)' -ForegroundColor Yellow; break }
        Write-Host "== BUTTON: ALERT ($Name) =="
        if ($Name -eq 'lightning') { Write-Host '  (lightning fires HANGAR ONLY)' }
        Api POST "/audioSessions/custom/$Name-announce/playAudioFiles" @{ fileIds = @("$($FILE[$Name])"); repeat = $ANNOUNCE_TIMES }
        Api POST "/audioSessions/custom/$Name-hold/playAudioFiles"     @{ fileIds = @("$($FILE.silence)");  repeat = 0 }
    }
    'allclear' {
        Write-Host '== BUTTON: SITE ALL CLEAR =='
        Api POST '/audioSessions/custom/fire-announce/stopAudioFiles' @{}
        foreach ($s in 'wv','tornado','lightning') {
            Api POST "/audioSessions/custom/$s-hold/stopAudioFiles"     @{}
            Api POST "/audioSessions/custom/$s-announce/stopAudioFiles" @{}
        }
        Api POST '/audioSessions/custom/walk-test/stopAudioFiles' @{}
        Api POST '/audioSessions/custom/allclear/playAudioFiles'  @{ fileIds = @("$($FILE.allclear)"); repeat = 1 }
    }
    'lightclear' {
        Write-Host '== BUTTON 10: LIGHTNING ALL CLEAR (hangar only) =='
        Api POST '/audioSessions/custom/lightning-hold/stopAudioFiles'     @{}
        Api POST '/audioSessions/custom/lightning-announce/stopAudioFiles' @{}
        Api POST '/audioSessions/custom/lightning-allclear/playAudioFiles' @{ fileIds = @("$($FILE.allclear)"); repeat = 1 }
        Write-Host '  (HANGAR ONLY - leaves the rest of the site alone)'
    }
    'lobbyclear' {
        Write-Host '== BUTTON 5: LOBBY ALL CLEAR (training - lobby speakers only) =='
        Api POST '/audioSessions/custom/lobby-allclear/playAudioFiles' @{ fileIds = @("$($FILE.allclear)"); repeat = 1 }
        Write-Host '  (LOBBY speakers only - training)'
    }
    'test' {
        Write-Host '== BUTTON 3: TEST START (test.mp3 + 30s flash, ~30 min, self-stops) =='
        Api POST '/audioSessions/custom/walk-test/playAudioFiles' @{ fileIds = @("$($FILE.test)","$($FILE.silence30)"); repeat = $WALK_REPEAT }
    }
    'teststop' {
        Write-Host '== BUTTON 3: TEST STOP =='
        Api POST '/audioSessions/custom/walk-test/stopAudioFiles' @{}
    }
    'status' { Api GET '/audioSessions' $null | Format-Table -Auto customId, prio, visualProfileId }
    default {
        Write-Host 'Usage: test-buttons.ps1 <fire|alert|allclear|lightclear|test|teststop|status> [name]   (BENCH ONLY)'
        Write-Host '  fire            - continuous voice + strobe until all clear'
        Write-Host '  alert <name>    - wv|tornado|lightning: announce x2 + silent strobe hold'
        Write-Host '  allclear        - SITE all clear: stop everything, play all-clear'
        Write-Host '  lightclear      - LIGHTNING all clear, hangar only            (button 10)'
        Write-Host '  test / teststop - TEST cycle: test.mp3 + 30s flash, ~30 min   (button 3)'
    }
}
