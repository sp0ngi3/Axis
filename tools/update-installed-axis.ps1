param(
    [switch]$Online
)

$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$versionFile = Join-Path $workspace "Directory.Build.props"
$frontend = Join-Path $workspace "src\frontend\axis-web"
$backendTests = Join-Path $workspace "tests\Axis.UnitTests\Axis.UnitTests.csproj"
$publisher = Join-Path $PSScriptRoot "publish-desktop.ps1"
$installDirectory = Join-Path $env:LOCALAPPDATA "Programs\Axis"
$installedExecutable = Join-Path $installDirectory "Axis.exe"

function Get-AxisVersion {
    [xml]$properties = Get-Content -LiteralPath $versionFile -Raw
    $version = [string]$properties.Project.PropertyGroup.Version
    if ($version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Nie mozna odczytac poprawnej wersji z Directory.Build.props."
    }

    return $version
}

function Get-RunningInstalledAxis {
    $expectedPath = [System.IO.Path]::GetFullPath($installedExecutable)
    return @(Get-Process -Name "Axis" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $_.Path -and [System.IO.Path]::GetFullPath($_.Path).Equals(
                $expectedPath,
                [System.StringComparison]::OrdinalIgnoreCase)
        }
        catch {
            $false
        }
    })
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Description,
        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host $Description -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description nie powiodlo sie (kod $LASTEXITCODE)."
    }
}

try {
    $version = Get-AxisVersion
    $setupExecutable = Join-Path $workspace "artifacts\desktop\Axis-Setup-$version.exe"
    $payloadExecutable = Join-Path $workspace "artifacts\desktop\payload\Axis.exe"

    Write-Host "Axis $version - bezpieczna aktualizacja lokalna" -ForegroundColor Magenta
    Write-Host "Aktualizowane sa tylko pliki programu. Baza, backupy i logi pozostaja bez zmian."

    while ((Get-RunningInstalledAxis).Count -gt 0) {
        Write-Host ""
        Write-Host "Axis jest uruchomiony. Zamknij go przez ikone obok zegara: Quit." -ForegroundColor Yellow
        Read-Host "Po zamknieciu Axis nacisnij Enter"
    }

    Invoke-CheckedCommand "Sprawdzanie frontendu..." {
        & npm --prefix $frontend test -- --run
    }

    Invoke-CheckedCommand "Sprawdzanie API i danych..." {
        & dotnet test $backendTests --no-restore
    }

    Write-Host ""
    Write-Host "Budowanie instalatora Axis $version..." -ForegroundColor Cyan
    if ($Online) {
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $publisher -Version $version
    }
    else {
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $publisher -Version $version -Offline
    }
    if ($LASTEXITCODE -ne 0) {
        $hint = if ($Online) { "" } else { " Uruchom ponownie: AKTUALIZUJ-AXIS.cmd -Online" }
        throw "Nie udalo sie zbudowac instalatora.$hint"
    }

    if (-not (Test-Path -LiteralPath $setupExecutable)) {
        throw "Instalator nie zostal utworzony: $setupExecutable"
    }

    Invoke-CheckedCommand "Weryfikowanie gotowego instalatora..." {
        & $setupExecutable --verify
    }

    Write-Host ""
    Write-Host "Instalator jest gotowy. Kliknij Install w otwartym oknie." -ForegroundColor Green
    $installer = Start-Process -FilePath $setupExecutable -Wait -PassThru
    if ($installer.ExitCode -ne 0) {
        throw "Instalator zakonczyl sie kodem $($installer.ExitCode)."
    }

    if (-not (Test-Path -LiteralPath $installedExecutable)) {
        throw "Axis nie zostal zainstalowany. Uruchom instalator ponownie."
    }

    if (Test-Path -LiteralPath $payloadExecutable) {
        $builtHash = (Get-FileHash -LiteralPath $payloadExecutable -Algorithm SHA256).Hash
        $installedHash = (Get-FileHash -LiteralPath $installedExecutable -Algorithm SHA256).Hash
        if ($builtHash -ne $installedHash) {
            throw "Instalacja nie zawiera jeszcze najnowszego buildu. Uruchom instalator ponownie i kliknij Install."
        }
    }

    Write-Host ""
    Write-Host "Gotowe. Na komputerze jest teraz aktualny Axis $version." -ForegroundColor Green
    Write-Host "Dane pozostaly w: $env:LOCALAPPDATA\Axis"
    exit 0
}
catch {
    Write-Host ""
    Write-Host "Aktualizacja zostala zatrzymana." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Baza danych i backupy nie zostaly zmienione."
    exit 1
}
