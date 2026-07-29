# AXIS Audio Manager Pro — Field Copypasta

Copy-paste blocks for **AXIS Audio Manager Pro (AMP)** speaker deployments:

1. **Bulk-rename** every speaker in AMP (give it a zone/row prefix) — via AMP's own `psql.exe`.
2. **Point speakers at their AMP server(s)** — set Primary/Secondary server IP on each speaker via VAPIX.

Both are driven by **one CSV**, so a site has a single source of truth.

## Purpose — why copypasta, not a program

The goal is to **never install or run software on the AMP server.** Every block uses tools that are **already on the box**:

- AMP ships its own signed **`psql.exe`** (it runs on PostgreSQL) — we use that to talk to the AMP database.
- Windows ships a built-in signed **`curl.exe`** — we use that for VAPIX calls to the speakers.

So you **paste a block, it runs, nothing is left behind** — no installer, no agent, no third-party binary on a customer/production server. These are paste blocks on purpose, not a packaged tool.

> **Prefer to run a script?** Parameterized PowerShell versions of these same blocks are also in this repo — [`rename-amp-devices.ps1`](rename-amp-devices.ps1) (`preview` / `apply` / `override` / `undo`) and [`set-amp-server.ps1`](set-amp-server.ps1) (`set` / `verify`). Same logic, same CSV.

> IPs, MAC/serials, and server IPs below are **placeholders** — substitute your own site's values.

## The CSV (one file drives both jobs)

`amp_devices.csv` on your Desktop, **no header line**, columns `ip,serial,prefix`:

```
192.168.1.101,ABBCCD122334,1-01
192.168.1.102,ABBCCD122335,1-02
```

- **ip** — speaker IP (used by the server-push blocks).
- **serial** — speaker serial / `stringid` in AMP (used by the renamer).
- **prefix** — what to prepend to the AMP name, e.g. a zone/row label (renamer).

The renamer uses `serial`+`prefix`; the server-push uses only `ip`. One file does both.

---

## 1. Rename speakers in AMP — `psql` (run ON the AMP server)

Sets each speaker's AMP name to `"<prefix> <original AXIS name>"`. **Run `preview` first.**

**0. Get the DB password (by hand, once):** open
`C:\ProgramData\AXIS Communications\AXIS Audio Manager Pro\Manager\AamPro.ini`,
find `[PostgreSQL]` → `Password=`, copy that value.

**1. Setup — paste once in PowerShell:**
```powershell
$psql = "C:/Program Files/AXIS Communications/AXIS Audio Manager Pro/Manager/db/bin/psql.exe"
$env:PGPASSWORD = 'PASTE_THE_PASSWORD_HERE'
$csv  = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'amp_devices.csv')
```

**2. Preview (no changes):**
```powershell
(Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
  "SELECT '$($_.serial)' serial, name current_name, '$($_.prefix) ' || name new_name FROM aam_dev WHERE stringid='$($_.serial)' AND position('AXIS' in name)=1;"
}) -join "`n" | & $psql -h 127.0.0.1 -p 5433 -U aampro -d aampro
```

**3a. Apply — SKIP already-prefixed (safe default):**
```powershell
(Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
  "UPDATE aam_dev SET name='$($_.prefix) ' || name WHERE stringid='$($_.serial)' AND position('AXIS' in name)=1;"
}) -join "`n" | & $psql -h 127.0.0.1 -p 5433 -U aampro -d aampro
```

**3b. Apply — OVERRIDE (re-prefix even if already named):**
```powershell
(Import-Csv $csv -Header ip,serial,prefix | ForEach-Object {
  "UPDATE aam_dev SET name='$($_.prefix) ' || substring(name from position('AXIS' in name)) WHERE stringid='$($_.serial)' AND position('AXIS' in name)>0;"
}) -join "`n" | & $psql -h 127.0.0.1 -p 5433 -U aampro -d aampro
```

**Undo all prefixes:**
```powershell
"UPDATE aam_dev SET name=substring(name from position('AXIS' in name)) WHERE position(' AXIS' in name)>0;" | & $psql -h 127.0.0.1 -p 5433 -U aampro -d aampro
```

---

## 2. Point speakers at the AMP server — VAPIX (run from anywhere that reaches the speakers)

Edit `$primary` / `$secondary` first. Default speaker login is `root:root`.

**Set Primary + Secondary AMP server on every speaker:**
```powershell
$primary   = "192.168.1.10"      # AMP server (server 1)
$secondary = ""                  # server 2 — leave "" if none, e.g. "192.168.1.11"
$cred = "root:root"              # speaker login
Import-Csv (Join-Path ([Environment]::GetFolderPath('Desktop')) 'amp_devices.csv') -Header ip,serial,prefix | ForEach-Object {
  $u = "http://$($_.ip)/axis-cgi/param.cgi?action=update" +
       "&root.AudioManagerPro.PrimaryServerIpAddress=$primary" +
       "&root.AudioManagerPro.SecondaryServerIpAddress=$secondary"
  "$($_.ip) -> " + (& curl.exe -s --digest -u $cred --max-time 10 $u)
}
```

**Verify (read back):**
```powershell
Import-Csv (Join-Path ([Environment]::GetFolderPath('Desktop')) 'amp_devices.csv') -Header ip,serial,prefix | ForEach-Object {
  "$($_.ip): " + (& curl.exe -s --digest -u "root:root" --max-time 10 "http://$($_.ip)/axis-cgi/param.cgi?action=list&group=root.AudioManagerPro.PrimaryServerIpAddress,root.AudioManagerPro.SecondaryServerIpAddress")
}
```

---

## Notes / safety

- These touch a **production audio/paging database and live devices** — `preview`/`verify` before applying, and keep a copy of your CSV.
- The AMP DB internals (`aam_dev`, `stringid`, port `5433`, db/user `aampro`) belong to AXIS Audio Manager Pro and may change between AMP versions — verify against your install.

## License

MIT — see [LICENSE](LICENSE). Use at your own risk; these modify live systems.
