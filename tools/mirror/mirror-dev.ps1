param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ==================================================
# CONFIG
# ==================================================
$SERVER     = "root@qtower.workteams.eu"        # DEV SERVER
$REMOTE_DIR = "/opt/g-tower"

$DB_NAME    = "gtower"
$DB_USER    = "gtower"

$UPLOAD_VOL = "g-tower_backend_uploads"

# ==================================================
# HELPERS
# ==================================================
function Run {
    param([string]$Cmd)

    if ($DryRun) {
        Write-Host "[DRY-RUN] $Cmd"
    } else {
        Write-Host "[RUN] $Cmd"
        Invoke-Expression $Cmd
    }
}

function Abort {
    param([string]$Msg)
    Write-Host ""
    Write-Host "ABBRUCH: $Msg"
    Write-Host ""
    exit 1
}

Write-Host "======================================"
Write-Host " G-TOWER DEV -> LINUX MIRROR"
Write-Host "======================================"
if ($DryRun) { Write-Host "MODE: DRY-RUN" }
Write-Host ""

# ==================================================
# 0. SAFETY CHECKS
# ==================================================

# 0.1 Servername darf kein PROD enthalten
if ($SERVER -match "prod|production") {
    Abort "SERVER sieht nach PROD aus: $SERVER"
}

# 0.2 Projekt-Root
if (!(Test-Path ".git")) {
    Abort "Bitte im Projekt-Root ausfuehren"
}

# 0.3 .env.dev vorhanden
if (!(Test-Path ".env.dev")) {
    Abort ".env.dev fehlt"
}

# 0.4 Remote: .env.prod darf NICHT existieren
$envProdCheck = ssh $SERVER "test -f $REMOTE_DIR/.env.prod; echo `$?"
if ($envProdCheck -eq "0") {
    Abort ".env.prod auf Server gefunden"
}

# 0.5 Remote: NODE_ENV Check NUR in .env.dev
$remoteNodeEnv = ssh $SERVER "grep '^NODE_ENV=' $REMOTE_DIR/.env.dev 2>/dev/null"

if ($remoteNodeEnv -match "NODE_ENV=production") {
    Abort "NODE_ENV=production in .env.dev gefunden"
}

Write-Host "Safety checks OK"
Write-Host ""

# ==================================================
# 1. GIT SYNC
# ==================================================
Run "git add ."

$gitStatus = git status --porcelain
if ($gitStatus) {
    Run "git commit -m `"mirror: dev sync`""
    Run "git push"
} else {
    Write-Host "No git changes to commit"
}

# ==================================================
# 2. ENV SYNC (DEV ONLY)
# ==================================================
Run "scp .env.dev ${SERVER}:${REMOTE_DIR}/.env.dev"

# ==================================================
# 3. DATABASE DUMP
# ==================================================
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DumpFile  = "gtower_dev_$Timestamp.sql"

Run "docker compose exec db pg_dump -U $DB_USER $DB_NAME > $DumpFile"
Run "scp $DumpFile ${SERVER}:${REMOTE_DIR}/db-dumps/"

if (!$DryRun -and (Test-Path $DumpFile)) {
    Remove-Item $DumpFile
}

# ==================================================
# 4. UPLOAD VOLUME SYNC
# ==================================================
$UploadVolPath = docker volume inspect $UPLOAD_VOL --format "{{.Mountpoint}}"

if ([string]::IsNullOrEmpty($UploadVolPath)) {
    Abort "Upload-Volume '$UPLOAD_VOL' nicht gefunden"
}

Run "rsync -avz --delete ${UploadVolPath}/ ${SERVER}:${UploadVolPath}/"

# ==================================================
# 5. REMOTE RESTORE (EINZELNE SCHRITTE)
# ==================================================
Run "ssh ${SERVER} `"cd ${REMOTE_DIR}`""
Run "ssh ${SERVER} `"cd ${REMOTE_DIR}; git pull`""
Run "ssh ${SERVER} `"cd ${REMOTE_DIR}; ./tools/mirror/restore-db.sh`""
Run "ssh ${SERVER} `"cd ${REMOTE_DIR}; docker compose up -d`""

Write-Host ""
Write-Host "======================================"
Write-Host " MIRROR DONE (DEV ONLY)"
Write-Host "======================================"
