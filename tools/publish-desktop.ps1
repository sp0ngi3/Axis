param(
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version = "0.2.0",
    [switch]$Offline
)

$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $workspace "src\frontend\axis-web"
$apiProject = Join-Path $workspace "src\backend\Axis.Api\Axis.Api.csproj"
$desktopProject = Join-Path $workspace "tools\Axis.Desktop\Axis.Desktop.csproj"
$installerProject = Join-Path $workspace "tools\Axis.Installer\Axis.Installer.csproj"
$artifactRoot = Join-Path $workspace "artifacts\desktop"
$payloadDirectory = Join-Path $artifactRoot "payload"
$serverDirectory = Join-Path $payloadDirectory "server"
$payloadZip = Join-Path $artifactRoot "axis-desktop-payload.zip"
$setupPublishDirectory = Join-Path $artifactRoot "setup"
$portableZip = Join-Path $artifactRoot "Axis-$Version-win-x64-portable.zip"
$setupExecutable = Join-Path $artifactRoot "Axis-Setup-$Version.exe"

if (Test-Path -LiteralPath $artifactRoot) {
    $resolvedArtifactRoot = (Resolve-Path -LiteralPath $artifactRoot).Path
    $resolvedWorkspace = (Resolve-Path -LiteralPath $workspace).Path
    if (-not $resolvedArtifactRoot.StartsWith($resolvedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean artifacts outside the Axis workspace: $resolvedArtifactRoot"
    }

    Remove-Item -LiteralPath $artifactRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $payloadDirectory,$serverDirectory,$setupPublishDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $frontend "node_modules"))) {
    if ($Offline) {
        throw "Frontend dependencies are not installed. Run npm ci once before using -Offline."
    }

    npm --prefix $frontend ci --prefer-offline
}

$previousApiBaseUrl = $env:VITE_API_BASE_URL
try {
    $env:VITE_API_BASE_URL = "same-origin"
    npm --prefix $frontend run build
}
finally {
    $env:VITE_API_BASE_URL = $previousApiBaseUrl
}

$restoreArgument = if ($Offline) { "--no-restore" } else { $null }
$commonArguments = @("-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:PublishSingleFile=true", "-p:IncludeNativeLibrariesForSelfExtract=true", "-p:DebugType=None", "-p:Version=$Version")

$desktopArguments = @("publish", $desktopProject) + $commonArguments
if ($restoreArgument) { $desktopArguments += $restoreArgument }
$desktopArguments += @("-o", $payloadDirectory)
& dotnet @desktopArguments
if ($LASTEXITCODE -ne 0) { throw "Desktop host publish failed with exit code $LASTEXITCODE." }

$apiArguments = @("publish", $apiProject) + $commonArguments
if ($restoreArgument) { $apiArguments += $restoreArgument }
$apiArguments += @("-o", $serverDirectory)
& dotnet @apiArguments
if ($LASTEXITCODE -ne 0) { throw "Axis API publish failed with exit code $LASTEXITCODE." }

@{
    app = "Axis"
    version = $Version
    runtime = "win-x64"
    builtAt = [DateTimeOffset]::UtcNow.ToString("O")
    dataLocation = "%LOCALAPPDATA%\Axis\Data\axis.db"
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payloadDirectory "release.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $payloadDirectory "*") -DestinationPath $payloadZip -CompressionLevel Optimal
Copy-Item -LiteralPath $payloadZip -Destination $portableZip

$installerArguments = @("publish", $installerProject) + $commonArguments
if ($restoreArgument) { $installerArguments += $restoreArgument }
$installerArguments += @("-p:AxisPayload=$payloadZip", "-o", $setupPublishDirectory)
& dotnet @installerArguments
if ($LASTEXITCODE -ne 0) { throw "Axis installer publish failed with exit code $LASTEXITCODE." }

Copy-Item -LiteralPath (Join-Path $setupPublishDirectory "Axis-Setup.exe") -Destination $setupExecutable -Force

Write-Host ""
Write-Host "Axis desktop $Version is ready:" -ForegroundColor Cyan
Write-Host "Installer: $setupExecutable"
Write-Host "Portable:  $portableZip"
Write-Host ""
Write-Host "The installer and portable build run without Docker, Node.js, the .NET SDK, or a NuGet download."
