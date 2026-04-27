# Upload lead-command-center-hostinger.zip and run npm install (+ build) on Hostinger via SSH.
# Run from Cursor's terminal or PowerShell where `ssh -p 65002 ...` already works.
#
#   cd web
#   .\scripts\deploy-hostinger-ssh.ps1
#
# Custom folder on server:
#   .\scripts\deploy-hostinger-ssh.ps1 -RemoteAppDir "~/domains/yoursite.com/public_html/lcc"

param(
  [string] $HostEntry = "145.223.76.147",
  [int] $Port = 65002,
  [string] $User = "u371723897",
  [string] $RemoteAppDir = "~/lead-command-center",
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
$webRoot = Split-Path -Parent $PSScriptRoot
$zipName = "lead-command-center-hostinger.zip"
$zipLocal = Join-Path $webRoot $zipName

if (-not (Test-Path $zipLocal)) {
  Write-Host "Missing $zipLocal — run: npm run zip:hostinger"
  exit 1
}

if ($RemoteAppDir.StartsWith("~")) {
  $bashApp = '$HOME' + $RemoteAppDir.Substring(1)
} else {
  $bashApp = $RemoteAppDir
}

$remoteZipName = "lead-command-center-hostinger.zip"
$sshTarget = "${User}@${HostEntry}"

Write-Host "SCP -> ${sshTarget}:~/${remoteZipName}"
scp -P $Port $zipLocal "${sshTarget}:~/${remoteZipName}"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$buildLines = if ($SkipBuild) {
  "echo 'Skipped npm run build (-SkipBuild).'"
} else {
  @"
echo "--- npm run build ---"
npm run build
"@
}

$bashScript = @"
set -euo pipefail
APP="$bashApp"
ZIP=`$HOME/$remoteZipName
mkdir -p "`$APP"
cd "`$APP"
unzip -o "`$ZIP"
echo "--- npm install ---"
npm install
$buildLines
pwd
echo "Set GOOGLE_API_KEY + NODE_ENV=production in hPanel; run: npm start"
"@

Write-Host "SSH: unzip + npm ($RemoteAppDir)"
$bashScript | ssh -p $Port $sshTarget bash -s
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done."
