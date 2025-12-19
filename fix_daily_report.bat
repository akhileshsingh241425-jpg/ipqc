@echo off
cd /d "%~dp0"
echo Fixing DailyReport.js API URLs...

powershell -Command "(Get-Content 'frontend\src\components\DailyReport.js' -Raw) -replace 'const API_BASE_URL = process\.env\.REACT_APP_API_BASE_URL \|\| ''http://localhost:5002'';', 'const API_BASE_URL = getAPIBaseURL();' -replace 'const API_BASE = process\.env\.REACT_APP_API_URL \|\| ''http://localhost:5002/api'';', 'const API_BASE = getAPIBase();' -replace ': ``http://localhost:5002\$\{path\}``', ': (window.location.hostname === ''localhost'' ? ``http://localhost:5003${path}`` : path)' -replace '``http://localhost:5002\$\{path\}``', '(window.location.hostname === ''localhost'' ? ``http://localhost:5003${path}`` : path)' | Set-Content 'frontend\src\components\DailyReport.js'"

echo Done!
pause
