@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "CMD="
where python >nul 2>nul && set "CMD=python server.py"
if not defined CMD (
  where node >nul 2>nul && set "CMD=node server.js"
)
if not defined CMD (
  echo 未找到 Python 或 Node.js，请安装其一后重试。
  pause
  exit /b 1
)

start "工作台服务器" /min cmd /k "%CMD%"
timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:8123
exit