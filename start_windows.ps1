param(
    [int]$Port = 8080,
    [int]$FallbackPort = 8090,
    [int]$IdleSeconds = 300,
    [switch]$NoBrowser,
    [int]$ServerReadyTimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    throw "python was not found in PATH."
}
$pythonExe = $pythonCmd.Source

function Get-PythonProcessByPattern {
    param([string]$Pattern)
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*$Pattern*" }
}

function Start-ProlificComponent {
    param(
        [string]$DisplayName,
        [string[]]$Arguments,
        [string]$CommandPattern
    )

    $existing = Get-PythonProcessByPattern -Pattern $CommandPattern | Select-Object -First 1
    if ($existing) {
        Write-Host "$DisplayName already running (PID $($existing.ProcessId))."
        return $null
    }

    $proc = Start-Process `
        -FilePath $pythonExe `
        -ArgumentList $Arguments `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "Started $DisplayName (PID $($proc.Id))."
    return $proc
}

function Wait-ServerReady {
    param(
        [int]$ServerPort,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $res = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$ServerPort/index.html" -TimeoutSec 3
            if ($res.StatusCode -eq 200) {
                return $true
            }
        } catch {
            # Keep waiting until timeout.
        }
        Start-Sleep -Milliseconds 800
    }
    return $false
}

function Test-PortInUse {
    param([int]$LocalPort)

    if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
        return $false
    }

    try {
        $listeners = Get-NetTCPConnection -State Listen -LocalPort $LocalPort -ErrorAction SilentlyContinue
        return ($listeners | Measure-Object).Count -gt 0
    } catch {
        return $false
    }
}

function Ensure-ProlificServerPort {
    param([int]$DesiredPort)

    $serverPattern = "server.py $DesiredPort"
    $existing = Get-PythonProcessByPattern -Pattern $serverPattern | Select-Object -First 1
    if ($existing) {
        Write-Host "Server already running on port $DesiredPort (PID $($existing.ProcessId))."
        return $true
    }

    if (Test-PortInUse -LocalPort $DesiredPort) {
        return $false
    }

    Write-Host "Ensuring server is running on port $DesiredPort..."
    Start-ProlificComponent `
        -DisplayName "server" `
        -Arguments @("server.py", "$DesiredPort") `
        -CommandPattern $serverPattern | Out-Null

    return $true
}

Write-Host "Ensuring collector is running..."
Start-ProlificComponent `
    -DisplayName "collector" `
    -Arguments @("prolific.py", "start", "--idle-seconds", "$IdleSeconds") `
    -CommandPattern "prolific.py start" | Out-Null

$activeServerPort = $null
if (Ensure-ProlificServerPort -DesiredPort $Port) {
    $activeServerPort = $Port
} elseif ($FallbackPort -ne $Port) {
    Write-Host "Port $Port is already in use by another process; trying fallback port $FallbackPort."
    if (Ensure-ProlificServerPort -DesiredPort $FallbackPort) {
        $activeServerPort = $FallbackPort
    } else {
        Write-Host "Fallback port $FallbackPort is also in use by another process; skipping server startup."
    }
} else {
    Write-Host "Port $Port is already in use by another process; skipping server startup."
}

if (-not $NoBrowser) {
    if ($activeServerPort -and (Wait-ServerReady -ServerPort $activeServerPort -TimeoutSeconds $ServerReadyTimeoutSeconds)) {
        Start-Process "http://localhost:$activeServerPort"
        Write-Host "Opened dashboard: http://localhost:$activeServerPort"
    } elseif (-not $activeServerPort) {
        Write-Host "No available server port found; browser launch skipped."
    } else {
        Write-Host "Server did not become ready within $ServerReadyTimeoutSeconds seconds."
    }
}
