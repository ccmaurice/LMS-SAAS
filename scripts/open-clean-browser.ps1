param(
  [Parameter(Position = 0)]
  [string] $Url = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

# Persistent but repo-external profile (bookmarks/history stay between runs; no normal extensions loaded)
$profileRoot = Join-Path $env:LOCALAPPDATA "saas-lms-clean-browser"
New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null

$candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  Write-Error "Install Microsoft Edge or Google Chrome, or edit scripts/open-clean-browser.ps1 to point at your Chromium binary."
  exit 1
}

$launchArgs = @(
  "--user-data-dir=$profileRoot",
  "--disable-extensions",
  "--disable-component-extensions-with-background-pages",
  "--no-first-run",
  "--no-default-browser-check",
  $Url
)

Start-Process -FilePath $browser -ArgumentList $launchArgs
Write-Host "Launched clean dev browser (extensions disabled)."
Write-Host "Profile: $profileRoot"
Write-Host "URL:     $Url"
