# Axis C6110 Lockdown — where to pick up

> **CURRENT STATE (latest trip) — the design below in "What's PROVEN" is the ORIGINAL
> model; it has since been refined. The authoritative runbook is now `COMMISSIONING.md`
> + `amp-console.js` (the browser tool). Key changes:**
> - **Blocker resolved:** the customer/bench AMP exposes `/api/v1.2` — it was just the
>   **Public API toggle set OFF** (GUI → Settings → API/Integrations). Not a version wall.
>   **On the customer Windows Server, Schannel curl/.NET FAIL** on AMP's TLS renegotiation — drive it from the **browser** (`amp-console.js`). A Win11 bench box's Schannel is fine; the customer Server's is not.
> - **11 sessions, 10 console buttons.** Button map: 1 all-call page (native), 3 Test,
>   4 lobby page (native), 5 Lobby All Clear (training, 4 speakers), 6 Building All Clear,
>   7 Fire, 8 Tornado, 9 Lightning, 10 Lightning All Clear, 12 WV/"Security Incident".
> - **Fire = continuous voice** (`repeat:0`), not announce-×2. WV/Tornado/Lightning still
>   announce ×2 then silent strobe hold. All-clears play once (`repeat:1`) green.
> - **Lightning is HANGAR-ZONE ONLY** with its **own** hangar all-clear (button 10).
>   **Lobby All Clear (button 5)** targets the 4 individual lobby speaker devices.
> - **Test** = `test-test-test.mp3` + 30s green flash, looped ~30 min — the only self-stop.
> - **Occupied building: no live-testing** — stage `TARGETS`, prove on the lobby
>   target, then set production scope and stop.

**Goal:** C6110 console buttons fire emergency announcements + hold strobes flashing until an
All Clear button is pressed. All over HTTP to the AMP server — no per-device VAPIX.

**STROBE PROVEN 2026-07-18 — "it works great."** Full acceptance on the bench D4200-VE:
announce ×2, strobe holds through the silent loop after audio ends, All Clear kills it,
buttons re-arm. Commissioning PDF + silence-60s.wav are on the pastebin (files/) and in
Convergint Work.

**Sound-stack requirements (Brian, 2026-07-18) — design accepted, not yet bench-tested:**
1. **White noise ALWAYS running at low level** — bottom layer; implement as a looped
   white-noise file scheduled as the always-on background/music source per zone; every
   higher layer ducks it and it self-resumes.
2. **Live paging must preempt emergency sound AND lights' audio** — paging priority above
   the HTTP sessions; strobes keep flashing through a page (LOW-hold-drives-light-under-
   HIGH-audio was bench-verified). VERIFY page-over-active-alert at commissioning.
Stack bottom→top: white noise < strobe hold (LOW) < emergency announcements (HIGH) < paging.

## What's PROVEN (against live AMP Pro 5.1.34, API v1.2)
- Server: bench `10.0.7.11`, **customer site `<SERVER_IP>`**. API user `<API_USER>`.
  - Bench password `2683`. **Customer password `<PASSWORD>`.** DON'T cross them.
- Announcement plays twice = `repeat: 2` (timed on the speaker — genuinely repeats).
- Infinite hold = `repeat: 0` on a silent loop file. Killable on command.
- Visual profile (color) rides on a PRE-CREATED session, addressed by customId.
- All Clear uses `stopAudioFiles` (NOT delete) so buttons re-arm.
- Sessions SURVIVE an AamPro service restart (they persist in the DB) — provision once.

## Two traps (documented on the pastebin)
1. `oneshotPlayAudioFiles` SILENTLY drops the visual profile (reports "DEFAULT").
   → strobe color must live on a pre-created session, not the one-shot call.
2. All Clear must `stopAudioFiles`, never DELETE — DELETE kills the session and the
   next button press 404s.

## STILL OPEN — need Brian / hardware
1. **IDs.** Run on the customer server (curl.exe ships with Windows, no install):
   `curl -sk --digest -u <USER>:<PASSWORD> https://127.0.0.1/api/v1.2/audioFiles`
   (+ `/visualProfiles` + `/targets`). Their IDs will NOT match the bench.
   Paste back → I fill in the finished 5-button command list. Colors: their team picked them.
2. ~~Console UI path~~ **RESOLVED 2026-07-18: HTTP action type confirmed by Brian in the
   console UI — Display > Configuration > Actions → + Add action → HTTP, assign to a
   button under Display > Configuration > Buttons. Buttons fire the POSTs directly.**
3. **STROBE UNPROVEN — but the D4200-VE is now ON THE BENCH (deployed 2026-07-18).**
   - IP `10.0.0.50` (DHCP pool lease, not pinned) · root/root · serial E827250A31DE · AXIS OS 12.3.56
   - AMP edge ACAP 5.1.34 installed + started, PrimaryServerIpAddress=10.0.7.11, registered
     as **dev_6**, online, in the TEST zone (zon_2) alongside the C1004-E, sink unmuted.
   - Zone membership was added via the AMP Postgres (aam_zone_sink: zoneid 2 → sinkid 6) —
     the v1.2 API can't do it. AMP picked the row up live, no service restart needed.
   Still to confirm: (a) strobe keeps flashing AFTER the announcement ends, and
   (b) a LOW-prio silent hold still drives the light while a HIGH-prio announcement
   talks over its audio. If (b) fails, flip the hold to HIGH.
   → If the silent-loop trick doesn't hold the strobe, fall back to per-device VAPIX
   `siren_and_light.cgi` (real start/stop, but doesn't scale / lives outside AMP).
   **TRAP DISARMED 2026-07-18: `silence-60s.wav` uploaded to AMP (dropped into
   `C:\Users\Public\Music\Announcements\`, auto-indexed as audio file id 4) and
   FILE_SILENCE repointed to "4". ALERT's hold loop is now genuinely silent.**

## Artifacts
- `console_sim.py` — two-button fake C6110 (GUI + CLI). Provision / alert / allclear / discover.
- `provision.cmd` — the session-create calls as a batch file (or just paste the curls).
- Pastebin: https://pastebin.thelostping.net → "C6110 Lockdown Buttons" section (full command sheet).
- `silence-60s.wav` — the strobe-holder file. UPLOADED to bench AMP 2026-07-18 (library
  folder `C:\Users\Public\Music\Announcements\`, indexed as file id 4, FILE_SILENCE="4").
  Original still on the Desktop. Customer server will need the same drop + its own id.
