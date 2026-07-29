/* =====================================================================
   AMP PANEL — a real UI over the AAM Pro dashboard. No typing JavaScript.

   WHY: the browser console is a bad place to work in a server closet —
   tiny text, collapsed objects, and every page navigation wipes it. This
   draws buttons on top of the dashboard instead. It runs inside the page
   for the same reason amp-console.js does: same origin, so the API works.

   HOW TO USE (once):
     F12 -> Sources -> Snippets -> New snippet -> paste amp-console.js,
     then paste THIS file underneath it in the same snippet -> Ctrl+S.
     From then on: Ctrl+Enter and the panel is back, even after the page
     reloads. Nothing to re-paste.

   Everything is large and high contrast on purpose. Drag it by the header.
   ===================================================================== */

(function () {
  if (typeof amp === 'undefined') {
    alert('Paste amp-console.js FIRST (or put it above this in the same snippet), then run this.');
    return;
  }
  var old = document.getElementById('amp-panel');
  if (old) old.remove();

  // ---- the build call, pre-filled with example names ----
  // These are the shapes you will see on a typical site. Replace every value with a name
  // from discover() before provisioning — build() matches BY NAME, so a name that isn't on
  // the server resolves to nothing and warns.
  var DEFAULT_BUILD = {
    colours: { fire: 'Fire Announcement', wv: 'Security Incident Announcement', tornado: 'Tornado Announcement',
               lightning: 'Lightning Announcement', allclear: 'All Clear Announcement' },
    zones: { site: ['All zones'],
             hangar: ['Outdoor Zone'],
             lobby: ['Lobby Test Announcements'] },
    audio: { fire: 'fire announcement.mp3', wv: 'workplace_violence.mp3', tornado: 'tornado announcement.mp3',
             lightning: 'lightning within 5.mp3', allclear: 'all clear announcement.mp3', test: 'test-test-test.mp3',
             lightningAllclear: 'lightning-allclear.mp3', silence60: 'silence-60s.wav', silence30: 'silence-30s.mp3' },
  };

  var CSS = `
  #amp-panel{position:fixed;top:16px;right:16px;width:560px;max-height:92vh;z-index:2147483647;
    display:flex;flex-direction:column;border-radius:14px;overflow:hidden;
    background:#0f172a;color:#f8fafc;box-shadow:0 18px 50px rgba(0,0,0,.55);
    font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:18px;line-height:1.5;}
  #amp-panel *{box-sizing:border-box;}
  #amp-panel header{display:flex;align-items:center;gap:12px;padding:14px 18px;background:#1e293b;cursor:move;}
  #amp-panel header b{font-size:20px;letter-spacing:.3px;}
  #amp-panel .dot{width:14px;height:14px;border-radius:50%;background:#64748b;flex:none;}
  #amp-panel .dot.ok{background:#22c55e;} #amp-panel .dot.bad{background:#ef4444;}
  #amp-panel .body{padding:16px 18px;overflow:auto;}
  #amp-panel .step{border-top:1px solid #334155;padding:16px 0 6px;}
  #amp-panel .step:first-child{border-top:none;padding-top:4px;}
  #amp-panel h3{margin:0 0 10px;font-size:20px;color:#93c5fd;}
  #amp-panel button{font-size:18px;font-weight:600;padding:12px 18px;margin:0 8px 8px 0;
    border:none;border-radius:9px;background:#2563eb;color:#fff;cursor:pointer;}
  #amp-panel button:hover{background:#1d4ed8;}
  #amp-panel button.ghost{background:#334155;} #amp-panel button.ghost:hover{background:#475569;}
  #amp-panel button.warn{background:#b45309;} #amp-panel button.warn:hover{background:#92400e;}
  #amp-panel button:disabled{opacity:.45;cursor:not-allowed;}
  #amp-panel input,#amp-panel textarea{font-size:18px;padding:11px 13px;border-radius:9px;
    border:1px solid #475569;background:#1e293b;color:#f8fafc;width:100%;margin-bottom:10px;
    font-family:inherit;}
  #amp-panel textarea{font-family:ui-monospace,Consolas,monospace;font-size:15px;min-height:150px;white-space:pre;}
  #amp-panel .row{display:flex;gap:10px;}
  #amp-panel .note{background:#422006;border-left:5px solid #f59e0b;padding:12px 14px;
    border-radius:8px;margin:10px 0;font-size:16px;color:#fde68a;}
  /* results sit OUTSIDE the scrolling body so they are always on screen —
     in a server closet you should never have to scroll to find out what happened */
  #amp-panel .out{background:#020617;border-top:2px solid #334155;padding:12px 18px;
    font-family:ui-monospace,Consolas,monospace;font-size:16px;white-space:pre-wrap;
    height:230px;overflow:auto;flex:none;}
  #amp-panel .out .g{color:#4ade80;} #amp-panel .out .r{color:#f87171;} #amp-panel .out .y{color:#fbbf24;}
  #amp-panel .mini{font-size:15px;color:#94a3b8;margin:4px 0 10px;}
  `;

  var el = function (tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  };

  var style = el('style'); style.textContent = CSS; document.head.appendChild(style);

  var panel = el('div', { id: 'amp-panel' });
  panel.innerHTML = `
   <header>
     <span class="dot" id="ap-dot"></span>
     <b>AMP Console</b>
     <span style="flex:1"></span>
     <button class="ghost" id="ap-min" style="padding:6px 14px;margin:0">–</button>
     <button class="ghost" id="ap-close" style="padding:6px 14px;margin:0">✕</button>
   </header>
   <div class="body" id="ap-body">

     <div class="step">
       <h3>1 · Connect</h3>
       <div class="mini">The API Access user — not the dashboard login.</div>
       <div class="row"><input id="ap-user" placeholder="user" value="Convergint">
                        <input id="ap-pass" placeholder="password" type="text" value=""></div>
       <button id="ap-connect">Connect &amp; read the box</button>
       <button class="ghost" id="ap-diag">Which API is live?</button>
     </div>

     <div class="step">
       <h3>2 · Build</h3>
       <div class="mini">Names resolve to IDs. Nothing is sent to the server yet.</div>
       <textarea id="ap-build"></textarea>
       <button id="ap-dobuild">Build the 11 sessions</button>
     </div>

     <div class="step">
       <h3>3 · Provision</h3>
       <div class="mini">Creates the sessions. Silent — nothing plays.</div>
       <button id="ap-provision">Provision</button>
       <button class="ghost" id="ap-verify">Verify on server</button>
     </div>

     <div class="note">
       <b>Before wiring 21 rules —</b> a higher priority KILLS a lower one, it does not duck it.
       Every button except Fire fires announce + hold together, so the hold may die and the
       strobe go dark. Run the MDF test below FIRST. Strobe still flashing after the voice
       ends = design confirmed. Dark = switch to one session per emergency.
     </div>

     <div class="step">
       <h3>4 · MDF test <span style="font-size:15px;color:#94a3b8">(zon_12, real D4200)</span></h3>
       <button class="warn" id="ap-mdf">Run the deciding test</button>
       <button class="ghost" id="ap-mdfstop">Stop + clean up</button>
     </div>

     <div class="step">
       <h3>5 · Button sheet</h3>
       <button id="ap-rules">Print the 21 rules</button>
     </div>

   </div>
   <div class="out" id="ap-out">Ready.</div>`;
  document.body.appendChild(panel);

  var $ = function (id) { return document.getElementById(id); };
  $('ap-build').value = 'await amp.build(' + JSON.stringify(DEFAULT_BUILD, null, 2) + ')';

  var out = $('ap-out');
  var say = function (msg, cls) {
    var line = el('div', cls ? { class: cls } : null);
    line.textContent = msg;
    out.appendChild(line); out.scrollTop = out.scrollHeight;
  };
  var clear = function () { out.textContent = ''; };
  var dot = function (state) { $('ap-dot').className = 'dot' + (state ? ' ' + state : ''); };

  // capture console output from the underlying tool so it lands in the panel
  var wrap = async function (fn) {
    var realLog = console.log, realWarn = console.warn, realErr = console.error;
    var strip = function (a) { return a.filter(function (x) { return typeof x !== 'string' || x.indexOf('color:') !== 0 && x.indexOf('font-') !== 0; })
      .map(function (x) { return typeof x === 'string' ? x.replace(/%c/g, '') : JSON.stringify(x); }).join(' '); };
    console.log = function () { say(strip([].slice.call(arguments))); };
    console.warn = function () { say(strip([].slice.call(arguments)), 'y'); };
    console.error = function () { say(strip([].slice.call(arguments)), 'r'); };
    try { return await fn(); }
    catch (e) { say('ERROR: ' + e.message, 'r'); }
    finally { console.log = realLog; console.warn = realWarn; console.error = realErr; }
  };

  $('ap-connect').onclick = function () {
    clear();
    amp.login($('ap-user').value.trim(), $('ap-pass').value);
    say('connecting as ' + $('ap-user').value.trim() + ' …');
    wrap(async function () {
      var d = await amp.discover();
      if (!d) { dot('bad'); say('Could not read the box. Wrong API user, or the API is off.', 'r'); return; }
      dot('ok');
      say('CONNECTED', 'g');
      say(d.audioFiles.length + ' audio files, ' + d.visualProfiles.length + ' colours, ' +
          d.targets.length + ' targets, ' + (d.sessions || []).length + ' sessions already on the box');
    });
  };

  $('ap-diag').onclick = function () { clear(); wrap(function () { return amp.diagnose(); }); };

  $('ap-dobuild').onclick = function () {
    clear();
    var src = $('ap-build').value.trim().replace(/^await\s+/, '');
    wrap(async function () {
      var r = await eval('(' + src.replace(/^amp\.build\(/, '(function(o){return amp.build(o)})(') + ')');
      if (!r) return;
      say('BUILT ' + r.SESSIONS.length + ' sessions, ' + r.BUTTONS.length + ' button rules', 'g');
      r.SESSIONS.forEach(function (s) {
        var bad = s.visualProfileId == null || !s.targets.length || s.targets.some(function (t) { return t == null; });
        say((bad ? '  !! ' : '  ok ') + s.customId + '  ' + s.prio + '  vp=' + s.visualProfileId +
            '  -> ' + s.targets.join(', '), bad ? 'r' : null);
      });
      var site = r.SESSIONS.find(function (s) { return s.customId === 'fire-announce'; });
      if (site && String(site.targets).indexOf('zon_10') !== -1)
        say('STOP — site resolved to zon_10, the WHITE NOISE zone. Fix before provisioning.', 'r');
    });
  };

  $('ap-provision').onclick = function () { clear(); wrap(function () { return amp.provision(); }); };

  $('ap-verify').onclick = function () {
    clear();
    wrap(async function () {
      var s = (await api('GET', 'audioSessions')).data || [];
      say(s.length + ' sessions on the server:', s.length ? 'g' : 'r');
      s.forEach(function (x) { say('  ' + x.customId + '  ' + x.prio + '  -> ' + (x.targets || []).join(', ')); });
    });
  };

  $('ap-mdf').onclick = function () {
    clear();
    wrap(async function () {
      say('Watch the MDF strobe. This is the test that decides the button design.', 'y');
      say('firing tornado-announce (MEDIUM) x2 …');
      say('  -> ' + (await api('POST', 'audioSessions/custom/tornado-announce/playAudioFiles', { fileIds: ['14'], repeat: 2 })).status);
      say('firing tornado-hold (LOW) silence, repeat 0 …');
      say('  -> ' + (await api('POST', 'audioSessions/custom/tornado-hold/playAudioFiles', { fileIds: ['20'], repeat: 0 })).status);
      say('');
      say('Message plays twice (~32s). THEN WATCH:', 'y');
      say('  strobe STILL FLASHING after the voice stops = design confirmed, wire all 21 rules', 'g');
      say('  strobe DARK = the announcement killed the hold, switch to one session per emergency', 'r');
    });
  };

  $('ap-mdfstop').onclick = function () {
    clear();
    wrap(async function () {
      for (var i = 0, ids = ['tornado-announce', 'tornado-hold']; i < ids.length; i++)
        say('stop ' + ids[i] + ' -> ' + (await api('POST', 'audioSessions/custom/' + ids[i] + '/stopAudioFiles', {})).status);
      say('stopped.', 'g');
    });
  };

  $('ap-rules').onclick = function () { clear(); wrap(function () { return amp.rules(); }); };

  $('ap-close').onclick = function () { panel.remove(); };
  $('ap-min').onclick = function () {
    var b = $('ap-body');
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
    $('ap-min').textContent = b.style.display === 'none' ? '+' : '–';
  };

  // drag by the header
  (function () {
    var h = panel.querySelector('header'), down = false, ox = 0, oy = 0;
    h.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      down = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!down) return;
      panel.style.left = (e.clientX - ox) + 'px';
      panel.style.top = (e.clientY - oy) + 'px';
      panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', function () { down = false; });
  })();

  console.log('AMP panel loaded.');
})();
