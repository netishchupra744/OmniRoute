@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "LOG=%CD%\bijoy-windows-build.log"
set "NODE_OPTIONS=--max_old_space_size=8192"
set "NPM_CONFIG_REGISTRY=https://registry.npmjs.org/"
set "NPM_CONFIG_AUDIT=false"
set "NPM_CONFIG_FUND=false"
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
set "JWT_SECRET=local-build-secret-with-sufficient-length-for-validation"
set "API_KEY_SECRET=local-build-api-key-secret-with-sufficient-length"

call :log "Bijoy AI Video Maker Windows build started."

where node >nul 2>&1 || goto :node_missing
for /f "tokens=*" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
node -e "const [M,m,p]=process.versions.node.split('.').map(Number); process.exit((M===22&&(m>22||(m===22&&p>=2)))||(M>=24&&M<27)?0:1)" || goto :node_unsupported

call :run npm ci --no-audit --no-fund || goto :failed
call :run npm run test:bijoy || goto :failed
call :run npm run check:migration-numbering || goto :failed
call :run npm run build || goto :failed
pushd electron
call :run npm ci --no-audit --no-fund || (popd & goto :failed)
call :run npm run build:win || (popd & goto :failed)
popd
call :run npm run verify:bijoy:windows || goto :failed

call :log "BUILD COMPLETE"
echo.
echo Installer: release-assets\windows\Bijoy-AI-Video-Maker-Setup.exe
echo Portable:  release-assets\windows\Bijoy-AI-Video-Maker-Portable.exe
echo Checksums: release-assets\windows\SHA256SUMS.txt
echo.
pause
exit /b 0

:node_missing
call :log "ERROR: Node.js is not installed. Install supported Node.js 24, then run this file again."
echo Open: https://nodejs.org/
pause
exit /b 1

:node_unsupported
call :log "ERROR: Node.js %NODE_VERSION% is unsupported. Use Node.js 22.22.2+ or Node.js 24/26."
pause
exit /b 1

:failed
call :log "BUILD FAILED. Read %LOG% for the exact failing command."
pause
exit /b 1

:run
call :log "RUN: %*"
call %* >> "%LOG%" 2>&1
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" call :log "FAILED (%RESULT%): %*"
exit /b %RESULT%

:log
echo [%DATE% %TIME%] %~1
>> "%LOG%" echo [%DATE% %TIME%] %~1
exit /b 0
