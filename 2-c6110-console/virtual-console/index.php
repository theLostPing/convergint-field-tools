<?php
// Virtual paging console — fires the exact rule sets the physical console's buttons fire.
// Copy config.example.json to config.json and fill it in; everything is config-driven.
$cfgPath = __DIR__ . '/config.json';
if (!is_file($cfgPath)) {
    http_response_code(500);
    exit('<h1>No config.json</h1><p>Copy <code>config.example.json</code> to <code>config.json</code> beside this file and fill in your server, API user and button map (build the map from <code>amp.rules()</code> output).</p>');
}
$cfg   = json_decode(file_get_contents($cfgPath), true);
$title = $cfg['title'] ?? 'Virtual Paging Console';
$keys  = (int)($cfg['keys'] ?? 12);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($title) ?></title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<meta name="theme-color" content="#1a1d24">
<style>
:root { --bg:#1a1d24; --panel:#242832; --edge:#3a4150; --txt:#e8eaf0; --dim:#8a93a5; }
* { box-sizing:border-box; margin:0; }
body { background:var(--bg); color:var(--txt); font:16px/1.4 system-ui,Segoe UI,sans-serif; min-height:100vh; padding:18px; }
.wrap { max-width:760px; margin:0 auto; }
header { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
header img { width:40px; height:40px; }
h1 { font-size:1.15rem; font-weight:600; }
.sub { color:var(--dim); font-size:.82rem; }
#dot { display:inline-block; width:9px; height:9px; border-radius:50%; background:#666; margin-right:5px; }
#dot.on { background:#3ddc84; box-shadow:0 0 6px #3ddc84; }
#dot.off { background:#e2483d; }
.console { background:var(--panel); border:1px solid var(--edge); border-radius:14px; padding:16px; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
button.key { position:relative; border:1px solid var(--edge); border-radius:10px; padding:18px 8px 14px;
  background:#2c3140; color:var(--txt); font:inherit; font-weight:600; font-size:.95rem; cursor:pointer;
  min-height:86px; transition:transform .05s, filter .15s; }
button.key:active { transform:scale(.96); filter:brightness(1.25); }
button.key .n { position:absolute; top:6px; left:9px; font-size:.7rem; color:var(--dim); font-weight:400; }
button.key.fire      { background:#7a1f1c; border-color:#a33; }
button.key.tornado   { background:#7a6414; border-color:#b99b23; }
button.key.lightning { background:#1d3f78; border-color:#3a6ec2; }
button.key.wv        { background:#77321a; border-color:#b45c2e; }
button.key.clear     { background:#1e5c33; border-color:#2f9152; }
button.key.test      { background:#33414f; border-color:#4d6377; }
div.key.blank { border:1px dashed var(--edge); border-radius:10px; min-height:86px; opacity:.35;
  display:flex; align-items:center; justify-content:center; color:var(--dim); }
#log { background:#12141a; border:1px solid var(--edge); border-radius:10px; margin-top:14px;
  padding:10px 12px; font:13px/1.6 ui-monospace,Consolas,monospace; height:180px; overflow-y:auto; }
#log .ok { color:#3ddc84; } #log .bad { color:#ff6b5e; } #log .t { color:var(--dim); }
.foot { color:var(--dim); font-size:.75rem; margin-top:10px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <img src="favicon.svg" alt="">
    <div>
      <h1><?= htmlspecialchars($title) ?></h1>
      <div class="sub"><span id="dot"></span><span id="srv">checking <?= htmlspecialchars($cfg['server']) ?>…</span></div>
    </div>
  </header>

  <div class="console">
    <div class="grid" id="grid"></div>
    <div id="log"><span class="t">Press a button — it fires the exact rule set the real console button fires.</span></div>
  </div>
  <div class="foot">Every press POSTs the same /api/v1.2 calls the physical console sends.</div>
</div>

<script>
const BUTTONS = <?= json_encode($cfg['buttons']) ?>;
const KEYS = <?= $keys ?>;
const grid = document.getElementById('grid');
const log = document.getElementById('log');
function say(html) { const d = document.createElement('div'); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; }

for (let i = 1; i <= KEYS; i++) {
  const b = BUTTONS[String(i)];
  if (!b) { const d = document.createElement('div'); d.className = 'key blank'; d.textContent = i; grid.appendChild(d); continue; }
  const el = document.createElement('button');
  el.className = 'key ' + b.class;
  el.innerHTML = '<span class="n">' + i + '</span>' + b.name;
  el.onclick = async () => {
    el.disabled = true;
    say('<span class="t">[' + new Date().toLocaleTimeString() + ']</span> PRESS ' + i + ' — ' + b.name);
    try {
      const r = await fetch('api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'press', button: String(i) }) });
      const j = await r.json();
      for (const res of (j.results || []))
        say('&nbsp;&nbsp;' + res.rule + ' → <span class="' + (res.code === 200 ? 'ok' : 'bad') + '">' + res.code + '</span>');
    } catch (e) { say('&nbsp;&nbsp;<span class="bad">request failed: ' + e + '</span>'); }
    el.disabled = false;
  };
  grid.appendChild(el);
}

(async () => {
  const dot = document.getElementById('dot'), srv = document.getElementById('srv');
  try {
    const j = await (await fetch('api.php?action=status')).json();
    dot.className = j.online ? 'on' : 'off';
    srv.textContent = j.server + (j.online ? ' — online, ' + j.sessions.length + ' sessions armed' : ' — UNREACHABLE');
  } catch (e) { dot.className = 'off'; srv.textContent = 'status check failed'; }
})();
</script>
</body>
</html>
