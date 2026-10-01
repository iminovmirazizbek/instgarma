@echo off
cd /d "%~dp0react"
if not exist node_modules (
  npm install
)
npm run dev
