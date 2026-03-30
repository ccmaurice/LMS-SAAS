# One-time: creates PostgreSQL user "saaslms" and database "saaslms" (password: saaslms).
# You only need the password for the built-in Windows "postgres" superuser.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) {
  Write-Host "Could not find psql.exe under C:\Program Files\PostgreSQL\" -ForegroundColor Red
  Write-Host "Install PostgreSQL or add psql to your PATH, then run this script again."
  exit 1
}

Write-Host "Using: $psql" -ForegroundColor DarkGray
$secure = Read-Host "Enter your PostgreSQL 'postgres' user password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

$env:PGPASSWORD = $plain
$sqlPath = Join-Path $PSScriptRoot "scripts\init-saaslms.sql"
& $psql -U postgres -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -f $sqlPath
$exit = $LASTEXITCODE
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

if ($exit -ne 0) {
  Write-Host "`nSetup failed. Check the password and that PostgreSQL is running." -ForegroundColor Red
  exit $exit
}

Write-Host "`nDatabase 'saaslms' is ready. Next run: .\Start-Local.ps1" -ForegroundColor Green
