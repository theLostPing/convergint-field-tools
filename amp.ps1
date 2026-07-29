# amp.ps1 - AAM Pro API helper for Windows boxes where the built-in (Schannel)
# curl.exe dies with "curl (35) SEC_E_ILLEGAL_MESSAGE" against the self-signed
# HTTPS API. PowerShell's .NET TLS stack negotiates where Schannel-curl can't.
#
# Run it (one line, on the AAM Pro server itself):
#   irm https://raw.githubusercontent.com/theLostPing/convergint-field-tools/master/amp.ps1 | iex
#
# Defaults to 127.0.0.1 (run it ON the server). Prompts for API user + password.
# Lists every audio file with its id + name so you can fill in the rule bodies.

$Server = '127.0.0.1'   # change to the site IP if running from another box

# --- accept the self-signed cert + force modern TLS (beats the Schannel wall) ---
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
try   { [Net.ServicePointManager]::SecurityProtocol = 'Tls12,Tls13' }
catch { [Net.ServicePointManager]::SecurityProtocol = 'Tls12' }

$user = Read-Host 'AAM API user'
$pass = Read-Host 'AAM API password' -AsSecureString
$cred = [pscredential]::new($user, $pass)

$url = "https://$Server/api/v1.2/audioFiles"
Write-Host ""
Write-Host "GET $url" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri $url -Credential $cred -ErrorAction Stop
    $files = if ($r.data) { $r.data } else { $r }
    if (-not $files) {
        Write-Host "Connected OK, but no audio files returned - upload them under Announcements first." -ForegroundColor Yellow
    } else {
        Write-Host ("{0} audio file(s):" -f @($files).Count) -ForegroundColor Green
        $files | Select-Object id, name | Format-Table -AutoSize
    }
}
catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "If this is a TLS error too, the fallback is an OpenSSL curl (e.g. Git for Windows:" -ForegroundColor DarkYellow
    Write-Host '  & "C:\Program Files\Git\mingw64\bin\curl.exe" -k --digest -u USER:PASS https://127.0.0.1/api/v1.2/audioFiles' -ForegroundColor DarkYellow
}
