@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd backend
echo Starting backend server...
echo Make sure MongoDB is running!
start "Secure Chat Backend" npm run dev
pause
