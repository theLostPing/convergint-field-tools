/* =====================================================================
   TAKE-HOME DUMP  —  grab everything off the AMP box in one file.

   For when you have to leave site and keep working. Sweeps every
   read-only endpoint the server answers, and writes ONE file you can
   carry home on a stick or mail to yourself.

   Paste AFTER amp-console.js + amp.login(). Read-only: GETs only,
   nothing is created, changed or deleted.

   It does NOT write your password into the file. Names, IDs, zones and
   device info, yes — that is customer config, so treat the file the way
   you would treat their drawings.
   ===================================================================== */

var ampTakeHome = async function (label) {
  if (typeof amp === 'undefined') {
    console.error('%cPaste amp-console.js first, then amp.login(user,pass).', 'color:#c00;font-weight:bold;font-size:14px');
    return;
  }

  // Everything worth having. Unknown ones are harmless — they just 404.
  var ENDPOINTS = [
    'audioFiles', 'visualProfiles', 'targets', 'audioSessions',
    'devices', 'sinks', 'sources', 'zones', 'sites', 'groups',
    'libraries', 'schedules', 'announcements', 'paging', 'users',
  ];

  var dump = { collectedFrom: (typeof location !== 'undefined' ? location.origin : ''), label: label || '', endpoints: {}, missing: [] };

  console.log('%cSweeping the box — read-only...', 'font-weight:bold;font-size:13px');
  for (var i = 0; i < ENDPOINTS.length; i++) {
    var ep = ENDPOINTS[i];
    try {
      var r = await api('GET', ep);
      if (r.status === 200) {
        dump.endpoints[ep] = r.data;
        var n = Array.isArray(r.data) ? r.data.length : 1;
        console.log('   ✓ ' + ep + '  (' + n + ')');
      } else {
        dump.missing.push(ep + ' -> ' + r.status);
      }
    } catch (e) {
      dump.missing.push(ep + ' -> ' + e.message);
    }
  }

  // whatever the other tools have already worked out this session
  try { if (typeof SESSIONS !== 'undefined' && SESSIONS.length) dump.plannedSessions = SESSIONS; } catch (e) {}
  try { if (typeof BUTTONS !== 'undefined' && BUTTONS.length) dump.plannedButtons = BUTTONS; } catch (e) {}

  // a human-readable header so the file is useful even without a tool
  var nm = function (x) { return String(x && (x.niceName || x.name || x.id) || ''); };
  var lines = [];
  lines.push('AMP SITE DUMP');
  lines.push('from     : ' + dump.collectedFrom);
  if (label) lines.push('label    : ' + label);
  lines.push('');
  ['audioFiles', 'visualProfiles', 'targets', 'audioSessions'].forEach(function (k) {
    var arr = dump.endpoints[k];
    if (!Array.isArray(arr)) return;
    lines.push(k.toUpperCase() + '  (' + arr.length + ')');
    arr.forEach(function (x) {
      lines.push('   ' + String(x.id !== undefined ? x.id : '?').padStart(6) + '  ' + (nm(x) || JSON.stringify(x).slice(0, 80)));
    });
    lines.push('');
  });
  if (dump.missing.length) {
    lines.push('NOT AVAILABLE ON THIS BOX: ' + dump.missing.join(', '));
    lines.push('');
  }

  var text = lines.join('\n') + '\n\n===== FULL JSON BELOW =====\n\n' + JSON.stringify(dump, null, 2);

  console.log(lines.join('\n'));
  console.log('%c\nDownloaded amp-site-dump.txt — that one file is everything.\n' +
    'Carry it home, and it is enough to finish the build offline.',
    'color:#0a0;font-weight:bold;font-size:13px');

  amp.download('amp-site-dump.txt', text);
  return dump;
};

if (typeof window !== 'undefined') window.ampTakeHome = ampTakeHome;
if (typeof module !== 'undefined') module.exports = { ampTakeHome: ampTakeHome };

ampTakeHome();
