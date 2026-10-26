@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo   Workbench - Deploy to GitHub Pages
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git not found. Install Git for Windows first:
  echo         https://git-scm.com/download/win
  pause
  exit /b 1
)

git config --global --add safe.directory "%CD%" >nul 2>nul
git config --global --add safe.directory "%CD:\=/%" >nul 2>nul

set "GITHUB_USER="
set "GITHUB_EMAIL="
set "REPO_NAME="

set /p "GITHUB_USER=Enter your GitHub username: "
set /p "GITHUB_EMAIL=Enter your GitHub email: "
set /p "REPO_NAME=Enter repository name (example: workbench): "

if "%GITHUB_USER%"=="" goto :abort
if "%REPO_NAME%"=="" goto :abort

git config user.name "%GITHUB_USER%"
git config user.email "%GITHUB_EMAIL%"

if not exist ".git" (
  echo [1/5] Initializing git repository...
  git init
)

echo [2/5] Linking remote repository...
echo.
echo Before continuing, create a PUBLIC repository on GitHub:
echo   https://github.com/new
echo Use the SAME name you typed above. Do NOT add README or .gitignore.
echo.
echo Press any key AFTER you have created the repository on GitHub...
pause >nul
echo.

git remote remove origin >nul 2>nul
git remote add origin "https://github.com/%GITHUB_USER%/%REPO_NAME%.git"

echo [3/5] Adding and committing files...
git add -A
git commit -m "Initial commit: workbench"
if errorlevel 1 (
  echo.
  echo [WARN] Commit failed or nothing to commit. Continuing...
)

echo [4/5] Pushing branch main to GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
  echo.
  echo [ERROR] Push failed. Common causes:
  echo   - Repository does not exist or is not empty on GitHub.
  echo     Delete it and recreate, or use a different name.
  echo   - Authentication: when a window opens, paste a Personal Access
  echo     Token (PAT) in the PASSWORD field, not your GitHub password.
  echo     Create a PAT: GitHub - Settings - Developer settings -
  echo     Personal access tokens - Tokens (classic) - check repo.
  pause
  exit /b 1
)

echo.
echo [5/5] Done! One last step on GitHub:
echo   1. Open https://github.com/%GITHUB_USER%/%REPO_NAME%
echo   2. Go to Settings - Pages
echo   3. Source: Deploy from a branch
echo   4. Branch: main, folder: / (root), then Save
echo   5. After 1 minute visit:
echo      https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo.
echo Tip: after Pages is enabled, open the site on your phone too.
echo       Use Settings - Cloud Sync to sync data between devices.
echo.
pause
exit /b 0

:abort
echo.
echo [ERROR] Username and repository name are required.
pause
exit /b 1
