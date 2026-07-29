#!/usr/bin/env python3
"""
AXIS C6110 bench simulator — fires the exact HTTPS requests a C6110 button sends.

DESIGN (proven against a live AAM Pro 5.1.34):

  Sessions are PRE-CREATED once at commissioning ("provision"), each carrying its
  own visual profile. The console buttons then only ever play/stop them BY NAME:

      POST /audioSessions/custom/<name>/playAudioFiles
      POST /audioSessions/custom/<name>/stopAudioFiles

  Two things forced this shape, both found the hard way:

  1. oneshotPlayAudioFiles does NOT retain the visual profile — it reports back
     visualProfileEnabled "DEFAULT" no matter what you send. A pre-created
     session echoes "TRUE" + the profile id. So the strobe rides on the session,
     not on the one-shot call.

  2. Use stopAudioFiles, NOT DELETE, on all-clear. DELETE destroys the
     pre-created session and the NEXT button press 404s. stop leaves it armed.

  The strobe is held up by an infinite silent loop: visual profiles are
  audioSync'd (light lives exactly as long as the audio), so a never-ending
  silent file == a never-ending strobe, killed on demand.

Stdlib only, no pip install.
    GUI:  python console_sim.py
    CLI:  python console_sim.py provision | alert | allclear | walktest | walkstop | status | discover | curl
"""

import json
import ssl
import sys
import urllib.error
import urllib.request

# ---------------------------------------------------------------- CONFIG
SERVER = "127.0.0.1"
API_USER = "Convergint"
API_PASS = "2683"
API_VER = "v1.2"

ZONE = "zon_2"                # TEST zone. "sit_1" = whole site.

FILE_ANNOUNCE = "3"           # alert announcement
FILE_SILENCE = "4"            # silence-60s.wav (bench AMP library id, uploaded 2026-07-18)
FILE_ALLCLEAR = "2"           # all-clear announcement

PROFILE_ALERT = 3             # "Priority paging profile" — BLINK / RED
PROFILE_CLEAR = 1             # "Announcements profile"   — STEADY / GREEN
PROFILE_WALK = 2              # "Paging profile" — distinct colour so a walk test
                              # can never be mistaken for a live alarm

FILE_WALK = "5"               # walktest-dinger.wav — bell ding + silence pad,
                              # 4s loop period (generated: _scratch/make_dinger.py)

ANNOUNCE_TIMES = 2            # client wants it twice

S_ANNOUNCE = "lockdown-announce"
S_HOLD = "lockdown-hold"
S_CLEAR = "allclear"
S_WALK = "walk-test"
# ------------------------------------------------------------------------

BASE = f"https://{SERVER}/api/{API_VER}"
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE   # AAM ships a self-signed cert


def _opener():
    mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    mgr.add_password(None, BASE, API_USER, API_PASS)
    return urllib.request.build_opener(
        urllib.request.HTTPDigestAuthHandler(mgr),
        urllib.request.HTTPSHandler(context=_SSL),
    )


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
    )
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with _opener().open(req, timeout=15) as r:
            raw = r.read().decode(errors="replace")
            try:
                return r.status, json.loads(raw)
            except json.JSONDecodeError:
                return r.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"


# ------------------------------------------- commissioning (run once)

SESSIONS = [
    # name        prio     visual profile
    (S_ANNOUNCE, "HIGH", PROFILE_ALERT),
    (S_HOLD, "LOW", PROFILE_ALERT),
    (S_CLEAR, "HIGH", PROFILE_CLEAR),
    (S_WALK, "LOW", PROFILE_WALK),
]


def provision(log=print):
    """Create the persistent sessions the buttons drive. Idempotent."""
    log("provisioning persistent sessions...")
    for name, prio, profile in SESSIONS:
        call("DELETE", f"/audioSessions/custom/{name}")   # clear any stale one
        status, resp = call("POST", "/audioSessions", {
            "customId": name,
            "prio": prio,
            "targets": [ZONE],
            "type": "HTTP",
            "visualProfileEnabled": "TRUE",
            "visualProfileId": profile,
        })
        ok = status == 200
        vp = resp.get("visualProfileId") if isinstance(resp, dict) else "?"
        log(f"  [{'OK ' if ok else 'FAIL'}] {name:<18} prio={prio:<4} "
            f"visualProfile={vp}  -> {status}")
        if not ok:
            log(f"        {resp}")
    log("done. buttons are armed.")


# ------------------------------------------------------- the two buttons

def alert():
    """ALERT: announce twice, and hold the strobe up until all-clear."""
    return [
        # the announcement — plays twice, then ends on its own
        ("POST", f"/audioSessions/custom/{S_ANNOUNCE}/playAudioFiles",
         {"fileIds": [FILE_ANNOUNCE], "repeat": ANNOUNCE_TIMES}),
        # the strobe holder — infinite silent loop (repeat 0 = forever)
        ("POST", f"/audioSessions/custom/{S_HOLD}/playAudioFiles",
         {"fileIds": [FILE_SILENCE], "repeat": 0}),
    ]


def allclear():
    """ALL CLEAR: kill the strobe, then play the all-clear in its own colour."""
    return [
        # stop (not delete!) — the session stays armed for the next press
        ("POST", f"/audioSessions/custom/{S_HOLD}/stopAudioFiles", {}),
        ("POST", f"/audioSessions/custom/{S_ANNOUNCE}/stopAudioFiles", {}),
        # also ends a running walk test — stopping an idle session is harmless
        ("POST", f"/audioSessions/custom/{S_WALK}/stopAudioFiles", {}),
        # all-clear fires AFTER the stops: an infinite session on the same
        # targets would otherwise queue this behind it forever.
        ("POST", f"/audioSessions/custom/{S_CLEAR}/playAudioFiles",
         {"fileIds": [FILE_ALLCLEAR], "repeat": 1}),
    ]


def walktest_start():
    """WALK TEST: loop an audible tone + distinct strobe colour on every
    speaker until stopped. LOW prio — a real alert or a live page preempts it."""
    return [
        ("POST", f"/audioSessions/custom/{S_WALK}/playAudioFiles",
         {"fileIds": [FILE_WALK], "repeat": 0}),
    ]


def walktest_stop():
    return [
        ("POST", f"/audioSessions/custom/{S_WALK}/stopAudioFiles", {}),
    ]


def as_curl(method, path, body):
    c = f'curl -k --digest -u {API_USER}:{API_PASS} -X {method} "{BASE}{path}"'
    if body is not None:
        c += (f' \\\n  -H "Content-Type: application/json"'
              f" \\\n  -d '{json.dumps(body)}'")
    return c


def run(steps, log=print):
    for method, path, body in steps:
        status, resp = call(method, path, body)
        ok = status in (200, 204)
        log(f"[{'OK ' if ok else 'FAIL'}] {method} {path} -> {status}")
        if body:
            log(f"       {json.dumps(body)}")
        if not ok:
            log(f"       {resp}")
            if status == 404:
                log("       ^ session missing. run 'provision' first.")


def status_report(log=print):
    _, sessions = call("GET", "/audioSessions")
    if isinstance(sessions, list) and sessions:
        for s in sessions:
            log(f"  session {s.get('customId', s['id']):<18} prio={s.get('prio'):<4} "
                f"visual={s.get('visualProfileEnabled')}/{s.get('visualProfileId')}")
    else:
        log("  no sessions — not provisioned")
    _, targets = call("GET", "/targets")
    if isinstance(targets, list):
        for t in targets:
            if t.get("type") == "device":
                log(f"  device  {t['niceName']} -> {t.get('status')}")


def discover(log=print):
    for path, label in (("/audioFiles", "AUDIO FILES"),
                        ("/visualProfiles", "VISUAL PROFILES"),
                        ("/targets", "TARGETS")):
        _, data = call("GET", path)
        log(f"--- {label}")
        if not isinstance(data, list):
            log(f"  {data}")
            continue
        for d in data:
            if path == "/audioFiles":
                log(f"  id={d['id']:>3}  {d['name']}  ({d['length']}s)")
            elif path == "/visualProfiles":
                lp = d.get("lightProfile") or {}
                log(f"  id={d['id']}  {d['name']}  "
                    f"[{lp.get('pattern')}/{','.join(lp.get('colors', []))} "
                    f"audioSync={lp.get('audioSync')}]  used={d.get('used')}")
            else:
                st = f" [{d['status']}]" if d.get("status") else ""
                log(f"  {d['id']:>6}  {d['type']:<14} "
                    f"{d.get('niceName', '(unnamed)')}{st}")


# ------------------------------------------------------------------ GUI

def gui():
    import tkinter as tk
    from tkinter.scrolledtext import ScrolledText

    root = tk.Tk()
    root.title("AXIS C6110 — bench simulator")
    root.configure(bg="#1c1c1c")
    root.geometry("820x580")

    out = ScrolledText(root, bg="#0d0d0d", fg="#d0d0d0", font=("Consolas", 9),
                       insertbackground="#d0d0d0", relief="flat")

    def log(msg=""):
        out.insert("end", str(msg) + "\n")
        out.see("end")
        root.update_idletasks()

    def fire(fn, name):
        log(f"\n===== BUTTON PRESSED: {name} =====")
        run(fn(), log)

    def show_curl():
        log("\n===== PASTE INTO THE C6110: System > Events > Rules =====")
        log("(one rule per line below, all on the same button trigger)")
        for label, fn in (("ALERT", alert), ("ALL CLEAR", allclear),
                          ("WALK TEST start", walktest_start),
                          ("WALK TEST stop", walktest_stop)):
            log(f"\n--- {label} button — {len(fn())} rules")
            for i, (m, p, b) in enumerate(fn(), 1):
                log(f"\n  rule {i}:")
                log(as_curl(m, p, b))

    bar = tk.Frame(root, bg="#1c1c1c")
    bar.pack(fill="x", padx=10, pady=10)

    def button(parent, text, bg, cmd):
        return tk.Button(parent, text=text, bg=bg, fg="white", command=cmd,
                         font=("Segoe UI", 13, "bold"), width=16, height=2,
                         relief="flat", activebackground=bg, cursor="hand2")

    button(bar, "ALERT", "#c60e23", lambda: fire(alert, "ALERT")).pack(side="left", padx=4)
    button(bar, "ALL CLEAR", "#1a7f37", lambda: fire(allclear, "ALL CLEAR")).pack(side="left", padx=4)

    walk_on = {"v": False}

    def toggle_walk():
        if not walk_on["v"]:
            fire(walktest_start, "WALK TEST — START")
        else:
            fire(walktest_stop, "WALK TEST — STOP")
        walk_on["v"] = not walk_on["v"]
        walk_btn.config(text="WALK TEST ■ STOP" if walk_on["v"] else "WALK TEST",
                        bg="#7a4b00" if walk_on["v"] else "#b8860b")

    walk_btn = button(bar, "WALK TEST", "#b8860b", toggle_walk)
    walk_btn.pack(side="left", padx=4)

    side = tk.Frame(bar, bg="#1c1c1c")
    side.pack(side="left", padx=16)
    for label, cmd in (
        ("Provision", lambda: (log("\n----- PROVISION"), provision(log))),
        ("Status", lambda: (log("\n----- STATUS"), status_report(log))),
        ("Discover IDs", lambda: (log("\n----- DISCOVER"), discover(log))),
        ("Show cURL", show_curl),
        ("Clear", lambda: out.delete("1.0", "end")),
    ):
        tk.Button(side, text=label, bg="#333", fg="#ddd", command=cmd,
                  font=("Segoe UI", 9), width=13, relief="flat",
                  cursor="hand2").pack(pady=1)

    out.pack(fill="both", expand=True, padx=10, pady=(0, 10))
    log(f"{BASE}   zone={ZONE}")
    log("1. Provision  (once — creates the sessions the buttons drive)")
    log("2. ALERT      -> announce x%d + infinite silent hold, RED strobe" % ANNOUNCE_TIMES)
    log("3. ALL CLEAR  -> stop hold (strobe dies) + all-clear, GREEN")
    log("4. WALK TEST  -> toggle: loop audible tone + own colour on every speaker (LOW prio)")
    log("\nNOTE: a C1004-E has no light. Nothing flashes until a D4200-VE is on the zone.")
    root.mainloop()


if __name__ == "__main__":
    cmd = sys.argv[1].lower() if len(sys.argv) > 1 else "gui"
    if cmd == "provision":
        provision()
    elif cmd == "alert":
        run(alert())
    elif cmd == "allclear":
        run(allclear())
    elif cmd == "walktest":
        run(walktest_start())
    elif cmd == "walkstop":
        run(walktest_stop())
    elif cmd == "status":
        status_report()
    elif cmd == "discover":
        discover()
    elif cmd == "curl":
        for label, fn in (("ALERT", alert), ("ALL CLEAR", allclear),
                          ("WALK TEST start", walktest_start),
                          ("WALK TEST stop", walktest_stop)):
            print(f"\n=== {label} button ===")
            for i, (m, p, b) in enumerate(fn(), 1):
                print(f"\n-- rule {i}")
                print(as_curl(m, p, b))
    else:
        gui()
