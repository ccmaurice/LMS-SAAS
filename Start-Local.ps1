# Local dev: install deps, migrate, seed, start Next.js at http://localhost:3000

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== SaaS LMS — local start ===`n" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or not on PATH. Install LTS from https://nodejs.org" -ForegroundColor Red
  exit 1
}
Write-Host "Node $(node -v)" -ForegroundColor DarkGray

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example — review JWT_SECRET for production later." -ForegroundColor Yellow
}

Write-Host "`nInstalling packages..." -ForegroundColor White
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nApplying migrations..." -ForegroundColor White
$migrateLog = npx prisma migrate deploy 2>&1 | Out-String
Write-Host $migrateLog
if ($LASTEXITCODE -ne 0) {
  if ($migrateLog -match "P1000|credentials|Authentication failed") {
    Write-Host "`n--- Database login failed ---" -ForegroundColor Yellow
    Write-Host "Run this once to create user/database saaslms:"
    Write-Host "  .\Setup-Database.ps1" -ForegroundColor Green
    Write-Host "Then run Start-Local.ps1 again.`n"
  }
  exit $LASTEXITCODE
}

Write-Host "Seeding demo org (demo-school)..." -ForegroundColor White
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStarting dev server: http://localhost:3000" -ForegroundColor Green
Write-Host "Demo logins: admin@test.com | teacher@test.com | student@test.com — password: password123`n" -ForegroundColor DarkGray
npm run dev
