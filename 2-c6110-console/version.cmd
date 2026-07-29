@echo off
REM ======================================================================
REM  What version of AXIS Audio Manager Pro is on this server?
REM  Plain cmd fallback for version.ps1 — nothing but built-in commands,
REM  works on a stripped Windows Server with no PowerShell policy fuss.
REM  Read-only: it only queries and lists.
REM
REM  Run it from a command prompt ON the AMP server:   version.cmd
REM ======================================================================
setlocal enabledelayedexpansion

echo.
echo === INSTALLED (uninstall registry) ===
call :scan "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
call :scan "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"

echo.
echo === INSTALL FOLDERS ===
dir /b "C:\Program Files" 2>nul | findstr /i "axis audio"
dir /b "C:\Program Files (x86)" 2>nul | findstr /i "axis audio"

echo.
echo === SERVICES ===
sc query state= all | findstr /i "SERVICE_NAME" | findstr /i "aam axis audio"

echo.
echo === WINDOWS ===
ver
where curl.exe >nul 2>&1 && (echo curl.exe: present) || (echo curl.exe: NOT present - use the .ps1 tools)

echo.
echo Send this whole output back along with the probe.js table.
echo.
goto :eof

:scan
REM Walk the uninstall keys, print DisplayName + DisplayVersion for AMP-ish entries.
for /f "delims=" %%K in ('reg query %1 2^>nul') do (
  reg query "%%K" /v DisplayName 2>nul | findstr /i "Audio Manager" >nul && (
    for /f "tokens=2,*" %%A in ('reg query "%%K" /v DisplayName 2^>nul ^| findstr /i "REG_SZ"') do echo   Name    : %%B
    for /f "tokens=2,*" %%A in ('reg query "%%K" /v DisplayVersion 2^>nul ^| findstr /i "REG_SZ"') do echo   Version : %%B
    echo   Key     : %%K
    echo.
  )
)
goto :eof
