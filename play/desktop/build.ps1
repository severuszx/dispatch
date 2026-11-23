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
$cache = Join-Path $env:LOCALAPPDATA "electron\Cache"
$zip = Get-ChildItem $cache -Recurse -Filter "electron-v*-win32-x64.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$args = @(".", "调度台", "--platform=win32", "--arch=x64", "--icon=build/icon.ico", "--out=dist", "--overwrite", "--prune=true", "--ignore=^/dist", "--ignore=node_modules/.cache")
if ($zip) { $args += "--electron-zip-dir=$($zip.DirectoryName)" }
& ".\node_modules\.bin\electron-packager.cmd" @args
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "electron-packager failed: $LASTEXITCODE" }
Pop-Location
Write-Output "pack done"
