# Waits for PostgreSQL on localhost:5432 (Docker Compose), then Prisma migrate deploy + seed.
# Run: npm run db:bootstrap

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Wait-Port {
    param([int]$Port = 5432, [int]$Seconds = 90)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $ok = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($ok) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
    Write-Host "Starting PostgreSQL (and Adminer) via Docker Compose..."
    docker compose up postgres adminer -d
    if (Wait-Port 5432 90) {
        Write-Host "Port 5432 is listening."
    } else {
        Write-Host "PostgreSQL did not open port 5432 in time."
        exit 1
    }
} else {
    Write-Host "Docker not in PATH. Ensure PostgreSQL is running and DATABASE_URL in .env is correct, then:"
    Write-Host "  npx prisma migrate deploy"
    Write-Host "  npm run db:seed"
    if (-not (Wait-Port 5432 5)) { exit 1 }
}

Write-Host "Running Prisma migrate deploy..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Seeding database..."
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Adminer (if using compose): http://localhost:8080 — System: PostgreSQL, Server: postgres, User: saaslms, Password: saaslms, Database: saaslms"
