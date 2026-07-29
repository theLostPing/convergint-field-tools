# bench / legacy — NOT for the customer site

**On the job you use `../amp-console.js` in the browser and `../COMMISSIONING.md`.**
Nothing in this folder is needed on the customer Server. It's here only for home-bench work.

| File | What it is |
|------|-----------|
| `provision.cmd` / `.ps1` | Create the sessions via curl / PowerShell. Work on a **Win11 bench**, **dead on the customer Windows Server** (Schannel TLS). `../amp-console.js` `provision()` replaces them. |
| `test-buttons.cmd` / `.ps1` | Fire/stop sessions to test the server side. Bench-only, same Schannel limit. Use `amp.fire()` / `amp.stop()` in `../amp-console.js` instead. |
| `console_sim.py` | A fake two-button C6110 for testing without the real console. |
| `RESUME-HERE.md` | Old project status note. Superseded by `../COMMISSIONING.md` — kept for history only. |
