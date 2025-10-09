@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0.."

if not exist logs mkdir logs
set LOGFILE=logs\auto-push-%DATE:~10,4%-%DATE:~4,2%-%DATE:~7,2%_%TIME:~0,2%-%TIME:~3,2%.log
set LOGFILE=%LOGFILE: =0%

REM Load env from .env.local using dotenv/config and append output to log
set DOTENV_CONFIG_PATH=.env.local
echo [%%DATE%% %%TIME%%] Running auto-push... >> "%LOGFILE%"
node -r dotenv/config scripts\auto-push.mjs >> "%LOGFILE%" 2>&1
echo [%%DATE%% %%TIME%%] Done. Exit code: %%ERRORLEVEL%% >> "%LOGFILE%"

endlocal