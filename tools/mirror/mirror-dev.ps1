param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ==============================
# CONFIG
# ==============================
$SERVER     = "root@qtower.workteams.eu"
$REMOTE_DIR = "/opt/g-tower"

$DB_SERVICE = "gtower-db"
$DB_NAME    = "gtower"
$DB_USER    = "gtower"

$UPLOAD_VOL = "g-tower_backend_uploads"

$TMP_ROOT   = Join-Path (Get-Location) "tmp"
$TMP_EXPORT = Join-Path $TMP_ROOT "upload-export"
$TMP_TAR    = Join-Path $TMP_EXPORT "uploads.tar"

# ==============================
# HELPERS
# ==============================
function Run($Cmd) {
    if ($DryRun) {
        Write-Host "[DRY-RUN] $Cmd"
    } else {
        Write-Host "[RUN] $Cmd"
        Invoke-Expression $Cmd
    }
}

function Abort($Msg) {
    Write-Host ""
    Write-Host "ABBRUCH: $Msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "======================================"
Write-Host " G-TOWER DEV -> LINUX MIRROR"
Write-Host "======================================"
if ($DryRun) { Write-Host "MODE: DRY-RUN" }
Write-Host ""

# ==============================
# 0. SAFETY CHECKS
# ==============================
if ($SERVER -match "prod|production") {
    Abort "SERVER sieht nach PROD aus"
}

if (!(Test-Path ".git")) {
    Abort "Nicht im Projekt-Root"
}

if (!(Test-Path ".env.dev")) {
    Abort ".env.dev fehlt"
}

$rsyncCheck = wsl -d Ubuntu which rsync 2>$null
if (-not $rsyncCheck) {
    Abort "rsync fehlt in Ubuntu-WSL (sudo apt install rsync)"
}

$envProd = ssh $SERVER "test -f $REMOTE_DIR/.env.prod; echo `$?"
if ($envProd -eq "0") {
    Abort ".env.prod auf Server gefunden"
}

$nodeEnv = ssh $SERVER "grep '^NODE_ENV=' $REMOTE_DIR/.env.dev 2>/dev/null"
if ($nodeEnv -match "production") {
    Abort "NODE_ENV=production in .env.dev"
}

Write-Host "Safety checks OK"
Write-Host ""

# ==============================
# 1. GIT SYNC
# ==============================
Run "git add ."

$gitStatus = git status --porcelain
if ($gitStatus) {
    Run "git commit -m `"mirror: dev sync`""
    try {
        Run "git push"
    } catch {
        Run "git push --set-upstream origin HEAD"
    }
} else {
    Write-Host "No git changes"
}

# ==============================
# 2. ENV SYNC
# ==============================
Run "scp .env.dev ${SERVER}:${REMOTE_DIR}/.env.dev"

# ==============================
# 3. DATABASE DUMP
# ==============================
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DumpFile  = "gtower_dev_$Timestamp.sql"

Run "docker compose exec $DB_SERVICE pg_dump -U $DB_USER $DB_NAME > $DumpFile"
Run "ssh ${SERVER} `"mkdir -p ${REMOTE_DIR}/db-dumps`""
Run "scp $DumpFile ${SERVER}:${REMOTE_DIR}/db-dumps/"

if (!$DryRun -and (Test-Path $DumpFile)) {
    Remove-Item $DumpFile -Force
}

# ==============================
# 4. EXPORT UPLOAD VOLUME
# ==============================
if (Test-Path $TMP_EXPORT) {
    Remove-Item $TMP_EXPORT -Recurse -Force
}
if (!(Test-Path $TMP_ROOT)) {
    New-Item -ItemType Directory -Path $TMP_ROOT | Out-Null
}
New-Item -ItemType Directory -Path $TMP_EXPORT | Out-Null

Run "docker run --rm -v ${UPLOAD_VOL}:/data -v `"$TMP_EXPORT`":/backup alpine sh -c `"cd /data; tar cf /backup/uploads.tar .`""

# ==============================
# 5. RSYNC VIA WSL
# ==============================
$TMP_EXPORT_WSL = "/mnt/" + ($TMP_EXPORT -replace ":", "" -replace "\\", "/")

Run "wsl -d Ubuntu tar xf $TMP_EXPORT_WSL/uploads.tar -C $TMP_EXPORT_WSL"
Run "wsl -d Ubuntu rsync -avz --delete $TMP_EXPORT_WSL/ ${SERVER}:/var/lib/docker/volumes/${UPLOAD_VOL}/_data/"

# ==============================
# 6. REMOTE UPDATE
# ==============================
Run "ssh ${SERVER} `"git -C ${REMOTE_DIR} pull`""

$restore = ssh $SERVER "test -x ${REMOTE_DIR}/tools/mirror/restore-db.sh; echo `$?"
if ($restore -eq "0") {
    Run "ssh ${SERVER} `"bash ${REMOTE_DIR}/tools/mirror/restore-db.sh`""
}

Run "ssh ${SERVER} `"docker compose -f ${REMOTE_DIR}/docker-compose.yml up -d`""

Write-Host ""
Write-Host "======================================"
Write-Host " MIRROR DONE (DEV ONLY)"
Write-Host "======================================"
