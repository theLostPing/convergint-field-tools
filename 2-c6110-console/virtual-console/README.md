# Virtual Paging Console

A browser page with the same buttons as the physical paging console, firing the **exact same
`/api/v1.2` calls** at the AMP server. Use it to prove the whole design end-to-end before a
single console rule is entered, to re-test after changes without touching the panel, or as a
bench replica of a site.

![buttons](favicon.svg)

## Why PHP?

A browser page served from anywhere *other than the AMP dashboard itself* cannot POST to AMP
directly — cross-origin digest auth is blocked by CORS. The tiny `api.php` proxy runs the
digest-auth curl call server-side, where no such restriction exists. (If you can paste into
the dashboard's own DevTools instead, you don't need this — use `../amp-console.js` +
`../amp-panel.js`, which run same-origin.)

## Deploy

1. Put this folder on any PHP host (7.4+, php-curl) that can reach the AMP server over HTTPS.
2. `cp config.example.json config.json` and fill it in. `config.json` is git-ignored so real
   credentials never land in the repo.
3. Build the `buttons` map from your site's `amp.rules()` sheet — session names and file IDs
   are **site-specific**; never copy IDs from another install.
4. Open the page. The status dot proves server + credentials; every button press logs each
   rule's HTTP status live.

## Notes

- **Aim it at a test zone first.** The buttons fire whatever the sessions target. Follow the
  commissioning staging in `../COMMISSIONING.md`.
- All Clear buttons **stop** sessions, never delete them — same rule as the real console.
- The page needs no build step, no framework, no external requests: two PHP files, one JSON.
