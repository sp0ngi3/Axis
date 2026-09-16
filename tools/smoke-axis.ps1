param(
  [int]$Port = 18131
)

$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$apiDll = Join-Path $workspace "src\backend\Axis.Api\bin\Release\net10.0\Axis.Api.dll"
$dataDir = Join-Path $workspace "data"
$backupDir = Join-Path $workspace "backups\smoke-axis"
$databasePath = Join-Path $dataDir "smoke-axis.db"
$exportPath = Join-Path $backupDir "smoke-export.zip"
$stdoutPath = Join-Path $backupDir "smoke-api.out.log"
$stderrPath = Join-Path $backupDir "smoke-api.err.log"
$baseUrl = "http://localhost:$Port"

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw $message
  }
}

function Invoke-Json($method, $path, $body = $null) {
  $uri = "$baseUrl$path"
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $uri -DisableKeepAlive -TimeoutSec 10
  }

  return Invoke-RestMethod -Method $method -Uri $uri -DisableKeepAlive -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 20) -TimeoutSec 10
}

New-Item -ItemType Directory -Force -Path $dataDir, $backupDir | Out-Null
Remove-Item -LiteralPath $databasePath, "$databasePath-shm", "$databasePath-wal", $exportPath, $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

$env:ASPNETCORE_URLS = $baseUrl
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ConnectionStrings__Axis = "Data Source=$databasePath"
$env:Backup__Directory = $backupDir
$env:Logging__LogLevel__Default = "Warning"
$env:Logging__LogLevel__Microsoft_AspNetCore = "Warning"

$process = Start-Process -FilePath "dotnet" -ArgumentList @($apiDll) -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

try {
  $healthy = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 400
    try {
      $health = Invoke-Json Get "/api/health"
      $healthy = $health.status -eq "healthy"
      if ($healthy) { break }
    } catch {
      if ($attempt -eq 29) { throw }
    }
  }

  Assert-True $healthy "Axis API did not become healthy."

  $area = Invoke-Json Post "/api/life-areas" @{
    name = "Smoke Career"
    description = "QA area"
    color = "#2563eb"
    icon = "briefcase"
    priorityWeight = 10
    currentScore = 0
    targetScore = 80
    isActive = $true
  }
  Assert-True $area.id "Life area was not created."

  $goal = Invoke-Json Post "/api/goals" @{
    lifeAreaId = $area.id
    title = "Smoke Goal"
    description = "QA goal"
    status = "Active"
    priority = "Primary"
    progressType = "MilestoneBased"
    currentValue = 0
    targetValue = 100
    unit = "%"
    targetDate = $null
    maintenanceThreshold = 80
    maintenanceTargetPerWeek = 1
    decayRatePercentPerWeek = 2
  }
  Assert-True $goal.id "Goal was not created."

  $milestone = Invoke-Json Post "/api/goals/$($goal.id)/milestones" @{
    title = "Smoke Milestone"
    description = "QA milestone"
    type = "Count"
    currentValue = 0
    targetValue = 1
    unit = "done"
    sortOrder = 1
    status = "Active"
    dueDate = $null
  }
  Assert-True $milestone.id "Milestone was not created."

  $template = Invoke-Json Post "/api/activity-templates" @{
    lifeAreaId = $area.id
    title = "Smoke Deep Work"
    description = "QA template"
    defaultDurationMinutes = 45
    energyCost = "High"
    mentalLoad = "High"
    physicalLoad = "Low"
    defaultPoints = 7
    isActive = $true
  }
  Assert-True $template.id "Template was not created."

  $today = (Get-Date).ToString("yyyy-MM-dd")
  $dayName = (Get-Date).DayOfWeek.ToString()
  $rule = Invoke-Json Post "/api/recurrence-rules" @{
    templateId = $template.id
    frequency = "Weekly"
    interval = 1
    daysOfWeek = $dayName
    startDate = $today
    endDate = $null
  }
  Assert-True $rule.id "Recurrence rule was not created."

  $generated = Invoke-Json Post "/api/recurrence-rules/$($rule.id)/generate" @{
    from = $today
    to = $today
  }
  Assert-True ($generated.created -ge 1) "Recurring generation did not create an activity."

  $activities = Invoke-Json Get "/api/activities"
  Assert-True ($activities.Count -ge 1) "Activities list is empty."
  $activity = $activities[0]

  $activityUpdate = @{
    lifeAreaId = $area.id
    goalId = $goal.id
    milestoneId = $milestone.id
    templateId = $template.id
    title = $activity.title
    description = $activity.description
    plannedStartAt = $activity.plannedStartAt
    plannedEndAt = $activity.plannedEndAt
    actualStartAt = $null
    actualEndAt = $null
    durationMinutes = $activity.durationMinutes
    status = "Planned"
    energyCost = $activity.energyCost
    mentalLoad = $activity.mentalLoad
    physicalLoad = $activity.physicalLoad
    points = $activity.points
    notes = "linked by smoke QA"
  }
  $activity = Invoke-Json Put "/api/activities/$($activity.id)" $activityUpdate
  $completed = Invoke-Json Post "/api/activities/$($activity.id)/complete"
  Assert-True ($completed.status -eq "Completed") "Activity was not completed."

  $metric = Invoke-Json Post "/api/metrics" @{
    lifeAreaId = $area.id
    goalId = $goal.id
    name = "Smoke Metric"
    unit = "pts"
    valueType = "Number"
    targetValue = 10
    sortOrder = 1
    isActive = $true
  }
  Assert-True $metric.id "Metric was not created."

  $entry = Invoke-Json Post "/api/metrics/$($metric.id)/entries" @{
    value = 8
    recordedAt = (Get-Date).ToUniversalTime().ToString("o")
    notes = "QA entry"
  }
  Assert-True $entry.id "Metric entry was not created."

  $entries = Invoke-Json Get "/api/metrics/$($metric.id)/entries"
  Assert-True ($entries.Count -ge 1) "Metric entries were not listed."

  $weeklyReview = Invoke-Json Post "/api/reviews/weekly/generate"
  Assert-True ($weeklyReview.type -eq "Weekly") "Weekly review was not generated."
  $monthlyReview = Invoke-Json Post "/api/reviews/monthly/generate"
  Assert-True ($monthlyReview.type -eq "Monthly") "Monthly review was not generated."

  $suggestions = Invoke-Json Get "/api/dashboard/suggestions"
  Assert-True ($null -ne $suggestions) "Suggestions endpoint failed."
  $progress = Invoke-Json Get "/api/dashboard/progress"
  Assert-True ($null -ne $progress) "Progress endpoint failed."

  Invoke-WebRequest -Uri "$baseUrl/api/backup/export" -DisableKeepAlive -OutFile $exportPath -UseBasicParsing -TimeoutSec 20 | Out-Null
  Assert-True (Test-Path -LiteralPath $exportPath) "Backup export did not create a ZIP file."
  $validation = (& curl.exe --fail --silent --show-error -X POST -F "file=@$exportPath" "$baseUrl/api/backup/validate") | ConvertFrom-Json
  Assert-True $validation.isValid "Backup validation failed."

  [pscustomobject]@{
    status = "passed"
    lifeAreaId = $area.id
    goalId = $goal.id
    activityId = $activity.id
    metricId = $metric.id
    backupBytes = (Get-Item -LiteralPath $exportPath).Length
  } | ConvertTo-Json -Compress
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }

  if (Test-Path -LiteralPath $stderrPath) {
    $stderr = Get-Content -LiteralPath $stderrPath -Raw
    if (-not [string]::IsNullOrWhiteSpace($stderr)) {
      Write-Error $stderr
    }
  }
}
