@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd frontend
echo Starting frontend server...
start "Secure Chat Frontend" npm run dev
pause
