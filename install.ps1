# Installs the plugin into the Elgato Stream Deck plugin folder.
# Requires: Python 3 and Node.js (npm). Restart Stream Deck afterwards.
$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "com.phuelsebus.pulsar-battery.sdPlugin"
$dst = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\com.phuelsebus.pulsar-battery.sdPlugin"

python -c "import hid" 2>$null
if ($LASTEXITCODE -ne 0) { python -m pip install hidapi }

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
robocopy $src $dst /E /XD node_modules /NFL /NDL /NJH /NJS | Out-Null
Push-Location $dst
npm install --omit=dev --no-audit --no-fund
Pop-Location
Write-Host "Installed to $dst. Restart Stream Deck, then drag 'Battery' (category Pulsar) onto a key."
