# Emergency Announcement Buttons on a Network Paging Console

Making an announcement repeat, and holding strobes lit until an All Clear, using AXIS Audio
Manager Pro sessions and console event rules.

Validated against AMP Pro 5.1.34 (API v1.2) and an AXIS C6110 paging console. Behaviour on other
versions should be re-verified rather than assumed.

---

## The problem

Out of the box, a button on a network paging console fires a one-shot announcement. The audio plays
once. The strobes, being audio-synchronised, flash while it plays and stop when it stops.

For an emergency that is not enough. Anyone who arrives thirty seconds late has no idea an emergency
was declared. Anyone in a loud area, wearing hearing protection, or deaf or hard of hearing has
nothing at all. What is needed is:

- the announcement plays **twice**, so late listeners get the message; and
- the strobes **keep flashing indefinitely** after the audio ends, until an All Clear is pressed.

The goal is to achieve that with configuration only — no per-device programming, no middleware, and
nothing that has to keep running after the integrator leaves.

## The pattern

Pre-create *audio sessions* on the server, each carrying its own priority, visual profile (strobe
colour) and target zones. The console's buttons then do nothing but start and stop those sessions
over HTTP.

```
button press  ->  HTTP POST  ->  named session  ->  speakers + strobes
                                 (priority, colour, targets)
```

Two properties of the platform make the rest work:

- **A repeat count of zero means play forever.** Any file can be looped indefinitely.
- **Audio-synchronised visual profiles flash for as long as the session is playing audio — and
  silence counts as audio.**

Put those together and the light hold is a session that plays a **file of pure silence on infinite
repeat**. Inaudible, never-ending, and the strobe treats it as ongoing audio and keeps flashing.
Stopping that session ends the "audio" and the light goes dark.

### Two requests per emergency button

| Session | Priority | Repeat | Role |
|---|---|---|---|
| `<event>-announce` | MEDIUM | 2 | The recorded message, played twice, strobes flashing in sync |
| `<event>-hold` | LOW | 0 | Silence, forever. Inaudible under the announcement; keeps the strobes lit once it ends |

Both fire on the same press with no delay and no ordering requirement. The pacing is a consequence
of the priority system, not of any timing the console performs.

## The behaviour that nearly breaks this

> **Priority does not layer — it terminates.**
> A higher-priority session **kills** a lower-priority one. It does not duck it, and the lower
> session does not resume when the higher one finishes. Confirmed audibly: MEDIUM killed LOW, and
> HIGH killed both.

Read naively, that destroys the design — if the MEDIUM announcement kills the LOW hold, the strobes
go dark exactly when they are supposed to start holding.

**It does not, and the reason is directional.** What gets terminated is a *running* low-priority
session cut down by a *newly started* higher-priority one. The button does the reverse: the
higher-priority announcement starts first, and the low-priority hold a fraction of a second later.
The hold is accepted, sits inaudible underneath, and takes over when the announcement ends.

**Verify this on hardware before wiring a whole panel.** Fire the announce session and then
immediately the hold session, and watch a real strobe. If the light is still flashing after the
voice stops, the pattern is sound. If it goes dark, fall back to **one session per emergency**
playing a single playlist (message, message, silence) on infinite repeat — which sidesteps priority
interaction entirely and halves the request count, at the cost of a slightly less clean All Clear.

This was verified on a live strobe/speaker unit and the two-request pattern held.

## Priority tiers

The enum is `LOW`, `MEDIUM`, `HIGH`. There is no `MID` or `NORMAL` — both are rejected with
`axis.aam.unknown.priority`. A workable assignment:

| Tier | Used for | Rationale |
|---|---|---|
| Background / music | White noise bed | Must fall silent under any emergency |
| `LOW` | Silent holds, walk test | Inaudible; exists to keep strobes lit |
| `MEDIUM` | Emergency announcements | Audible over the noise bed |
| `HIGH` | All Clears | Must cut through anything running |
| Live paging | Console microphone | A human voice always wins; strobes keep flashing underneath |

## All Clear stops, it does not delete

An All Clear button issues a stop against every emergency session unconditionally, then plays the
All Clear message. Three reasons it is built that way:

- **Deleting a session breaks the button.** Stopping leaves the session in place so the next press
  works; deleting it means the next press 404s and nothing happens.
- **The API cannot report whether a session is playing.** Session objects carry no playback state,
  so there is no way to ask what is currently running. Stopping everything is the only reliable
  approach.
- **The operator should not have to remember.** Under stress, nobody should be working out which
  emergency is active or whether two were declared. Stopping a session that is not running is
  harmless.

This is what makes an All Clear button expensive in rule count — one stop per emergency session,
plus one play for the All Clear message.

## Wiring the console

The console's documentation describes only one-way and two-way paging actions, and states that a
button uses a single action. Installed firmware may be ahead of that documentation and offer an HTTP
request action — but a button still takes only one action, which is a problem for any button that
must send several requests.

**The soft key event is the bridge.** A soft key event action raises an internal event rather than
doing anything itself, and the event rules engine can use that event as a condition. Several rules
sharing one soft key condition all fire on a single press.

1. **Display > Configuration > Actions** — create a soft key event action per button that needs more
   than one request.
2. **Display > Configuration > Buttons** — assign the action to the button.
3. **System > Events > Recipients** — create one recipient for the server: base URL, port 443, the
   API credentials, certificate validation off for a self-signed certificate. Every rule shares it.
4. **System > Events > Rules** — one rule per HTTP request. Condition is the soft key event; action
   is *send notification through HTTPS*; method POST; override the URL per rule with the full API
   path; put the JSON in the **body** (leave any *message* field empty).

Buttons needing only one request can use a direct HTTP request action instead, though keeping every
button in the rules engine makes the panel easier to audit.

## Traps

Every one of these produced a symptom that pointed somewhere other than the actual cause.

**The API user is a separate account list from the dashboard login.** Identical credentials do not
mean the API answers. The API account must be created explicitly in the server's API access panel. A
missing entry produces authentication failures that look exactly like a server too old to have the
interface at all. This is the single most expensive trap in the whole system — it survived three
site visits disguised as a version problem.

**Never conclude "the API is absent" from an authenticated probe.** Sending credentials makes a
rejected login and a missing route indistinguishable. Probe *without* credentials instead: an
existing route answers 401 with a `WWW-Authenticate` challenge, an absent route answers 404. Two
different numbers, no ambiguity. (`probe.js` in this folder does exactly this.)

**Never test the API from a browser address bar.** The address bar requests HTML. A JSON-only API
responds 406 or bounces to the dashboard even when fully authenticated, which reads convincingly as
"this endpoint does not exist."

**A recipient's Test button can return 500 and mean nothing.** Test sends a generic probe without the
method and body the API expects. A 500 confirms the console reached the server. Only a real button
press proves the configuration.

**A first 401 is part of digest authentication.** The server challenges, the client answers, then
succeeds. A 401 followed by success is the protocol working. Only a final 401 is a credential
problem.

**Rules do not appear in the console's actions list.** The event engine and the paging application
are separate layers. A button whose rules work will still look unconfigured in its display settings.

**Command-line HTTP clients may fail where a browser succeeds.** On Windows Server, clients using
Schannel fail the server's mid-handshake TLS renegotiation — System32 curl, Git curl, PowerShell and
.NET all die, which looks like a network or firewall problem. The browser's TLS stack works. Running
the provisioning tool inside the browser's developer console sidesteps it entirely; that is why
`amp-console.js` exists and implements digest auth in JavaScript.

**An exclamation mark in a password is eaten by Windows batch.** With delayed expansion enabled,
`set PASS=abc!` silently becomes `abc`, producing a wall of 401s that reads as a broken API. Use
PowerShell or the browser.

**A substring match on a zone name can aim an emergency at the wrong zone.** A site-wide zone called
"All zones" is a substring of a noise-bed zone called "All Zones White Noise". A first-match-wins
lookup silently aims every emergency at the noise bed and returns a perfectly healthy 200 doing it.
Match exact names first, and warn on ambiguity rather than resolving it quietly.

**Repeat is a count, not a duration.** A walk test built as "play for thirty minutes" must derive its
repeat count from the real file lengths. Hard-coding a number means the run time silently doubles the
day someone swaps the tone file.

**A factory-new device is invisible to the server.** It ships with no ACAP installed, and the server
cannot discover it until the management application is present. The empty discovery table looks
exactly like a dead switch port. Probe the device directly by mDNS and its own web interface before
suspecting the network.

**Maintenance mode makes a strobe flash white on its own.** If white is also an emergency colour, a
device left in maintenance mode is indistinguishable from an active alert. Clear it before judging
any white flash.

## API surface and its limits

The v1.2 surface is narrow: `audioFiles`, `visualProfiles`, `targets` and `audioSessions`. There is
no devices, sinks, zones or system endpoint. Consequences worth knowing before designing around it:

- **Visual profiles cannot be created programmatically.** `POST visualProfiles` returns 405 — strobe
  colours are dashboard-only. A deleted profile must be rebuilt by hand, so document them.
- **Zone membership cannot be set through the API.** Devices are assigned to zones in the dashboard.
- **Sessions expose no playback state.** There is no way to ask whether an emergency is active.
- **Sessions persist across a service restart.** Provision once; they survive.
- **Audio libraries are synchronised folders.** Dropping a file into the library folder is the upload
  mechanism — the server indexes it within seconds. There is no upload endpoint.
- **A one-shot play call silently ignores the visual profile** and reports it as `DEFAULT`. The strobe
  colour must ride on a pre-created session, which is a large part of why this design uses sessions.

## Commissioning without alarming the building

Most sites cannot fire a building-wide emergency to test a button. Build the test surfaces into the
zone design rather than improvising them later:

- **A small zone at the console** — a few speakers, no strobes — with a button that plays the All
  Clear there. Ten seconds, any time of day, proves console, credentials and server.
- **A technical-space zone** with one speaker and one strobe, so the full announce-then-hold
  behaviour can be watched with nothing audible in occupied areas.
- **A walk test** with an unmistakably non-emergency character for coverage checks.

Entering rules is silent — nothing fires until a button is pressed — so configuration can proceed
during occupied hours and only the final acceptance needs a scheduled window.

## The credential is the weak point

> The console authenticates on **every** button press. If the API account is deleted, disabled,
> expired or renamed, every emergency button stops working — **silently**. The panel looks normal,
> the button lights up, and nothing happens.

**Name the account for the customer, never for the integrator**, so that offboarding a contractor
cannot take the emergency system down with it. Ensure it is exempt from password expiry, or that
rotation is a documented procedure covering server and console together. Record it as infrastructure
belonging to the emergency system so an account review does not remove it.

Recommend a monthly press of the local test button. It is the cheapest possible detector for this
failure mode.

## Tooling in this folder

| File | Purpose |
|---|---|
| `amp-console.js` | Paste into the dashboard's dev console. Implements digest auth in JS, discovers real IDs, builds and provisions the sessions by name, and prints the console rule sheet. |
| `amp-panel.js` | A UI over the same API, instead of typing into the console. |
| `probe.js` | Credential-free probe that distinguishes a missing route from a rejected login, a disabled public API, and a proxy in front. |
| `names.js` | Name-to-ID resolution with exact-match-first and ambiguity warnings. |
| `version.ps1` / `version.cmd` | Read the installed server version off the box, including binary FileVersion (the registry lies after an in-place upgrade). |
| `silence-60s.wav`, `silence-30s.mp3` | The silence files the holds and walk test depend on. |
