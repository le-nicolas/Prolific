param(
    [string]$TaskName = "ProlificStartup",
    [int]$Port = 8090
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$pythonExe = (Get-Command python -ErrorAction Stop).Source
$pythonwExe = Join-Path (Split-Path $pythonExe -Parent) "pythonw.exe"
if (-not (Test-Path $pythonwExe)) {
    $pythonwExe = $pythonExe
}

$trayScript = Join-Path $root "tray_app.py"
$arguments = "`"$trayScript`" --port $Port"

$action = New-ScheduledTaskAction `
    -Execute $pythonwExe `
    -Argument $arguments `
    -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -ErrorAction Stop `
        -Force | Out-Null
} catch {
    throw "Failed to register scheduled task. Try running PowerShell as Administrator or check local Task Scheduler policy. Original error: $($_.Exception.Message)"
}

Write-Host "Installed scheduled task '$TaskName'."
Write-Host "Action: $pythonwExe $arguments"
