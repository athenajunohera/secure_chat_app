@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd backend
echo Installing backend dependencies...
call npm install
cd ..\frontend
echo Installing frontend dependencies...
call npm install
cd ..
echo Installation complete.
pause
