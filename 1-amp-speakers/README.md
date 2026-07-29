# Step 1 — Get every speaker online + named in AMP (fast)

**What this does:** takes a pile of fresh Axis speakers and, in bulk:
1. points every speaker at the AMP server (so they all check in), and
2. renames every speaker in AMP with a zone/row prefix (so the list isn't 40 identical "AXIS C1004-E"s).

One CSV drives both. No software gets installed anywhere.

---

## ☐ Before you start — you need ALL of these

- [ ] **Access to the AAM Pro server** (RDP or console) — you run **everything ON the server**.
      Convergint isn't allowed to put its own laptop on the customer network, and the server is
      already on the speaker network, so it's where all of this runs.
- [ ] The **speaker IPs** and **serial numbers** (from the box labels or discovery)
- [ ] The **AMP server IP** (the customer's Audio Manager Pro box)
- [ ] Speaker login (fresh-out-of-box is `root:root` — if the site changed it, get it first)

---

## Part A — Build the CSV (5 minutes, on the AAM Pro server)

1. Open Notepad.
2. One line per speaker, three columns, **no header row**:
   `ip,serial,prefix`
   ```
   192.168.1.101,ABBCCD122334,1-01
   192.168.1.102,ABBCCD122335,1-02
   ```
   - **ip** = the speaker's IP
   - **serial** = the serial off the box label (also the MAC)
   - **prefix** = what you want in front of the name in AMP (zone/row, e.g. `GYM-` or `1-01`)
3. Save it to the **server's Desktop** as exactly: `amp_devices.csv`

---

## Part B — Point every speaker at the AMP server (from the AAM Pro server)

1. Open **PowerShell** (plain, not admin).
2. Open [`REFERENCE-copypasta.md`](REFERENCE-copypasta.md), section **"2. Point speakers at the AMP server"**.
3. In the first block, change `$primary` to the AMP server IP. Leave `$secondary = ""` unless the site has a backup server.
4. Paste the block. Each line prints `IP -> OK` as it lands.
5. **VERIFY (do not skip):** paste the "Verify (read back)" block. Every speaker must echo
   the server IP you just set. Any blank = that speaker didn't take it — fix it now, not later.

> Prefer a script over paste blocks? `set-amp-server.ps1` does the same thing:
> `.\set-amp-server.ps1 set` then `.\set-amp-server.ps1 verify`

6. Wait ~2 minutes. Open the AMP console — the speakers appear as they check in.

---

## Part C — Rename them all in AMP (same server, no CSV copy needed)

1. You're already on the AMP server (Parts A–B ran here), and the CSV is already on its Desktop.
2. Get the database password (one time): open
   `C:\ProgramData\AXIS Communications\AXIS Audio Manager Pro\Manager\AamPro.ini`,
   find `[PostgreSQL]` → `Password=`, copy it.
3. Open PowerShell and paste the **Setup** block from
   [`REFERENCE-copypasta.md`](REFERENCE-copypasta.md) section 1 (put the DB password in it).
4. Paste the **Preview** block. It prints current name → new name **without changing anything**.
   Read the list. If a prefix is wrong, fix the CSV and preview again.
5. Happy with the preview? Paste **Apply (3a — skip already-prefixed)**.
6. Refresh the AMP console — every speaker now reads `<prefix> AXIS ...`.

> Renamed wrong? The **Undo** block in the reference strips all prefixes.

---

## When it doesn't work

| Symptom | Fix |
|---|---|
| `curl` prints nothing / times out | Wrong speaker IP, or the server can't reach the speaker VLAN |
| `401` from a speaker | Login isn't `root:root` — get the site's speaker password |
| Speaker took the server IP but never shows in AMP | Firewall between speaker VLAN and server, or wrong `$primary` IP |
| Preview shows no rows | Serials in the CSV don't match AMP's `stringid` — re-check the box labels |
| `psql` connection refused | You're not ON the AMP server, or AMP's Postgres isn't on port 5433 (older version) |
