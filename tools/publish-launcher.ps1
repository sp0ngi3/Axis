$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$project = Join-Path $workspace "tools\Axis.Launcher\Axis.Launcher.csproj"
$publishDir = Join-Path $workspace "artifacts\launcher"
$targetExe = Join-Path $workspace "00-AXIS.exe"

dotnet publish $project -c Release -r win-x64 --self-contained false /p:PublishSingleFile=true -o $publishDir
Copy-Item -LiteralPath (Join-Path $publishDir "00-AXIS.exe") -Destination $targetExe -Force

Write-Host "Launcher published to $targetExe"
