@echo off
start "Secure Chat Backend" cmd /k "start_backend.bat"
start "Secure Chat Frontend" cmd /k "start_frontend.bat"
echo App started.
echo Please ensure MongoDB is running if backend fails to connect.
pause
