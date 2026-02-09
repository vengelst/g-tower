$ErrorActionPreference = 'Stop'

function Fail($message) {
  Write-Host ("FAIL: " + $message)
  exit 1
}

function Ok($message) {
  Write-Host ("OK: " + $message)
}

function PsqlScalar([string]$sql) {
  $out = docker exec gtower-db psql -U gtower -d gtower -tA -c $sql
  return ($out | Out-String).Trim()
}

function LoginToken() {
  $login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body (@{
      email    = 'admin@gtower.local'
      password = 'admin123'
    } | ConvertTo-Json)
  if ([string]::IsNullOrWhiteSpace($login.token)) { Fail "Login token missing" }
  return $login.token
}

function CurlHead([string]$url, [string]$token) {
  $hdr = "Authorization: Bearer $token"
  return (curl.exe -s -I -H $hdr $url | Out-String)
}

function CurlGet([string]$url, [string]$token) {
  $hdr = "Authorization: Bearer $token"
  return (curl.exe -s -f -H $hdr $url | Out-String)
}

# --- Testblock 1: Basics ---
$health = curl.exe -s -i http://localhost:3000/api/health | Out-String
if ($health -notmatch 'HTTP/\S+ 200') { Fail "Backend health not 200" }
Ok "Backend reachable (/api/health)"

$seedCount = [int](PsqlScalar "SELECT COUNT(*) FROM towers WHERE serial_number LIKE 'GT-SEED-%';")
if ($seedCount -ne 500) { Fail "Seed tower count expected 500, got $seedCount" }
Ok "Seed tower count = 500"

$distributionSql = @"
SELECT lifecycle_status, COUNT(*)
FROM towers
WHERE serial_number LIKE 'GT-SEED-%'
GROUP BY lifecycle_status
ORDER BY lifecycle_status;
"@
$dist = docker exec gtower-db psql -U gtower -d gtower -P pager=off -c $distributionSql | Out-String
$expected = @{
  production      = 40
  delivery        = 40
  storage         = 120
  rented          = 180
  return_delivery = 20
  repair          = 40
  reconditioning  = 30
  end_of_life     = 20
  scrapped        = 10
}
foreach ($k in $expected.Keys) {
  if ($dist -notmatch ("(?m)^\s*" + [Regex]::Escape($k) + "\s*\|\s*" + $expected[$k] + "\s*$")) {
    Fail "Lifecycle distribution mismatch for $k"
  }
}
Ok "Lifecycle distribution matches expected counts"

# --- Testblock 2: Scheduler & Idempotence ---
$recentSystem = [int](PsqlScalar "SELECT COUNT(*) FROM tower_status_history WHERE source='system' AND changed_at > NOW() - INTERVAL '5 minutes';")
Ok "Recent system status-history (last 5 minutes) = $recentSystem"

$t0 = (PsqlScalar "SELECT now();")
$prev = 0
$deltas = @()
foreach ($run in 1..3) {
  Start-Sleep -Seconds 70
  $c = [int](PsqlScalar ("SELECT COUNT(*) FROM tower_status_history WHERE source='system' AND changed_at > '" + $t0 + "';"))
  $delta = $c - $prev
  $deltas += $delta
  $prev = $c
}
Ok ("Scheduler idempotence deltas after t0: " + ($deltas -join ", "))

$lifecycleSystem = [int](PsqlScalar "SELECT COUNT(*) FROM tower_lifecycle_history WHERE source='system';")
if ($lifecycleSystem -ne 0) { Fail "Lifecycle system entries expected 0, got $lifecycleSystem" }
Ok "No lifecycle-history written by system"

# --- Testblock 3: Protection rules ---
$protected = [int](PsqlScalar "SELECT COUNT(*) FROM towers WHERE status IN ('maintenance','decommissioned') AND updated_at > NOW() - INTERVAL '5 minutes';")
if ($protected -ne 0) { Fail "Protected statuses updated recently (expected 0), got $protected" }
Ok "Maintenance/decommissioned unchanged recently"

$scrappedRecent = [int](PsqlScalar "SELECT COUNT(*) FROM tower_lifecycle_history h JOIN towers t ON t.id=h.tower_id WHERE t.lifecycle_status='scrapped' AND h.changed_at > NOW() - INTERVAL '1 hour';")
if ($scrappedRecent -ne 0) { Fail "Scrapped towers had lifecycle changes recently (expected 0), got $scrappedRecent" }
Ok "Scrapped is final (no recent lifecycle changes)"

# --- Testblock 4: API regression ---
$seedId = PsqlScalar "SELECT id FROM towers WHERE serial_number LIKE 'GT-SEED-%' ORDER BY serial_number LIMIT 1;"
if ([string]::IsNullOrWhiteSpace($seedId)) { Fail "No seed tower id found" }
$token = LoginToken

$statusJson = Invoke-RestMethod -Method Get -Uri ("http://localhost:3000/api/towers/$seedId/status-history?limit=10") -Headers @{ Authorization = "Bearer $token" }
if ($null -eq $statusJson.pagination) { Fail "status-history missing pagination" }
foreach ($s in @($statusJson.data | ForEach-Object { $_.source } | Select-Object -Unique)) {
  if ($s -notin @('manual', 'system')) { Fail "Unexpected status-history source: $s" }
}
Ok "Status-history endpoint returns 200 + pagination"

$lifeJson = Invoke-RestMethod -Method Get -Uri ("http://localhost:3000/api/towers/$seedId/lifecycle-history?limit=10") -Headers @{ Authorization = "Bearer $token" }
if ($null -eq $lifeJson.pagination) { Fail "lifecycle-history missing pagination" }
$allowed = @{
  production      = @('delivery')
  delivery        = @('storage', 'rented')
  storage         = @('rented', 'reconditioning', 'end_of_life')
  rented          = @('return_delivery', 'repair')
  return_delivery = @('storage', 'repair', 'reconditioning')
  repair          = @('reconditioning', 'storage', 'end_of_life')
  reconditioning  = @('storage', 'rented')
  end_of_life     = @('scrapped')
  scrapped        = @()
}
$prevTs = $null
foreach ($row in @($lifeJson.data)) {
  if ($null -ne $row.old_status -and -not $allowed.ContainsKey($row.old_status)) { Fail "Unknown lifecycle old_status: $($row.old_status)" }
  if (-not $allowed.ContainsKey($row.new_status)) { Fail "Unknown lifecycle new_status: $($row.new_status)" }
  if ($null -ne $row.old_status -and $row.old_status -ne $row.new_status) {
    if (-not ($allowed[$row.old_status] -contains $row.new_status)) { Fail "Invalid lifecycle transition: $($row.old_status) -> $($row.new_status)" }
  }
  $ts = [DateTime]::Parse($row.changed_at)
  if ($null -ne $prevTs -and $ts -gt $prevTs) { Fail "Lifecycle history not in DESC order" }
  $prevTs = $ts
}
Ok "Lifecycle-history endpoint returns 200 + valid transitions + correct order"

$h1 = CurlHead ("http://localhost:3000/api/towers/$seedId/lifecycle-history/export?format=json") $token
if ($h1 -notmatch 'HTTP/\S+ 200') { Fail "Lifecycle export not 200" }
if ($h1 -notmatch '(?im)^Content-Type:\s*application/json') { Fail "Lifecycle export content-type mismatch" }
$h2 = CurlHead ("http://localhost:3000/api/towers/$seedId/status-history/export?format=csv") $token
if ($h2 -notmatch 'HTTP/\S+ 200') { Fail "Status export not 200" }
if ($h2 -notmatch '(?im)^Content-Type:\s*text/csv') { Fail "Status export content-type mismatch" }
Ok "Export endpoints respond 200 with expected content-type"

# --- Testblock 5: Performance (Map via mode=map) ---
$ms = (Measure-Command { curl.exe -s -o NUL -H ("Authorization: Bearer $token") "http://localhost:3000/api/towers?mode=map" }).TotalMilliseconds
$ms = [math]::Round($ms, 2)
if ($ms -ge 100) { Fail "Map endpoint took ${ms}ms (expected < 100ms)" }
Ok "Map endpoint time = ${ms}ms (< 100ms)"

# --- Extras: duplicates + log scan ---
$dups = [int](PsqlScalar "SELECT COUNT(*) FROM (SELECT tower_id, old_status, new_status, source, reason, changed_at, COUNT(*) c FROM tower_status_history GROUP BY tower_id, old_status, new_status, source, reason, changed_at HAVING COUNT(*) > 1) d;")
if ($dups -ne 0) { Fail "Duplicate status-history rows found: $dups" }
Ok "No duplicate status-history rows"

$logMatches = docker compose logs --no-color --tail 400 backend | findstr /i /c:"fatal" /c:"unhandled" /c:"exception" /c:"error"
if ($LASTEXITCODE -eq 0) { Fail "Backend logs contain error keywords in last 400 lines" }
Ok "No error keywords in last 400 backend log lines"

Write-Host "PASS: Phase-3 + Lifecycle automated checks complete"

