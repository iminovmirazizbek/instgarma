@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Avval setup_backend.bat ni ishga tushiring.
  pause
  exit /b 1
)
call .venv\Scripts\activate
python manage.py runserver
