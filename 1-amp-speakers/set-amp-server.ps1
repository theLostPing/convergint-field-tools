# ============================================================
#  set-amp-server.ps1
#  Point AXIS speakers at their AMP Primary/Secondary server via
#  VAPIX, using Windows' built-in signed curl.exe — nothing to
#  install. Run from anywhere that can reach the speakers.
#
#  Edit $primary / $secondary below, then:
#     .\set-amp-server.ps1 verify    # read back current AMP server IPs
#     .\set-amp-server.ps1 set       # write Primary (+ optional Secondary)
#
#  Reads the same amp_devices.csv (uses the ip column only).
# ============================================================
param([string]$mode = "verify")

$primary   = "192.168.1.10"   # AMP server (server 1)
$secondary = ""               # server 2 — leave "" if none, e.g. "192.168.1.11"
$cred      = "root:root"      # speaker login
$csv       = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'amp_devices.csv')

switch ($mode) {

  "set" {
        Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
            $u = "http://$($_.ip)/axis-cgi/param.cgi?action=update" +
                 "&root.AudioManagerPro.PrimaryServerIpAddress=$primary" +
                 "&root.AudioManagerPro.SecondaryServerIpAddress=$secondary"
            "$($_.ip) -> " + (& curl.exe -s --digest -u $cred --max-time 10 $u)
        }
  }

  "verify" {
        Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
            "$($_.ip): " + (& curl.exe -s --digest -u $cred --max-time 10 "http://$($_.ip)/axis-cgi/param.cgi?action=list&group=root.AudioManagerPro.PrimaryServerIpAddress,root.AudioManagerPro.SecondaryServerIpAddress")
        }
  }

  default { Write-Host "Usage: .\set-amp-server.ps1 set|verify" }
}
