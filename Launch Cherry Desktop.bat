@echo off
title Cherry AI Desktop Assistant
echo =================================================================
echo             LAUNCHING CHERRY AI DESKTOP ASSISTANT
echo =================================================================
echo.
echo Initializing uvicorn servers, Next.js host, and electron client...
echo (Both servers will run in the background under Electron control)
echo.
cmd /c "npm start"
echo.
echo Workspace closed. Goodbye!
pause
