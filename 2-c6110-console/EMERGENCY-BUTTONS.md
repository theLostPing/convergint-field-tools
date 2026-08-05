# Emergency Announcement Buttons on a Network Paging Console

How to make an announcement repeat and keep strobes flashing until an All Clear, using AXIS Audio
Manager Pro sessions and console event rules.

Tested against AMP Pro 5.1.34 (API v1.2) and an AXIS C6110 console. On other versions, re-verify
before trusting any of this.

---

## The problem

A stock console button fires a one-shot announcement. The audio plays once, the strobes flash
while it plays (they're audio-synced), and then everything stops. For an emergency that's not
good enough. Someone who walks in thirty seconds late has no idea anything happened. Someone in
a loud area or wearing hearing protection never knew in the first place.

So you need two things the console doesn't do out of the box:

- the announcement plays **twice**
- the strobes **keep flashing** after the audio ends, until someone presses All Clear

And you want it done with configuration only. No per-device programming, no middleware, nothing
that has to keep running after you leave.

## The pattern

Pre-create audio sessions on the server. Each session carries its own priority, visual profile
(strobe colour), and target zones. The buttons just start and stop sessions over HTTP.

```
button press  ->  HTTP POST  ->  named session  ->  speakers + strobes
                                 (priority, colour, targets)
```

Two platform behaviors do the heavy lifting:

- repeat count `0` means play forever
- audio-synced visual profiles flash as long as the session is playing audio — and **silence
  counts as audio**

So the light hold is just a session playing a silence file on infinite repeat. Nobody hears it,
it never ends, and the strobe flashes the whole time. Stop the session and the light goes dark.

### Two requests per emergency button

| Session | Priority | Repeat | Role |
|---|---|---|---|
| `<event>-announce` | MEDIUM | 2 | The recorded message, played twice, strobes in sync |
| `<event>-hold` | LOW | 0 | Silence, forever. Inaudible under the announcement, keeps the strobes lit after it |

Both fire on the same press. No delay between them, no ordering requirement. The priority system
handles the sequencing, not the console.

## The behavior that nearly breaks it

In AMP, a higher-priority session kills a lower-priority one. It doesn't duck it, and the lower
session doesn't come back when the higher one ends. We confirmed this audibly: MEDIUM killed LOW,
HIGH killed both.

Which sounds fatal for the design above — if the MEDIUM announcement kills the LOW hold, the
strobes go dark right when they're supposed to start holding.

It works anyway, and the reason is direction. What dies is a *running* low session cut down by a
*new* higher one. The button does it the other way around: the announcement starts first, the
hold lands a fraction of a second later. The hold gets accepted, sits silent underneath, and
takes over when the announcement finishes.

We verified this on a real strobe before wiring a panel, and you should too: fire the announce
session, immediately fire the hold, and watch the light. Still flashing after the voice stops?
Wire everything this way. Goes dark? Fall back to one session per emergency playing a playlist
(message, message, silence) on infinite repeat — that sidesteps priority entirely and halves the
rule count, at the cost of a slightly messier All Clear.

## Priority tiers

The valid values are exactly `LOW`, `MEDIUM`, `HIGH`. `MID` and `NORMAL` get rejected with
`axis.aam.unknown.priority`. An assignment that works:

| Tier | Used for | Why |
|---|---|---|
| Background / music | White noise bed | Has to go silent under any emergency |
| `LOW` | Silent holds, walk test | Inaudible; only exists to keep strobes lit |
| `MEDIUM` | Emergency announcements | Audible over the noise bed |
| `HIGH` | All Clears | Has to cut through anything running |
| Live paging | Console microphone | A human voice always wins; strobes keep flashing under it |

## All Clear stops, it does not delete

The All Clear button stops every emergency session, whether or not it's running, then plays the
All Clear message. Three reasons:

- Deleting a session breaks its button. The next press 404s and nothing happens. Stopping leaves
  the session in place, ready for the next press.
- You can't ask the server what's playing — session objects carry no playback state. Stopping
  everything is the only reliable move.
- The operator shouldn't have to remember which emergency is active, or whether two were declared.
  Stopping a stopped session is harmless, so stop them all.

This is why the All Clear button is expensive in rule count: one stop per emergency session, plus
one play for the message.

## Wiring the console

The console manual only documents one-way and two-way paging actions, and says a button takes a
single action. The firmware is ahead of the manual — HTTP request is in the action list — but the
one-action-per-button limit is real. That's a problem when a button needs to send nine requests.

The way around it is the **soft key event**. That action type doesn't do anything itself; it
raises an internal event, and the rules engine can trigger on it. Several rules sharing the same
soft key condition all fire on one press.

1. **Display > Configuration > Actions** — add a soft key event action for each multi-request
   button. Name it for the button.
2. **Display > Configuration > Buttons** — assign the action to the button.
3. **System > Events > Recipients** — create *one* recipient for the server: base URL, port 443,
   the API credentials, certificate validation off (the server cert is self-signed). Every rule
   shares this recipient.
4. **System > Events > Rules** — one rule per HTTP request. Condition: the soft key event. Action:
   send notification through HTTPS, method POST, URL overridden per rule with the full API path,
   JSON in the **body**. If the form also has a *message* field, leave it empty — the API ignores
   it.

A button that only sends one request can use a direct HTTP request action and skip the rules
engine, though keeping everything in rules makes the panel easier to audit later.

## Traps

Each of these showed us a symptom pointing somewhere other than the real cause. In rough order of
how much time they cost:

**The API user is a separate account list from the dashboard login.** Same username and password
doesn't matter — if it wasn't created in the server's API Access panel, the API rejects it. And a
missing API account produces auth failures that look exactly like a server too old to have the
API at all. This one survived three site visits disguised as a version problem.

**Don't conclude "the API isn't there" from a probe that sends credentials.** A rejected login
and a missing route look identical that way. Probe without credentials: a route that exists
answers 401 with a `WWW-Authenticate` challenge, a route that doesn't answers 404. Two different
numbers, no ambiguity. `probe.js` in this folder does exactly this.

**Don't test the API from a browser address bar.** The address bar asks for HTML, the API only
speaks JSON, so you get a 406 or a bounce to the dashboard even when your login is fine. Looks
exactly like "endpoint doesn't exist." Use the dev console.

**The recipient's Test button returning 500 means nothing.** Test sends a generic probe without
the method and body the API wants. If anything, the 500 proves the console reached the server.
Only a real button press tests the configuration.

**A first 401 is digest auth working.** Challenge, response, success — that's the protocol. Only
a *final* 401 is a credential problem.

**Rules never show up in the console's actions list.** The event engine and the paging app are
separate layers. A button with working rules still looks unconfigured in its display settings.
Audit the rules list, not the actions list.

**Command-line HTTP clients can all fail where the browser works.** On Windows Server, anything
using Schannel — System32 curl, Git curl, PowerShell, .NET — dies on the server's mid-handshake
TLS renegotiation. Looks like a network or firewall problem; it isn't. The browser has its own
TLS stack and works fine, which is why `amp-console.js` exists and does digest auth in
JavaScript.

**Windows batch eats exclamation marks.** With delayed expansion on, `set PASS=abc!` silently
becomes `abc`, and you get a wall of 401s that reads as a broken API. Use PowerShell or the
browser.

**Substring matching can aim an emergency at the wrong zone.** Real example: a site-wide zone
named "All zones" next to a noise-bed zone named "All Zones White Noise". First-substring-match
picks the noise bed, every emergency fires into it, and everything returns 200. Match exact names
first and warn on ambiguity instead of resolving it quietly.

**Repeat is a count, not a duration.** A "thirty minute" walk test has to derive its repeat count
from the actual file lengths. Hard-code the number and the runtime silently doubles the day
someone swaps the tone file.

**A factory-new device is invisible to the server.** It ships with no ACAP, and the server can't
discover it until the management app is installed. The empty discovery table looks exactly like a
dead switch port. Check the device directly — mDNS, its own web page — before blaming the
network.

**Maintenance mode makes a strobe flash white on its own.** If white is also an emergency colour,
you can't tell them apart by looking. Clear maintenance mode before judging any white flash.

## API surface and its limits

v1.2 gives you `audioFiles`, `visualProfiles`, `targets`, and `audioSessions`. That's it — no
devices, sinks, zones, or system endpoints. What that means in practice:

- **Strobe colours are GUI-only.** `POST visualProfiles` returns 405. A deleted profile has to be
  rebuilt by hand, so document them (screenshots are fine).
- **Zone membership is GUI-only too.** Devices get assigned to zones in the dashboard.
- **No playback state.** You cannot ask whether an emergency is currently running.
- **Sessions survive a service restart.** Provision once.
- **There's no upload endpoint.** The libraries are synced folders — drop a file in and the server
  indexes it within seconds.
- **One-shot play calls silently drop the visual profile** and report it as `DEFAULT`. Colour has
  to ride on a pre-created session. This is most of the reason the design uses sessions at all.

## Commissioning without alarming the building

Most sites can't fire a building-wide emergency just to test a button. Build the test surfaces
into the zone design up front:

- **A small zone at the console** — a few speakers, no strobes — with a button that plays the All
  Clear there. Ten seconds, any time of day, proves console + credentials + server.
- **A technical-space zone** with one speaker and one strobe, so you can watch the full
  announce-then-hold behavior with nothing audible outside the closet.
- **A walk test** that can't be mistaken for an alarm, for coverage checks.

Entering rules is silent — nothing fires until a press — so most of the work can happen during
business hours. Only the final acceptance needs an out-of-hours window.

## The credential is the weak point

The console logs into the server on every button press. Delete, disable, expire, or rename that
API account and every emergency button dies — silently. The panel looks normal, the button lights
up, nothing plays, and nobody finds out until someone needs it.

So: name the account for the **customer**, never the integrator. An integrator-named account is
exactly what gets swept in an offboarding, and that sweep takes the emergency system with it.
Keep it out of any forced password expiry, or write a rotation procedure that covers server and
console together. Record it as infrastructure belonging to the emergency system so an account
review doesn't clean it up.

And have the customer press the local test button monthly. It's a ten-second check and it's the
only cheap detector for this failure mode.

## Tooling in this folder

| File | Purpose |
|---|---|
| `amp-console.js` | Paste into the dashboard's dev console. Digest auth in JS, discovers real IDs, builds and provisions the sessions by name, prints the console rule sheet. |
| `amp-panel.js` | A clickable UI over the same API, for when you'd rather not type into a console. |
| `probe.js` | Credential-free probe. Tells apart a missing route, a rejected login, a disabled public API, and a proxy in front. |
| `names.js` | Name-to-ID resolution, exact-match first, warns on ambiguity. |
| `virtual-console/` | Two-file PHP page that renders the whole panel and replays each button's rule set. Bench replica / re-test surface. |
| `version.ps1` / `version.cmd` | Read the installed server version off the box, including binary FileVersion (the registry lies after an in-place upgrade). |
| `silence-60s.wav`, `silence-30s.mp3` | The silence files the holds and walk test depend on. |
