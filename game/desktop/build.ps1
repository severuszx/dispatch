$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$app = Join-Path $here "app"
if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item -ItemType Directory -Force $app | Out-Null
Copy-Item (Join-Path $root "index.html") $app
Copy-Item (Join-Path $root "assets") $app -Recurse
Copy-Item (Join-Path $root "data") $app -Recurse
if (Test-Path (Join-Path $root "packs")) { Copy-Item (Join-Path $root "packs") $app -Recurse }
Copy-Item (Join-Path $here "build") $app -Recurse

Push-Location $here
npx electron-packager . "调度台" --platform=win32 --arch=x64 --icon=build/icon.ico --out=dist --overwrite --prune=true --ignore="^/dist" --ignore="node_modules/.cache"
Pop-Location
Write-Output "pack done"
