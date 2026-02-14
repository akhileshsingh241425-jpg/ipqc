# Fix all API URL references for production deployment

Write-Host "Fixing API URLs in DailyReport.js..." -ForegroundColor Yellow

$filePath = "frontend\src\components\DailyReport.js"
$content = Get-Content $filePath -Raw

# Replace all localhost:5002 with getAPIBaseURL() helper
$content = $content -replace "const API_BASE_URL = process\.env\.REACT_APP_API_BASE_URL \|\| 'http://localhost:5002';", "const API_BASE_URL = getAPIBaseURL();"
$content = $content -replace "const API_BASE = process\.env\.REACT_APP_API_URL \|\| 'http://localhost:5002/api';", "const API_BASE = getAPIBase();"
$content = $content -replace ": ``http://localhost:5002\`\${path}``", ": (window.location.hostname === 'localhost' ? ``http://localhost:5003\`\${path}`` : path)"
$content = $content -replace "``http://localhost:5002\`\${path}``", "(window.location.hostname === 'localhost' ? ``http://localhost:5003\`\${path}`` : path)"

Set-Content $filePath $content

Write-Host "✓ DailyReport.js fixed" -ForegroundColor Green

Write-Host "`nAll API URLs updated for production deployment!" -ForegroundColor Green
