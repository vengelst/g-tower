#!/usr/bin/env bash
set -e

echo "======================================"
echo " G-TOWER DEV ENVIRONMENT CHECK"
echo "======================================"

fail() {
  echo "❌ $1"
  exit 1
}

ok() {
  echo "✅ $1"
}

# 1️⃣ Docker vorhanden
command -v docker >/dev/null 2>&1 || fail "Docker ist nicht installiert"
ok "Docker installiert"

command -v docker compose >/dev/null 2>&1 || fail "Docker Compose fehlt"
ok "Docker Compose vorhanden"

# 2️⃣ Wichtige Dateien
[ -f docker-compose.dev.yml ] || fail "docker-compose.dev.yml fehlt"
ok "docker-compose.dev.yml vorhanden"

[ -f .env.dev ] || fail ".env.dev fehlt"
ok ".env.dev vorhanden"

# 3️⃣ DEV-Container laufen?
docker compose -f docker-compose.dev.yml ps >/dev/null 2>&1 || fail "docker-compose.dev.yml ungültig"
ok "docker-compose.dev.yml syntaktisch ok"

# 4️⃣ Container Status prüfen
for c in gtower-db gtower-backend gtower-frontend; do
  docker ps --format '{{.Names}}' | grep -q "^$c$" || fail "Container $c läuft nicht"
  ok "Container $c läuft"
done

# 5️⃣ Backend-Port erreichbar
if ! curl -s http://localhost:3000/api/health | grep -q "ok"; then
  fail "Backend Health-Check fehlgeschlagen (http://localhost:3000/api/health)"
fi
ok "Backend Health-Check ok"

# 6️⃣ Frontend DEV erreichbar
if ! curl -s http://localhost:5173 >/dev/null; then
  fail "Frontend DEV nicht erreichbar (http://localhost:5173)"
fi
ok "Frontend DEV erreichbar"

# 7️⃣ DB erreichbar
docker exec gtower-db pg_isready -U postgres >/dev/null 2>&1 \
  || fail "Postgres nicht erreichbar"
ok "Postgres erreichbar"

# 8️⃣ Upload-Volume vorhanden
docker volume inspect g-tower_backend_uploads >/dev/null 2>&1 \
  || fail "Upload-Volume fehlt"
ok "Upload-Volume vorhanden"

# 9️⃣ node_modules in Containern
docker exec gtower-backend test -d /app/node_modules \
  || fail "Backend node_modules fehlen (Volume Problem)"
ok "Backend node_modules ok"

docker exec gtower-frontend test -d /app/node_modules \
  || fail "Frontend node_modules fehlen (Volume Problem)"
ok "Frontend node_modules ok"

# 🔟 Backend hört auf 0.0.0.0
docker exec gtower-backend netstat -tulpn 2>/dev/null | grep -q ":3000" \
  || fail "Backend hört nicht auf Port 3000"
ok "Backend hört auf Port 3000"

echo "======================================"
echo " 🎉 DEV-UMGEBUNG IST KORREKT EINGERICHTET"
echo "======================================"
