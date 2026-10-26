@echo off
setlocal EnableExtensions
cd /d "%~dp0"

git config --global --add safe.directory "%CD%" >nul 2>nul
git config --global --add safe.directory "%CD:\=/%" >nul 2>nul

echo.
echo [1/3] Adding changes...
git add -A

echo [2/3] Committing...
git commit -m "update workbench"
if errorlevel 1 (
  echo.
  echo [WARN] Nothing to commit or commit failed. Continuing to push...
)

echo [3/3] Pushing to GitHub...
git push

if errorlevel 1 (
  echo.
  echo [ERROR] Push failed. Check network and retry.
  echo If a login window opens, paste your Personal Access Token (PAT)
  echo in the Password field, not your GitHub password.
  pause
  exit /b 1
)

echo.
echo Done! The live site will update in about 1 minute.
pause