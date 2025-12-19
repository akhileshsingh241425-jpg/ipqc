# Comprehensive API URL fix for production deployment
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  API URL Production Fix Script  " -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Fix DailyReport.js
Write-Host "[1/2] Fixing DailyReport.js..." -ForegroundColor Yellow
$dailyReportPath = "frontend\src\components\DailyReport.js"
$content = Get-Content $dailyReportPath -Raw -Encoding UTF8

# Replace patterns
$content = $content -replace "process\.env\.REACT_APP_API_BASE_URL \|\| 'http://localhost:5002'", "getAPIBaseURL()"
$content = $content -replace "process\.env\.REACT_APP_API_URL \|\| 'http://localhost:5002/api'", "getAPIBase()"
$content = $content -replace "``: \`"http://localhost:5002\`\$\{path\}\`"", ": (window.location.hostname === 'localhost' ? \`http://localhost:5003\${path}\` : path)"

Set-Content $dailyReportPath $content -Encoding UTF8
Write-Host "✓ DailyReport.js updated" -ForegroundColor Green

# Fix apiService.js comment
Write-Host "[2/2] Fixing apiService.js comment..." -ForegroundColor Yellow
$apiServicePath = "frontend\src\services\apiService.js"
$content = Get-Content $apiServicePath -Raw -Encoding UTF8
$content = $content -replace "Development: Uses localhost:5002", "Development: Uses localhost:5003"
Set-Content $apiServicePath $content -Encoding UTF8
Write-Host "✓ apiService.js updated" -ForegroundColor Green

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "  All API URLs Fixed!  " -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  • Production: Uses relative paths (/api)" -ForegroundColor White
Write-Host "  • Development: Uses localhost:5003" -ForegroundColor White
Write-Host "  • Smart detection: window.location.hostname" -ForegroundColor White
