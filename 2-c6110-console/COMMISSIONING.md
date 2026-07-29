# C6110 emergency console — commissioning

Five emergency buttons on an Axis C6110 paging console, each firing an announcement and
holding strobes lit until an All Clear is pressed. All over HTTP to a self-hosted AXIS Audio
Manager Pro server. No per-device VAPIX.

Fill these two in before you start. They are the only site-specific values in this document.

```
SERVER    the AMP server's LAN IP
API USER  the user you create in the AMP GUI under API Access
```

Work on the AMP server itself. It already sits on the speaker network, and it is the only
machine that needs to reach anything.

---

## What the buttons do

| Btn | Function | Sessions | Scope |
|-----|----------|----------|-------|
| 1 | Live all-call paging | native console paging | all speakers |
| 3 | Test / monthly walk-test | `walk-test` | site |
| 4 | Live lobby page | native console paging | lobby speakers |
| 5 | Lobby All Clear | `lobby-allclear` | lobby speakers |
| 6 | Building All Clear | stops everything, then `allclear` | site |
| 7 | Fire | `fire-announce` | site |
| 8 | Tornado | `tornado-announce` + `tornado-hold` | site |
| 9 | Lightning within 5 | `lightning-announce` + `lightning-hold` | outdoor zone |
| 10 | Lightning All Clear | `lightning-allclear` | outdoor zone |
| 12 | Security incident | `wv-announce` + `wv-hold` | site |

Fire loops its voice continuously, so the voice itself is the hold. Every other emergency
announces twice and then runs a silent looping file to keep the strobes lit. All-clears play
once and stop. Nothing stops on its own except the walk test.

A button rule carries no target — only `fileIds` and `repeat`. The audience is fixed on the
**session** when it is provisioned. That is why a lobby all-clear can never reach the site.

---

## Step 1 — Turn on the API

In the AMP GUI, go to **API Access** and create the API user.

This is a separate account list from the dashboard login. The username and password you use
to log into the AMP dashboard will return 401 against the API no matter how many times you
retype it. That single fact has cost more field time on this project than everything else
combined.

## Step 2 — Load the audio

Copy the announcement files into `C:\Users\Public\Music\Announcements\` on the server.

You need: the fire, tornado, lightning and security-incident messages, an all-clear message,
`test-test-test.mp3`, `silence-60s.wav` and `silence-30s.mp3`.

AMP indexes the folder automatically within seconds. There is no upload API and none is needed.

## Step 3 — Set the strobe colours and zones

In the AMP GUI, create one visual profile per emergency, plus one for all-clear.

Visual profiles can only be made in the GUI. `POST visualProfiles` returns 405, and creating
them directly in the Postgres database breaks the whole `visualProfiles` endpoint with a 503.
Do not try it.

Give each profile a light profile that pulses at a visible intensity. A profile set to steady
at low intensity is a dim glow, not a strobe, and reads on site as "the strobe isn't working."

Create the zone targets you need: the whole site, the outdoor/lightning zone, and a small
contained group of speakers to test against.

## Step 4 — Open the console tool

Open the AMP dashboard in Chrome and log in.

Press F12, click **Sources**, click **Snippets**, click **New snippet**. Paste `amp-console.js`
followed by `amp-panel.js` into that one snippet and press Ctrl+S.

Press Ctrl+Enter. A panel opens over the dashboard with a button for every step below.

The snippet is saved in the browser profile. Navigating the dashboard reloads the page and
clears anything you pasted into the Console tab; a snippet survives that and re-runs with one
keystroke.

## Step 5 — Connect

```js
amp.login('<API USER>', '<API PASSWORD>')
await amp.discover()
```

You get tables of the audio files, visual profiles, zones and sessions that are really on the
server. This confirms the API is live and your credentials work.

## Step 6 — Build the session list

```js
await amp.build({
  colours:{fire:'…', wv:'…', tornado:'…', lightning:'…', allclear:'…'},
  zones:{site:'…', hangar:'…', lobby:'…'},
  audio:{fire:'…', wv:'…', tornado:'…', lightning:'…', allclear:'…', test:'…',
         silence60:'…', silence30:'…'},
})
```

Every value is a **name** you just saw in `discover()`. The tool resolves names to ids, so no
ids are ever copied by hand. Any zone slot also accepts a list, because a real zone is often a
speaker group plus its strobe group.

Read the table it prints. Confirm the site-wide sessions point at the site target.

**Watch for a zone whose name contains another zone's name.** A site with both "All zones" and
"All Zones White Noise" will happily match the noise bed for every emergency and return 200 OK
while doing it. `build()` prefers exact matches and warns on ambiguity, but read the table.

## Step 7 — Provision

```js
await amp.provision()
```

Eleven sessions are created. Nothing has made a sound. Confirm with `await amp.discover()`.

The buttons do nothing until this has been run — they play and stop these sessions by name.

Sessions persist in the AMP database and survive a service restart, so this is done once.

## Step 8 — Prove it on a contained target

Do this before wiring 21 rules into the console.

```js
await amp.create({customId:'smoke', prio:'LOW', visualProfileId:<a colour>, targets:['<test zone>']})
await amp.fire('smoke', <tornado msg id>, 2)
await amp.fire('smoke', <silence60 id>, 0)
```

The message plays twice, then the strobe keeps flashing on the silent loop. That second call
is the entire design in one line.

```js
await amp.stop('smoke')      // strobe goes dark — this is All Clear
await amp.fire('smoke', <tornado msg id>, 1)   // proves it re-arms
await amp.stop('smoke')
await amp.remove('smoke')
```

Confirm the strobe on a light-equipped speaker. A lightless speaker proves nothing.

Before judging any white flash, clear device maintenance mode — a strobe in maintenance mode
flashes white on its own at a priority above everything, and it survives restarts.

## Step 9 — Get the rule sheet

```js
amp.rules()
```

Prints every button's rule and downloads `console-rules.txt`. Nothing has to be derived on
site — the ids in it are the real ones off this server.

## Step 10 — Wire the console

On the C6110, go to **System > Events > Rules**.

Every rule gets the same five settings:

- Method **POST**
- Header `Content-Type: application/json`
- Authentication **Digest**, using the API user
- **Validate server certificate: OFF** — the AMP certificate is self-signed, and leaving this
  on makes every press fail silently
- Address is the server's LAN IP, never `127.0.0.1`

`127.0.0.1` only works for things running on the server. The console is a separate box
reaching across the network. The console's own IP does not matter and appears nowhere.

Enter the rules exactly as `console-rules.txt` lists them. Several rules on one button all
fire on that press; that is how the all-clears work.

## Step 11 — Accept

Press an emergency button, then press Building All Clear.

Confirm a button works a **second** time. If the second press 404s, someone used DELETE
somewhere instead of stop — re-provision and fix the all-clear rules.

---

## Priority, and why the buttons are safe

AMP has three priority tiers: `LOW`, `MEDIUM`, `HIGH`. Announcements are MEDIUM, silent holds
are LOW, all-clears and live paging are HIGH.

A higher-priority session **kills** a lower one outright. It does not duck it, and the lower
one does not resume.

That sounds fatal for a button that fires an announcement and a hold on one press, and it is
worth understanding why it isn't. What dies is a *running* low session cut down by a *new*
higher one. The button does the reverse: the announcement starts first and the hold a fraction
later, so the hold is accepted and simply takes over when the announcement ends.

**Verified on real hardware: the strobe keeps flashing after the voice stops.** Wire the rules
as generated.

## Why a silent file holds the strobe

Visual profiles are `audioSync: true` — the light runs exactly as long as the audio does.
There is no "strobe on its own" call; the strobe rides an audio session. An infinitely looping
silent file is therefore an infinitely running strobe. Stop the silence and the light dies.

## Traps

1. **Never use `oneshotPlayAudioFiles`.** It silently drops the visual profile and reports
   `DEFAULT`. Audio plays, strobe never fires. Persistent sessions keep the profile.
2. **All-clears must `stopAudioFiles`, never `DELETE`.** DELETE destroys the session, so the
   next press 404s. `stop` leaves it armed.
3. **Never test the API from the browser address bar.** It sends `Accept: text/html`, AMP only
   emits JSON, so you get a 406 or a bounce to the dashboard even when fully authenticated.
   This looks exactly like "the API isn't installed" and has wasted whole sessions.
4. **A password containing `!` breaks batch files.** `setlocal enabledelayedexpansion` eats it,
   so the password silently truncates and you get a wall of 401s that reads like a broken API.
   Use the browser or PowerShell.

## Working in an occupied building

You usually cannot fire a production zone to see if it works.

Commission in stages. Point the sessions at a small contained group first, prove the mechanism
there, then re-run `build()` and `provision()` with the production scope. The buttons never
change — the target lives on the session, not the button.

---

## Adding a new speaker or strobe

A factory-new Axis device has no software on it at all. **AMP cannot see a device until the
AMP ACAP is installed on it**, and an uninstalled device looks exactly like a dead switch port.

1. Find it with mDNS — browse `_axis-video._tcp` or `_http._tcp`. This works when ARP and
   WS-Discovery sweeps find nothing.
2. Create the login. A factory device has no root account yet:
   `pwdgrp.cgi?action=add&user=root&pwd=<pw>&grp=root&sgrp=admin:operator:viewer:ptz`
   (`pwdroot.cgi` is gone on AXIS OS 12.)
3. Talk to it with `curl --anyauth`, not `--digest`. Plain digest 401s on AXIS OS 12 and reads
   exactly like a wrong password.
4. Clear maintenance mode:
   `siren_and_light.cgi` → `setMaintenanceMode {"maintenanceMode":false}`
5. Install the ACAP from the AMP server's own folder,
   `…\AXIS Audio Manager Pro\Manager\Firmware\AXIS_Audio_Manager_Pro_<ver>_<arch>.eap`,
   via `POST /axis-cgi/applications/upload.cgi -F packfil=@<file>`. Get the architecture from
   `basicdeviceinfo`. Then start it:
   `applications/control.cgi?action=start&package=AudioManagerPro`
6. **Only now** does `root.AudioManagerPro.PrimaryServerIpAddress` exist — the ACAP creates it.
   Set it to the server IP. Writing it before step 5 fails in a way that looks like a
   permissions problem. The device self-registers in about 20 seconds.
7. Zone membership is not in the API. Add it in the AMP GUI, or
   `INSERT INTO aam_zone_sink (zoneid,sinkid)` in the AMP database, which AMP picks up live.

To settle hardware-versus-configuration in one call, drive the strobe directly and bypass AMP:
`siren_and_light.cgi` → `{"method":"start","params":{"profile":0}}`.
`profile` is an index. Passing a name returns 2210 "Requested function type is invalid".
