@echo off
setlocal
cd /d "%~dp0"
set "PYW=%~dp0.venv\Scripts\pythonw.exe"
set "PY=%~dp0.venv\Scripts\python.exe"
set "LOG=%~dp0logs"
if not exist "%LOG%" mkdir "%LOG%"

if not exist "%PYW%" (
    if exist "%PY%" (
        set "PYW=%PY%"
    ) else (
        mshta "javascript:alert('Cherry AI: Python venv missing.\n\nOpen terminal in project folder and run:\npython -m venv .venv\npip install -r requirements.txt');close()"
        exit /b 1
    )
)

if not exist "%~dp0.env" (
    mshta "javascript:alert('Cherry AI: .env file missing.\n\nCopy .env.example to .env and add GOOGLE_API_KEY.');close()"
    exit /b 1
)

"%PYW%" "%~dp0run.py" 2>>"%LOG%\cherry-error.log"
if errorlevel 1 (
    mshta "javascript:alert('Cherry AI failed to start.\n\nSee logs\\cherry-error.log in the project folder.');close()"
)
endlocal
