<?php
// Virtual console backend: replays a console button's rule list against the AMP server.
// Each rule is one digest-auth POST to /api/v1.2 — byte-for-byte what the real console sends.
// The PHP proxy exists because a browser page on another origin cannot digest-POST to AMP
// directly (CORS); the server-side curl call has no such restriction.
header('Content-Type: application/json');
$cfg = json_decode(@file_get_contents(__DIR__ . '/config.json'), true);
if (!$cfg) { http_response_code(500); exit(json_encode(['error' => 'config.json missing — copy config.example.json and fill it in'])); }

function amp_post($cfg, $path, $body) {
    $ch = curl_init(rtrim($cfg['server'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_POST => true,
        CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => $cfg['user'] . ':' . $cfg['pass'],
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$code, $resp];
}
function amp_get($cfg, $path) {
    $ch = curl_init(rtrim($cfg['server'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6,
        CURLOPT_HTTPAUTH => CURLAUTH_DIGEST,
        CURLOPT_USERPWD => $cfg['user'] . ':' . $cfg['pass'],
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$code, $resp];
}

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $in['action'] ?? ($_GET['action'] ?? '');

if ($action === 'status') {
    [$fc, $files] = amp_get($cfg, '/api/v1.2/audioFiles');
    [$sc, $sess]  = amp_get($cfg, '/api/v1.2/audioSessions');
    exit(json_encode([
        'server'   => $cfg['server'],
        'online'   => $fc === 200,
        'sessions' => $sc === 200 ? array_map(function ($s) { return $s['customId'] ?? $s['id']; }, json_decode($sess, true) ?: []) : [],
    ]));
}

if ($action === 'press') {
    $btn = (string)($in['button'] ?? '');
    if (!isset($cfg['buttons'][$btn])) { http_response_code(400); exit(json_encode(['error' => 'no such button'])); }
    $out = [];
    foreach ($cfg['buttons'][$btn]['rules'] as $r) {
        if (isset($r['stop'])) {
            [$code] = amp_post($cfg, '/api/v1.2/audioSessions/custom/' . $r['stop'] . '/stopAudioFiles', '{}');
            $out[] = ['rule' => 'stop ' . $r['stop'], 'code' => $code];
        } else {
            $body = json_encode(['fileIds' => $r['fileIds'], 'repeat' => $r['repeat']]);
            [$code] = amp_post($cfg, '/api/v1.2/audioSessions/custom/' . $r['play'] . '/playAudioFiles', $body);
            $out[] = ['rule' => 'play ' . $r['play'] . ' x' . $r['repeat'], 'code' => $code];
        }
    }
    exit(json_encode(['button' => $btn, 'name' => $cfg['buttons'][$btn]['name'], 'results' => $out]));
}

http_response_code(400);
echo json_encode(['error' => 'unknown action']);
