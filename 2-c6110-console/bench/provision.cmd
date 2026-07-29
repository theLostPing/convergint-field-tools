@echo off
setlocal
REM ===========================================================================
REM  AMP lockdown provisioning - PLAIN CURL, no Python, no install.
REM
REM  Run ON the AAM Pro server (curl.exe ships with Windows Server 2019+; use
REM  provision.ps1 on Server 2016 / older). Talks ONLY to the local AMP.
REM
REM  Creates the sessions the C6110 buttons play / stop by name:
REM    fire        continuous VOICE (loops until all clear)            = 1
REM    wv/tornado  -announce (HIGH) + -hold (LOW, silent)             = 4
REM    lightning   -announce + -hold   (HANGAR / TARMAC ONLY)         = 2
REM    allclear (site) + lightning-allclear (hangar) + walk-test      = 3
REM    lobby-allclear  (button 5 training - lobby speakers only)      = 1
REM                                                                    ----
REM                                                                     11
REM  wv = workplace violence.
REM
REM  BEHAVIOUR (locked with Brian):
REM   - FIRE talks CONTINUOUSLY until all clear (repeat:0 on the voice).
REM   - wv / tornado / lightning announce x2 then hold a SILENT strobe until clear.
REM   - Nothing auto-stops EXCEPT the monthly walk TEST (test-test-test.mp3 then
REM     30s green flash, looped ~30 min). Everything else runs until all clear.
REM   - LIGHTNING is HANGAR / TARMAC ONLY and has its OWN hangar all-clear.
REM
REM  Run once at commissioning. Sessions survive AMP restarts. Re-running is
REM  safe (it deletes and recreates them).
REM ===========================================================================

REM ---- EDIT THESE (ids from YOUR server: the discovery curls below print them) -
set SERVER=127.0.0.1
set USER=<API_USER>
set PASS=<API_PASSWORD>

REM  TARGETS = where the SITE-WIDE sessions fire (fire / wv / tornado / allclear
REM  / walk-test). OCCUPIED SITE - you cannot live-test. Commission in STAGES;
REM  each stage is just a different TARGETS, re-run, the buttons never change:
REM    1) LOBBY safe-target - the speakers by the console you can stand next to:
REM       set TARGETS=[\"lobby_spk1\",\"lobby_spk2\",\"lobby_spk3\"]
REM    2) a small safe zone-group:   set TARGETS=[\"zon_lobby\"]
REM    3) GO LIVE - all production zones. PROVISION ONLY, do NOT test-fire it:
REM       set TARGETS=[\"sit_1\"]
set TARGETS=[\"sit_1\"]

REM  LIGHTNING IS HANGAR / TARMAC ONLY - its own target, never site-wide, and its
REM  all-clear stays hangar-only too (you can't tell the whole building "all clear"
REM  for a storm only the hangar heard). Hangar zone id(s) from /targets below.
REM  One [\"zon_hangar\"] or several [\"zon_hangar\",\"zon_tarmac\"].
REM  <-- STILL A PLACEHOLDER: fill in on site.
set TARGETS_LIGHTNING=[\"zon_hangar\"]

REM  LOBBY = the ~4 front-lobby speakers for the TRAINING button 5 (lobby all-clear).
REM  NOT a zone - list the individual speaker target ids.  <-- fill in on site.
set TARGETS_LOBBY=[\"lobby_spk1\",\"lobby_spk2\",\"lobby_spk3\",\"lobby_spk4\"]

REM  visual profile id per session (the strobe colour) - from /visualProfiles below.
REM  CLEAR + TEST are both GREEN (test is the monthly walk-test green flash).
set PROFILE_FIRE=0
set PROFILE_WV=0
set PROFILE_TORNADO=0
set PROFILE_LIGHTNING=0
set PROFILE_CLEAR=0
set PROFILE_TEST=0
REM ----------------------------------------------------------------------------

set API=https://%SERVER%/api/v1.2
set AUTH=--digest -u %USER%:%PASS%
set HDR=-H "Content-Type: application/json"

echo.
echo  AMP server : %API%
echo  Site fires : %TARGETS%
echo  Lightning  : %TARGETS_LIGHTNING%  (hangar / tarmac only)
echo  Lobby      : %TARGETS_LOBBY%  (button 5 training only)
echo.
echo  Checking connectivity...
curl -sk %AUTH% -o nul -w "  audioFiles -> HTTP %%{http_code}\n" %API%/audioFiles
echo   (000/timeout = TLS/host wrong; 404 "Public api is disabled" = enable it in the AMP GUI first)
echo.

echo  --- IDs on THIS server (never reuse bench ids) ---
echo.
echo  Audio files:
curl -sk %AUTH% %API%/audioFiles
echo.
echo  Visual profiles:
curl -sk %AUTH% %API%/visualProfiles
echo.
echo  Targets:
curl -sk %AUTH% %API%/targets
echo.
echo  ==========================================================================
echo   If the PROFILE_* values at the top are still 0, close this window, put
echo   the real ids in, and run again.
echo  ==========================================================================
echo.

echo  Clearing any stale sessions (404 here is fine - nothing was armed)...
curl -sk %AUTH% -o nul -w "  del fire               -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/fire-announce
for %%S in (wv tornado lightning) do (
  curl -sk %AUTH% -o nul -w "  del %%S-announce        -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/%%S-announce
  curl -sk %AUTH% -o nul -w "  del %%S-hold            -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/%%S-hold
)
curl -sk %AUTH% -o nul -w "  del allclear           -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/allclear
curl -sk %AUTH% -o nul -w "  del lightning-allclear -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/lightning-allclear
curl -sk %AUTH% -o nul -w "  del walk-test          -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/walk-test
curl -sk %AUTH% -o nul -w "  del lobby-allclear     -> %%{http_code}\n" -X DELETE %API%/audioSessions/custom/lobby-allclear
echo.

echo  Creating sessions...
REM  FIRE = ONE session. The button plays it repeat:0 = continuous voice; the
REM  strobe rides on the never-ending audio, so no separate silent hold is needed.
curl -sk %AUTH% %HDR% -o nul -w "  fire (continuous voice) -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"fire-announce\",\"prio\":\"HIGH\",\"targets\":%TARGETS%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_FIRE%}"

REM  wv + tornado = announce (HIGH) + silent hold (LOW), site-wide.
call :pair wv %PROFILE_WV%
call :pair tornado %PROFILE_TORNADO%

REM  lightning = announce + hold, HANGAR ONLY (%TARGETS_LIGHTNING%).
curl -sk %AUTH% %HDR% -o nul -w "  lightning-announce      -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"lightning-announce\",\"prio\":\"HIGH\",\"targets\":%TARGETS_LIGHTNING%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_LIGHTNING%}"
curl -sk %AUTH% %HDR% -o nul -w "  lightning-hold          -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"lightning-hold\",\"prio\":\"LOW\",\"targets\":%TARGETS_LIGHTNING%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_LIGHTNING%}"

REM  all-clears (green) + the monthly walk TEST (green).
curl -sk %AUTH% %HDR% -o nul -w "  allclear (site)         -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"allclear\",\"prio\":\"HIGH\",\"targets\":%TARGETS%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_CLEAR%}"
curl -sk %AUTH% %HDR% -o nul -w "  lightning-allclear      -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"lightning-allclear\",\"prio\":\"HIGH\",\"targets\":%TARGETS_LIGHTNING%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_CLEAR%}"
curl -sk %AUTH% %HDR% -o nul -w "  walk-test (green)       -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"walk-test\",\"prio\":\"LOW\",\"targets\":%TARGETS%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_TEST%}"

REM  Button 5 TRAINING = lobby all-clear, the ~4 lobby speakers only (green).
curl -sk %AUTH% %HDR% -o nul -w "  lobby-allclear (train)  -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"lobby-allclear\",\"prio\":\"HIGH\",\"targets\":%TARGETS_LOBBY%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%PROFILE_CLEAR%}"

echo.
echo  200 = created. Count ELEVEN lines below (fire + wv/tornado x2 + lightning x2
echo  + allclear + lightning-allclear + walk-test + lobby-allclear):
curl -sk %AUTH% %API%/audioSessions
echo.
echo.
pause
exit /b

:pair
curl -sk %AUTH% %HDR% -o nul -w "  %1-announce           -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"%1-announce\",\"prio\":\"HIGH\",\"targets\":%TARGETS%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%2}"
curl -sk %AUTH% %HDR% -o nul -w "  %1-hold               -> HTTP %%{http_code}\n" -X POST %API%/audioSessions ^
  -d "{\"customId\":\"%1-hold\",\"prio\":\"LOW\",\"targets\":%TARGETS%,\"type\":\"HTTP\",\"visualProfileEnabled\":\"TRUE\",\"visualProfileId\":%2}"
exit /b
