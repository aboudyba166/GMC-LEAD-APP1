# Creates lead-command-center-hostinger.zip in the web/ folder for Hostinger upload.
# Excludes: node_modules, .next, .git, data, scripts (local zip tool only), env secrets, old zips, logs.
# Run:  cd web ; .\scripts\zip-for-hostinger.ps1   or   npm run zip:hostinger

$ErrorActionPreference = "Stop"
$webRoot = Split-Path -Parent $PSScriptRoot
$zipName = "lead-command-center-hostinger.zip"
$outZip = Join-Path $webRoot $zipName

$staging = Join-Path $env:TEMP ("lcc-hostinger-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
  robocopy $webRoot $staging /E `
    /XD node_modules .next .git data scripts .vscode .idea `
    /XF .env.local .env.development.local .env.production.local lead-command-center-hostinger.zip *.log .DS_Store Thumbs.db `
    /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) { throw "robocopy failed with exit code $code" }

  if (Test-Path $outZip) { Remove-Item $outZip -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $outZip -CompressionLevel Optimal

  $size = (Get-Item $outZip).Length / 1MB
  Write-Host "OK: $outZip  ($([math]::Round($size, 2)) MB)"
  Write-Host "Upload this zip in Hostinger, then run: npm install && npm run build && npm start"
} finally {
  Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
}
