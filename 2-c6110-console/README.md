# Wiring the C6110 buttons — Lockdown / All Clear / Test

Every button on the console does the same basic thing: it fires an HTTP call at the AMP server,
and AMP plays — or stops — a sound you set up ahead of time. So the work splits in two. First you
build the sounds and "sessions" on the server, then you point each button at the right one. None of
it works until your speakers are online and named, so get **Step 1 done first**.

One thing up front: you can't drive this from the command line on the customer's server. curl and
PowerShell both choke on that box's TLS — it's a Windows Server quirk. The browser handles it fine,
though, so everything below happens in the AMP dashboard: open it, press **F12** for the developer
console, and paste in `amp-console.js`. That console is where you work.

## If the API looks like it isn't there — start here
Before you conclude the box is too old, run **`probe.js`**. Paste the whole file into the same F12
console and it answers one question properly: does `/api/v1.2/` exist on this server?

It sends **no credentials at all**, and that's the whole point. A route that exists answers `401`
and asks for a login. A route that doesn't exist answers `404`. So a screen full of 401s means the
API is fine and only your login is wrong — which looks exactly like a missing API if you're testing
with credentials. It prints a table and then a plain-English verdict underneath.

Then run **`version.ps1`** on the server itself (or `version.cmd` if PowerShell is locked down) to
get the installed version off the box rather than off memory. Those two outputs together settle it.

Three things all look identical from the outside, and the probe tells them apart:
the API being switched off in the GUI, the API user being wrong, and the box genuinely being old.

## Before you start
Have all of this in hand — if something's missing, stop, because the steps won't work without it:

- Speakers online and named in AMP (that's Step 1).
- The AMP **Public API switched on** — it's in the GUI under Settings → API / Integrations.
- Your audio already dropped into the Announcements folder: the fire, tornado, lightning and WV
  messages, the all-clear message, plus `test-test-test.mp3`, `silence-60s.wav`, and `silence-30s.mp3`.
- Your **visual profiles** (the strobe colours) and your **zones** set up: the whole site, the hangar
  zone on its own, and the four lobby speakers.
- The API login. This trips everybody up: it's a dedicated **API user made inside AMP**
  (Settings → API / Integrations) — **not** a Windows account, not your personal login, and not the
  dashboard session. On the bench that's `Convergint / 2683`.

## What each button does
| Btn | Function | Where it goes | What it does |
|-----|----------|---------------|--------------|
| 1 | All-call paging | everywhere | live voice, native — no rule needed |
| 3 | Test | site | plays the test message + 30s of flash, loops ~30 min, then stops itself |
| 4 | Lobby page | 4 lobby speakers | live voice, native — no rule |
| 5 | Lobby All Clear | 4 lobby speakers | plays the all-clear once, green |
| 6 | Building All Clear | site | stops everything, then all-clear once, green |
| 7 | Fire | site | voice loops continuously + strobe until an all clear |
| 8 | Tornado | site | plays the message twice, then a silent strobe hold until all clear |
| 9 | Lightning within 5 | hangar only | message twice + silent strobe hold |
| 10 | Lightning All Clear | hangar only | stops the hangar, plays all-clear once |
| 12 | WV / Security | site | message twice + silent strobe hold |

## Getting the sessions built
This all happens in the browser console. Do it **a line at a time** — run one thing, read what it
tells you, then do the next. Don't paste the whole lot in at once, or it'll build everything before
you've even seen what's on the box.

**Load the tool.** Paste the whole `amp-console.js` file in and hit Enter. It just says `undefined` —
that's fine, it means it loaded.

**Log in.** Swap in the real API password, then run it:
`amp.login('Convergint','the-real-password')`
Forget and leave the placeholder in, and the tool stops you with a red "Credentials not set" — it
won't let you fail quietly.

**Read the box.** `await amp.discover()`
It prints out everything it found — your sound files, your colour profiles, your zones — each with a
name. Those names are what you hand it in the next step.

**Build the sessions.** This is the part that used to be a slog. You describe the design in plain
names — fire is red and goes site-wide, the fire sound is the file with "fire" in it — and it looks
up all the IDs itself. Fill these in from what `discover()` just showed you, then run it:
```
await amp.build({
  colours:{fire:'red', wv:'purple', tornado:'amber', lightning:'blue', allclear:'green'},
  zones:{site:'All zones', hangar:'Hangar', lobby:['Lobby 1','Lobby 2','Lobby 3','Lobby 4']},
  audio:{fire:'fire', wv:'workplace', tornado:'tornado', lightning:'lightning', allclear:'all clear', test:'test'},
})
```
It prints a table of what it built. Look it over — if any line says `undefined`, a name didn't match
(a typo, or it's called something different on the box). Fix that word and run it again.

Every zone slot takes **one name or a list**. Real sites split what you'd call a zone across
several targets — a speaker zone plus its strobe group, or a hangar plus the hangar office — so
`site`, `hangar` and `lobby` all accept arrays. `audio.lightningAllclear` is optional: set it if
the site has its own lightning all-clear recording, otherwise the generic one gets used for both.

**Check `zones.site` yourself before provisioning.** It is the entire reach of a fire or tornado
announcement, and it's the one slot guessing can get wrong in a way nothing downstream catches.
A target named something like "All Zones White Noise" reads as site-wide and is only the noise
bed — aim an emergency at it and the announcement fires successfully into the wrong place.

**Make them real.** Once the table looks right: `await amp.provision()`. That actually creates the
eleven sessions on the server.

**Get your button calls.** `amp.rules()`. It prints every button's rule right there in the console
— that's your list, on screen, nothing to go find. It also saves a copy as `console-rules.txt` in
your browser's downloads if you'd rather have a text file, but you don't need it.

## Testing before you wire anything
Before you touch the console, fire a session by hand to make sure the server side is good. Do these
one at a time and watch/listen. On an occupied site, only ever aim at a contained lobby target —
never the whole building. The IDs are the numbers `discover()` showed you.
- start it: `await amp.fire('fire-announce', FIRE_MSG_ID, 0)`
- stop it: `await amp.stop('fire-announce')`
- all-clear: `await amp.fire('allclear', ALLCLEAR_ID, 1)`

## Wiring the buttons
When you ran `amp.rules()` a minute ago, it printed all your button rules right there in the console
— scroll up and they're sitting there. (It also saved a copy as `console-rules.txt` in your browser's
downloads, if you'd rather open it in a text editor.) Either way, it's laid out one button at a time:
each chunk is a button, each line under it is one rule, already written out for you — the exact web
address to hit and the bit of data to send with it. You're not working anything out here, just copying.

In the C6110, go to **System > Events > Rules** and add each of those lines as a rule. Every one gets
the same handful of settings:

- It's a **POST**.
- Content-Type is **application/json** — that just tells AMP you're sending it some JSON.
- For auth, pick **Digest** and use that same API user from before.
- Turn **"Validate server certificate" OFF**. AMP's cert is self-signed, and if you leave this on,
  every press fails silently — you'll swear it's broken when it's really just this checkbox.
- The address points at the AMP box's **LAN IP**, never `127.0.0.1`. The console is its own box
  reaching across the network, so "localhost" means nothing to it.
- If two lines share a button number, that's on purpose — they both fire on that press. That's how
  the multi-step buttons like All Clear work.

## Two things that'll eat your afternoon
- Never use `oneshotPlayAudioFiles`. The audio plays fine but the strobe silently never fires, and
  you'll tear your hair out looking for the problem.
- All-clears have to **stop** the sessions, never **delete** them. Delete kills the session outright,
  so the panel works exactly once and then 404s forever after.

## When it's not working
| What you see | What it is |
|---|---|
| Red "Credentials not set" | You left the placeholder password in — put the real one in and log in again |
| Everything comes back 401 | Wrong API user or password |
| The API just bounces you to the dashboard | You typed the URL in the address bar — that only works from the console, not the browser bar |
| API says "Public api is disabled" | You haven't switched the API on in the AMP GUI yet |
| `build()` shows `undefined` somewhere | A name you passed didn't match anything — fix that name and run it again |
| Every console press 404s | The sessions aren't there — you skipped `provision()`, or a delete wiped them; run it again |
| Audio plays but no strobe | Either a lightless speaker, or `oneshot` snuck in |
| Works once, dead on the second press | A delete got into an all-clear — re-provision and fix that rule |
| Console does nothing but the bench test worked | Wrong IP (has to be the LAN IP, not 127.0.0.1), or you left cert-validate on |
| "This box doesn't have v1.2" | Don't take that on faith — run `probe.js`. Without credentials, 401 means it's there and 404 means it isn't. A wrong API user reads as a missing API |
| Probe says 404 on every v1.2 path | That one's real. Run `version.ps1` too, and send both back — the old API has no stop call, so All Clear needs rethinking |
