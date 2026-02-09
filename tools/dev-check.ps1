# ======================================
# G-TOWER DEV ENV CHECK (WINDOWS)
# ======================================

$ErrorActionPreference = "Continue"

Write-Host "======================================"
Write-Host " G-TOWER DEV ENV CHECK (WINDOWS)"
Write-Host "======================================"
Write-Host ""

$Timestamp   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$ProjectRoot = Get-Location

Write-Host "Timestamp   : $Timestamp"
Write-Host "ProjectRoot : $ProjectRoot"
Write-Host ""

# --------------------------------------
# 1. GIT STATUS
# --------------------------------------
Write-Host "---- GIT STATUS ----"
if (Test-Path ".git") {
    try {
        git status -sb
        git log -1 --oneline
    } catch {
        Write-Host "GIT ERROR"
    }
} else {
    Write-Host "No git repository found"
}
Write-Host ""

# --------------------------------------
# 2. ENV FILE CHECK
# --------------------------------------
Write-Host "---- ENV FILES ----"
$envFiles = @(".env", ".env.dev", ".env.local")
foreach ($f in $envFiles) {
    if (Test-Path $f) {
        Write-Host "FOUND $f"
    }
}
Write-Host ""

# --------------------------------------
# 3. DOCKER AVAILABILITY
# --------------------------------------
Write-Host "---- DOCKER CHECK ----"
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker version --format '{{.Server.Version}}' | Out-Null
        Write-Host "Docker available"
    } catch {
        Write-Host "Docker installed but not running"
    }
} else {
    Write-Host "Docker not installed"
}
Write-Host ""

# --------------------------------------
# 4. DOCKER CONTAINERS
# --------------------------------------
Write-Host "---- DOCKER CONTAINERS ----"
try {
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
} catch {
    Write-Host "Docker ps failed"
}
Write-Host ""

# --------------------------------------
# 5. DOCKER COMPOSE
# --------------------------------------
Write-Host "---- DOCKER COMPOSE ----"
if ((Test-Path "docker-compose.yml") -or (Test-Path "docker-compose.dev.yml")) {
    try {
        docker compose ps
    } catch {
        Write-Host "docker compose ps failed"
    }
} else {
    Write-Host "No docker-compose file found"
}
Write-Host ""

# --------------------------------------
# 6. BACKEND HEALTH CHECK
# --------------------------------------
Write-Host "---- BACKEND HEALTH ----"
$backendPorts = @(3000, 4000, 8080)
foreach ($p in $backendPorts) {
    try {
        $r = Invoke-WebRequest "http://localhost:$p/api/health" -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            Write-Host "Backend OK on port $p"
        }
    } catch {
        # silent
    }
}
Write-Host ""

# --------------------------------------
# 7. FRONTEND CHECK
# --------------------------------------
Write-Host "---- FRONTEND CHECK ----"
$frontendPorts = @(5173, 5174, 3001)
foreach ($p in $frontendPorts) {
    try {
        $r = Invoke-WebRequest "http://localhost:$p" -TimeoutSec 2
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
            Write-Host "Frontend reachable on port $p"
        }
    } catch {
        # silent
    }
}
Write-Host ""

# --------------------------------------
# 8. DATABASE CHECK (PostgreSQL via Docker)
# --------------------------------------
Write-Host "---- DATABASE CHECK ----"
try {
    docker compose exec db pg_isready | Out-Null
    Write-Host "PostgreSQL reachable"
} catch {
    Write-Host "PostgreSQL not reachable"
}
Write-Host ""

# --------------------------------------
# 9. LOG CHECK
# --------------------------------------
Write-Host "---- LOG CHECK (last 50 lines) ----"
try {
    $logs   = docker compose logs --tail=50 2>&1
    $errors = $logs | Select-String -Pattern "error|exception|fatal" -CaseSensitive:$false

    if ($errors) {
        Write-Host "Errors found in logs:"
        $errors
    } else {
        Write-Host "No errors found in logs"
    }
} catch {
    Write-Host "Log check failed"
}
Write-Host ""

# --------------------------------------
# 10. DEV STATE FILE
# --------------------------------------
Write-Host "---- DEV STATE ----"
if (Test-Path "DEV_STATE.md") {
    Write-Host "DEV_STATE.md found"
} else {
    Write-Host "DEV_STATE.md missing"
}
Write-Host ""

Write-Host "======================================"
Write-Host " DEV CHECK END"
Write-Host "======================================"
