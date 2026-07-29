# Convergint Field Tools

Tools + guides for Axis AAM Pro audio (paging / lockdown / strobe) and TransCore readers.
Field-proven against live customer gear.

---

## ⚠️ READ THIS FIRST — the thing that eats your day

Anything that talks to the **AAM Pro API from a command line on a modern Windows
Server** — System32 `curl`, Git `curl`, PowerShell / .NET — **FAILS.** The server's
Schannel can't complete AMP's TLS handshake (`curl (35) SEC_E_ILLEGAL_MESSAGE` /
"could not create SSL/TLS secure channel"). **The browser works.**

So for anything that hits the AMP API (creating sessions, firing/stopping them):

### ➡️ Use `2-c6110-console/amp-console.js` in the browser
RDP into the AAM Pro server, open its browser to the AAM **dashboard**, `F12` → Console,
paste the file, then:
```
amp.login('Convergint','<AMP API user's password>')
await amp.diagnose()     // which API is live
await amp.discover()     // dump the real IDs
await amp.provision()    // create the sessions (fill SESSIONS[] first)
```

**Auth = the AMP API user** — NOT your personal login, NOT the dashboard
session. Bench: `Convergint / 2683`. Customer site: `Convergint / <its API password>`.
(That `401`-then-`200` you see per call is normal — it's the digest challenge/response.)

The `.cmd` / `.ps1` provisioners still work on the **bench** and on older servers, but are
**dead against the customer's Server** — don't reach for them there.

---

## The 3 jobs

| # | Folder | Gets you | What to run |
|---|--------|----------|-------------|
| **1** | [`1-amp-speakers/`](1-amp-speakers/) | Speakers online, pointed at AMP, and **named** — bulk from one CSV | `.cmd`/`.ps1` — these talk to each **speaker** (VAPIX), not the AMP API, so they're fine |
| **2** | [`2-c6110-console/`](2-c6110-console/) | **C6110 buttons**: alert (announce + strobe hold), all-clear, walk test | **`amp-console.js`** to build the sessions → then enter the button rules in the console UI. **`COMMISSIONING.md` is the closet runbook.** |
| **3** | [`3-transcore-e4-reader/`](3-transcore-e4-reader/) | TransCore Encompass 4 **Wiegand over RS-232** | `.ps1` — serial, nothing to do with AMP, works anywhere |

---

## Notes
- **Where you run it:** ON the AAM Pro server (RDP/console in). Convergint can't put its own
  device on the customer network; the server is already on the speaker network.
- **This repo is PUBLIC and carries no secrets** — every credential/IP is an `<API_USER>` /
  `<API_PASSWORD>` / `<SERVER_IP>` placeholder you fill in at the top of each tool.
- **Multi-step buttons:** the console fires several steps by stacking **multiple Rules on one
  button trigger**; order isn't guaranteed, so the design uses **priority** (HIGH announce /
  all-clear preempts LOW holds). See `2-c6110-console/COMMISSIONING.md` Step 2.
- Each folder's guide has a **"when it doesn't work"** section.
