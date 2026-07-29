/* =====================================================================
   NAMES  —  "build() says no match for a bunch of things"

   Paste this AFTER amp-console.js + amp.login() + amp.discover().
   It reads what is actually on the box and writes the build() call FOR
   you, with the real names already quoted in it. Nothing to retype and
   nothing to spell right.

   Run it, read the block it prints, fix any <<PICK ONE>> slots by
   copying a name out of the list above it, then run that block.

   Read-only. It only looks at what discover() already fetched.
   ===================================================================== */

var ampNames = async function () {
  if (typeof amp === 'undefined') {
    console.error('%cPaste amp-console.js first, then amp.login(user,pass).', 'color:#c00;font-weight:bold;font-size:14px');
    return;
  }
  var d = amp._last;
  if (!d) { console.log('No discover() data yet — running it now...'); d = await amp.discover(); }
  if (!d) { console.error('discover() failed — check the login.'); return; }

  var nm = function (x) { return String(x && (x.niceName || x.name || x.id) || ''); };
  var listOf = function (arr) { return (arr || []).map(nm).filter(Boolean); };

  var audio = listOf(d.audioFiles);
  var colours = listOf(d.visualProfiles);
  var targets = listOf(d.targets);

  var show = function (title, arr) {
    console.log('%c' + title + '  (' + arr.length + ')', 'font-weight:bold;font-size:13px');
    if (!arr.length) { console.log('   (none — that is a problem, it should not be empty)'); return; }
    arr.forEach(function (n, i) { console.log('   ' + String(i + 1).padStart(2) + '. ' + n); });
    console.log('');
  };

  console.log('%c\n=== WHAT IS ACTUALLY ON THIS BOX ===\n', 'font-weight:bold;font-size:14px');
  show('AUDIO FILES', audio);
  show('COLOURS (visual profiles)', colours);
  show('TARGETS (zones + speakers)', targets);

  // best-guess match: first name containing any of the keywords.
  // `avoid` kills false friends — the white-noise zone is named "All Zones White Noise",
  // which otherwise wins the site slot and quietly aims every emergency at the noise bed.
  var missed = [];
  var guess = function (arr, slot, words, avoid) {
    var ok = arr.filter(function (n) {
      return !(avoid || []).some(function (a) { return n.toLowerCase().indexOf(a) !== -1; });
    });
    for (var i = 0; i < words.length; i++) {
      var hit = ok.find(function (n) { return n.toLowerCase().indexOf(words[i]) !== -1; });
      if (hit) return hit;
    }
    missed.push(slot);
    return '<<PICK ONE>>';
  };
  var guessAll = function (arr, words, avoid) {
    return arr.filter(function (n) {
      if ((avoid || []).some(function (a) { return n.toLowerCase().indexOf(a) !== -1; })) return false;
      return words.some(function (w) { return n.toLowerCase().indexOf(w) !== -1; });
    });
  };
  var q = function (s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; };

  var C = {
    fire:      guess(colours, 'colours.fire',      ['red', 'fire']),
    wv:        guess(colours, 'colours.wv',        ['purple', 'violet', 'workplace', 'security', 'wv']),
    tornado:   guess(colours, 'colours.tornado',   ['amber', 'orange', 'yellow', 'tornado']),
    lightning: guess(colours, 'colours.lightning', ['blue', 'lightning', 'storm']),
    allclear:  guess(colours, 'colours.allclear',  ['green', 'clear', 'normal']),
  };
  var A = {
    fire:      guess(audio, 'audio.fire',      ['fire']),
    wv:        guess(audio, 'audio.wv',        ['workplace', 'violence', 'security', 'wv', 'lockdown']),
    tornado:   guess(audio, 'audio.tornado',   ['tornado']),
    lightning: guess(audio, 'audio.lightning', ['lightning', 'storm'], ['clear']),
    allclear:  guess(audio, 'audio.allclear',  ['all clear', 'all-clear', 'allclear', 'clear'], ['lightning']),
    // 'test-test-test' first: a site usually has several files with "test" in the name,
    // and the walk-test one is the repeated-word recording, not "Test announcement"
    test:      guess(audio, 'audio.test',      ['test-test', 'test test', 'test']),
  };
  // optional: a site may have its own lightning all-clear recording
  var lclr = guessAll(audio, ['lightning']).filter(function (n) { return /clear/i.test(n); })[0] || '';

  // 'noise' is excluded on purpose — see guess() above
  var NOISE = ['noise'];
  var Z = { site: guess(targets, 'zones.site', ['all zones', 'site', 'building', 'everywhere', 'all'], NOISE) };
  var siteAlts = guessAll(targets, ['all zones', 'all ', 'site', 'building'], NOISE);
  // "Hanger" is misspelled on real sites often enough to be worth matching both ways
  var hangar = guessAll(targets, ['hangar', 'hanger']);
  if (!hangar.length) { hangar = ['<<PICK ONE>>']; missed.push('zones.hangar'); }
  var lobby = guessAll(targets, ['lobby']);
  if (!lobby.length) { lobby = ['<<PICK ONE>>']; missed.push('zones.lobby'); }

  var sil60 = guess(audio, 'silence-60', ['silence-60', 'silence 60', 'silence60']);
  var sil30 = guess(audio, 'silence-30', ['silence-30', 'silence 30', 'silence30']);

  var out =
    'await amp.build({\n' +
    '  colours:{fire:' + q(C.fire) + ', wv:' + q(C.wv) + ', tornado:' + q(C.tornado) + ',\n' +
    '           lightning:' + q(C.lightning) + ', allclear:' + q(C.allclear) + '},\n' +
    '  zones:{site:[' + q(Z.site) + '],\n' +
    '         hangar:[' + hangar.map(q).join(', ') + '],\n' +
    '         lobby:[' + lobby.map(q).join(', ') + ']},\n' +
    '  audio:{fire:' + q(A.fire) + ', wv:' + q(A.wv) + ', tornado:' + q(A.tornado) + ',\n' +
    '         lightning:' + q(A.lightning) + ', allclear:' + q(A.allclear) + ', test:' + q(A.test) + ',\n' +
    (lclr ? '         lightningAllclear:' + q(lclr) + ',\n' : '') +
    '         silence60:' + q(sil60) + ', silence30:' + q(sil30) + '},\n' +
    '})';

  console.log('%c=== YOUR build() CALL — the names are the real ones off this box ===', 'font-weight:bold;font-size:14px;color:#0a0');
  console.log(out);

  console.log('%c\nCHECK zones.site BEFORE YOU PROVISION.\n' +
    'That one target is the entire reach of a fire or tornado announcement. Guessing it is the\n' +
    'one thing this script cannot do safely — a name like "All Zones White Noise" reads as\n' +
    'site-wide and is actually just the noise bed, and nothing downstream will tell you.\n' +
    'Targets here that could plausibly be it: ' + (siteAlts.length ? siteAlts.join('  |  ') : '(none obvious — pick by hand)'),
    'color:#c60;font-weight:bold;font-size:13px');
  if (lclr) console.log('%cFound a dedicated lightning all-clear recording (' + lclr + ') — wired it to button 10.', 'color:#0a0');

  if (missed.length) {
    console.log('%c\n' + missed.length + ' slot(s) it could not guess: ' + missed.join(', ') +
      '\nEach one is a <<PICK ONE>> above. Replace it with a name from the matching list —\n' +
      'colours from COLOURS, audio from AUDIO FILES, zones from TARGETS. If the right file or\n' +
      'profile genuinely is not on the box yet, that is the real problem, not the spelling.',
      'color:#c60;font-weight:bold;font-size:13px');
  } else {
    console.log('%c\nEverything matched. Check the block reads right, then run it.', 'color:#0a0;font-weight:bold;font-size:13px');
  }

  if (audio.indexOf(sil60) === -1) {
    console.log('%c\nNote: no silence-60 file found. The strobe hold needs it — that is the silent loop\n' +
      'that keeps the lights flashing after the announcement ends. Drop silence-60s.wav into the\n' +
      'Announcements folder (AMP indexes it automatically) and re-run discover().',
      'color:#c60;font-weight:bold');
  }

  if (typeof amp.download === 'function') amp.download('build-call.txt', out);
  return out;
};

if (typeof window !== 'undefined') window.ampNames = ampNames;
if (typeof module !== 'undefined') module.exports = { ampNames: ampNames };

ampNames();
