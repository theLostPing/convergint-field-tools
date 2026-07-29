/* =====================================================================
   AMP API PROBE  —  "which API does this box actually have?"

   RUN THIS FIRST, before amp-console.js, whenever the API looks absent.

   WHY IT EXISTS: amp.diagnose() sends your credentials, so a missing
   route and a rejected login can look the same. This probe sends NO
   credentials at all, which makes the answer unambiguous:

       a route that EXISTS  ->  401 + a WWW-Authenticate: Digest header
       a route that DOESN'T ->  404

   So a wall of 401s here is GOOD NEWS: the API is there and it is only
   your login that is wrong. 404 everywhere on /api/v1.2/ is the real
   thing — an older box that never had v1.2.

   HOW TO USE
     1. Open the AAM Pro dashboard in the browser ON THE AMP SERVER.
     2. F12 -> Console -> paste this whole file -> Enter.
     3. Read the table and the VERDICT line underneath it.
     4. Re-run any time with:  await ampProbe()

   Nothing here changes anything on the server. It is read-only: every
   request is a GET, and none of them are authenticated.
   ===================================================================== */

var ampProbe = async function () {
  var PATHS = [
    ['v1.2', '/api/v1.2/audioFiles'],
    ['v1.2', '/api/v1.2/audioSessions'],
    ['v1.2', '/api/v1.2/visualProfiles'],
    ['v1.2', '/api/v1.2/targets'],
    ['v1.1', '/api/v1.1/audioFiles'],
    ['v1.1', '/api/v1.1/audioSessions'],
    ['v1.0', '/api/v1.0/audioFiles'],
    ['v1',   '/api/v1/audioFiles'],
    ['webapi', '/webapi/v1/libraries'],
    ['webapi', '/webapi/v1/devices'],
    ['info', '/api/v1.2/system'],
    ['info', '/webapi/v1/system'],
    ['info', '/webapi/v1/version'],
  ];

  console.log('%cAMP API PROBE — no credentials sent, read-only.', 'font-weight:bold;font-size:13px');
  console.log('Origin under test:', (typeof location !== 'undefined' ? location.origin : '(not a browser)'));
  console.log('If that origin is not the AMP server itself, stop and open the AMP dashboard first.\n');

  var rows = [];
  for (var i = 0; i < PATHS.length; i++) {
    var family = PATHS[i][0], path = PATHS[i][1];
    var status = '', authHdr = '', ctype = '', body = '', verdict = '';

    try {
      var r = await fetch(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',      // do NOT ride the dashboard session cookie
        redirect: 'manual',       // show a redirect as a redirect instead of following it
        cache: 'no-store',
      });

      if (r.type === 'opaqueredirect') {
        status = '(redirect)';
        verdict = 'REDIRECTED — something is in front of AMP, or auth portal';
      } else {
        status = r.status;
        authHdr = r.headers.get('www-authenticate') || '';
        ctype = r.headers.get('content-type') || '';
        try { body = (await r.text()).slice(0, 120).replace(/\s+/g, ' '); } catch (e) { body = ''; }

        if (status === 401) {
          verdict = authHdr ? 'EXISTS (wants digest auth)' : 'EXISTS (auth required)';
        } else if (status === 404) {
          verdict = 'NOT PRESENT';
        } else if (status === 200) {
          verdict = /html/i.test(ctype) ? 'HTML page, not the API' : 'EXISTS + open (200)';
        } else if (status === 406) {
          verdict = 'EXISTS (JSON-only, content negotiation)';
        } else if (status === 403) {
          verdict = 'EXISTS but forbidden — API may be switched OFF in the GUI';
        } else if (status === 501 || status === 503) {
          verdict = 'EXISTS but not enabled/available';
        } else {
          verdict = 'other';
        }

        if (/public api is disabled/i.test(body)) {
          verdict = 'API IS SWITCHED OFF in the AMP GUI (Settings -> API)';
        }
      }
    } catch (e) {
      status = 'ERR';
      verdict = 'request failed: ' + e.message;
    }

    rows.push({ family: family, path: path, status: status, verdict: verdict, 'www-authenticate': authHdr, body: body });
  }

  console.table(rows.map(function (x) {
    return { family: x.family, path: x.path, status: x.status, verdict: x.verdict };
  }));

  // ---- work out what it all means ----
  var present = function (fam) {
    return rows.some(function (x) {
      return x.family === fam && /^EXISTS/.test(x.verdict);
    });
  };
  var disabled = rows.some(function (x) { return /SWITCHED OFF/.test(x.verdict); });
  var allRedirect = rows.every(function (x) { return /REDIRECTED/.test(x.verdict); });
  var nothing = rows.every(function (x) { return x.verdict === 'NOT PRESENT' || x.status === 'ERR'; });

  var v12 = present('v1.2'), v11 = present('v1.1'), older = present('v1.0') || present('v1'), web = present('webapi');

  var msg, colour;
  if (disabled) {
    msg = 'THE PUBLIC API IS SWITCHED OFF, not missing.\n' +
          'Turn it on in the AMP GUI: Settings -> API / Integrations, then re-run this probe.\n' +
          'This looks identical to "v1.2 does not exist" from the outside — it is not.';
    colour = '#c60';
  } else if (v12) {
    msg = 'v1.2 IS PRESENT on this box.\n' +
          'The routes answered, they just want credentials. So the earlier "not available" was an\n' +
          'AUTH problem, not a version problem. Check the API user: it is a user created INSIDE AMP\n' +
          '(Settings -> API / Integrations), not a Windows account — and the SITE password is not the\n' +
          'bench password. Then: paste amp-console.js, amp.login(user, pass), await amp.diagnose().';
    colour = '#0a0';
  } else if (!v12 && (v11 || older || web)) {
    msg = 'CONFIRMED: this box has NO /api/v1.2 — it is the older API only.\n' +
          'That is a real blocker, not a login problem. What is live is shown in the table above.\n' +
          'Next: run version.ps1 (or version.cmd) on this server and send both results back.\n' +
          'The old API has no stop call, which is what All Clear depends on — so the fix is either\n' +
          'upgrading AMP, or moving the strobe hold off AMP onto the devices directly.';
    colour = '#c00';
  } else if (allRedirect) {
    msg = 'Everything redirected. There is a proxy or a login portal in front of AMP, so nothing here\n' +
          'reached the API. Confirm you are on the AMP server itself and hitting its own address.';
    colour = '#c60';
  } else if (nothing) {
    msg = 'Nothing answered at all. Either this is not the AMP host, or AMP is on a different port.\n' +
          'Check the address bar — the probe tests whatever origin this page is on.';
    colour = '#c60';
  } else {
    msg = 'Mixed result — no clean read. Send the whole table back (right-click the table -> Save as,\n' +
          'or screenshot it) along with the version.ps1 output.';
    colour = '#c60';
  }

  console.log('%c\nVERDICT\n' + msg, 'color:' + colour + ';font-weight:bold;font-size:13px');
  console.log('\nFull detail (headers + response snippets):');
  console.table(rows);
  return rows;
};

if (typeof window !== 'undefined') window.ampProbe = ampProbe;
if (typeof module !== 'undefined') module.exports = { ampProbe: ampProbe };

// run it immediately on paste
ampProbe();
