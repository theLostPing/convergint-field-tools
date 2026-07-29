@echo off
setlocal enabledelayedexpansion
REM ===========================================================================
REM  C6110 BENCH test - PLAIN CURL, no Python, no install.  BENCH USE ONLY -
REM  do NOT run this at an occupied site (it makes real noise). Fires the exact
REM  play/stop calls a console button sends, so you can prove the server side on
REM  the bench before wiring the console. Run the provisioner first.
REM
REM  Run ON the AAM Pro server (curl.exe ships with Windows Server 2019+):
REM    test-buttons.cmd fire              FIRE: continuous voice + strobe
REM    test-buttons.cmd alert <name>      wv|tornado|lightning: announce x2 + silent hold
REM    test-buttons.cmd allclear          SITE all clear: stop everything, play all-clear
REM    test-buttons.cmd lightclear        LIGHTNING all clear (hangar only)  [button 10]
REM    test-buttons.cmd test              TEST cycle: test.mp3 + 30s flash, ~30 min [button 3]
REM    test-buttons.cmd teststop          stop the test early
REM    test-buttons.cmd status            list sessions
REM ===========================================================================

REM ---- EDIT THESE (ids from YOUR server: run the provisioner to list them) ----
set SERVER=127.0.0.1
set USER=<API_USER>
set PASS=<API_PASSWORD>
REM  per-emergency VOICE files:
set FILE_FIRE=0
set FILE_WV=0
set FILE_TORNADO=0
set FILE_LIGHTNING=0
set FILE_ALLCLEAR=0
REM  shared files:
set FILE_SILENCE=0
set FILE_TEST=0
set FILE_SILENCE30=0
set ANNOUNCE_TIMES=2
REM  TEST loop count = 1800s / (test.mp3 length + 30s).  test 15s -> 45s -> 40.
set WALK_REPEAT=40
REM ----------------------------------------------------------------------------

set API=https://%SERVER%/api/v1.2
set AUTH=--digest -u %USER%:%PASS%
set HDR=-H "Content-Type: application/json"

set ACTION=%1
set NAME=%2

if /I "%ACTION%"=="fire"       goto fire
if /I "%ACTION%"=="alert"      goto alert
if /I "%ACTION%"=="allclear"   goto allclear
if /I "%ACTION%"=="lightclear" goto lightclear
if /I "%ACTION%"=="lobbyclear" goto lobbyclear
if /I "%ACTION%"=="test"       goto test
if /I "%ACTION%"=="teststop"   goto teststop
if /I "%ACTION%"=="status"     goto status
goto help

:fire
echo ===== BUTTON PRESSED: FIRE (continuous voice) =====
curl -sk %AUTH% %HDR% -o nul -w "  fire voice (loops forever) -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/fire-announce/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_FIRE%\"],\"repeat\":0}"
echo  (talks continuously + strobe until SITE ALL CLEAR. 404 = run the provisioner first.)
goto :eof

:alert
REM  wv / tornado / lightning: announce x2, then a SILENT strobe hold until clear.
if /I not "%NAME%"=="wv" if /I not "%NAME%"=="tornado" if /I not "%NAME%"=="lightning" (
  echo  alert takes a name: wv, tornado, or lightning  ^(fire uses "test-buttons.cmd fire"^)
  goto :eof
)
set MSG=!FILE_%NAME%!
echo ===== BUTTON PRESSED: ALERT (%NAME%) =====
if /I "%NAME%"=="lightning" echo  (lightning fires HANGAR ONLY)
curl -sk %AUTH% %HDR% -o nul -w "  announce x%ANNOUNCE_TIMES%           -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/%NAME%-announce/playAudioFiles ^
  -d "{\"fileIds\":[\"!MSG!\"],\"repeat\":%ANNOUNCE_TIMES%}"
curl -sk %AUTH% %HDR% -o nul -w "  silent strobe hold (forever) -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/%NAME%-hold/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_SILENCE%\"],\"repeat\":0}"
echo  (404 = that session was never provisioned - run the provisioner)
goto :eof

:allclear
echo ===== BUTTON PRESSED: SITE ALL CLEAR =====
curl -sk %AUTH% %HDR% -o nul -w "  stop fire      -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/fire-announce/stopAudioFiles -d "{}"
for %%S in (wv tornado lightning) do (
  curl -sk %AUTH% %HDR% -o nul -w "  stop %%S-hold/announce -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/%%S-hold/stopAudioFiles -d "{}"
  curl -sk %AUTH% %HDR% -o nul -w "                        -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/%%S-announce/stopAudioFiles -d "{}"
)
curl -sk %AUTH% %HDR% -o nul -w "  stop walk-test -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/walk-test/stopAudioFiles -d "{}"
curl -sk %AUTH% %HDR% -o nul -w "  play allclear  -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/allclear/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_ALLCLEAR%\"],\"repeat\":1}"
goto :eof

:lightclear
echo ===== BUTTON 10: LIGHTNING ALL CLEAR (hangar only) =====
curl -sk %AUTH% %HDR% -o nul -w "  stop lightning-hold     -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/lightning-hold/stopAudioFiles -d "{}"
curl -sk %AUTH% %HDR% -o nul -w "  stop lightning-announce -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/lightning-announce/stopAudioFiles -d "{}"
curl -sk %AUTH% %HDR% -o nul -w "  play lightning-allclear -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/lightning-allclear/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_ALLCLEAR%\"],\"repeat\":1}"
echo  (HANGAR ONLY - leaves the rest of the site alone)
goto :eof

:lobbyclear
echo ===== BUTTON 5: LOBBY ALL CLEAR (training - lobby speakers only) =====
curl -sk %AUTH% %HDR% -o nul -w "  play lobby-allclear -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/lobby-allclear/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_ALLCLEAR%\"],\"repeat\":1}"
echo  (LOBBY speakers only - training)
goto :eof

:test
echo ===== BUTTON 3: TEST START (test.mp3 + 30s flash, ~30 min, self-stops) =====
curl -sk %AUTH% %HDR% -o nul -w "  test cycle x%WALK_REPEAT% -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/walk-test/playAudioFiles ^
  -d "{\"fileIds\":[\"%FILE_TEST%\",\"%FILE_SILENCE30%\"],\"repeat\":%WALK_REPEAT%}"
echo  (each cycle = test.mp3 then 30s green flash-only; loops ~30 min then stops. teststop ends early.)
goto :eof

:teststop
echo ===== BUTTON 3: TEST STOP =====
curl -sk %AUTH% %HDR% -o nul -w "  stop test -> HTTP %%{http_code}\n" -X POST %API%/audioSessions/custom/walk-test/stopAudioFiles -d "{}"
goto :eof

:status
curl -sk %AUTH% %API%/audioSessions
echo.
goto :eof

:help
echo Usage: test-buttons.cmd ACTION [name]   (BENCH ONLY - makes real noise)
echo.
echo   fire            - FIRE: continuous voice + strobe until all clear
echo   alert ^<name^>    - wv^|tornado^|lightning: announce x2 + silent strobe hold
echo   allclear        - SITE all clear: stop everything, play all-clear (green)
echo   lightclear      - LIGHTNING all clear, hangar only            (button 10)
echo   test / teststop - TEST cycle: test.mp3 + 30s flash ~30 min    (button 3)
echo   status          - list sessions
echo.
echo   Run the provisioner first so the sessions these calls play/stop exist.
goto :eof
