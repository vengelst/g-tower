<!--
  README.md – Projektübersicht und Setup-Anleitung für G-Tower
  =============================================================================
  Zweck:         Einstiegspunkt für neue Entwickler. Erklärt Architektur,
                 Setup (Dev + Prod) und die wichtigsten Konventionen.
  Rolle:         Dokumentation im Repository-Root. Wird von GitHub/GitLab
                 automatisch auf der Projektseite angezeigt.
  Abhängigkeiten: Docker, Docker Compose, .env-Datei
  Wichtige Annahmen:
    - Entwickler nutzen Docker für den lokalen Betrieb
    - Produktion nutzt ausschließlich docker-compose.yml (ohne Override)
    - Seed-Daten (seed.sql) werden NIE in Produktion geladen
  Änderungshinweise:
    - Bei neuen Features/Phasen hier die Architektur-Übersicht erweitern
    - Keine Secrets oder interne URLs in diese Datei schreiben
-->

# G-Tower

<!-- Kurzbeschreibung: Was ist dieses Projekt? -->
Tower-Management-System mit Backend (Express/TypeScript), Frontend (React/Vite) und PostgreSQL.

<!-- Architektur-Übersicht:
  - 3 Docker-Container: postgres, backend, frontend
  - Backend: REST-API mit RBAC (4 Rollen: viewer, service, operator, admin)
  - Frontend: React SPA mit Leaflet-Karte, Tailwind CSS
  - Zwei Status-Dimensionen pro Tower:
    1. Operativer Status (active, warning, critical, offline, maintenance, decommissioned)
       → wird durch Scheduler/System-Checks und manuelle Änderungen gesetzt
    2. Lifecycle-Status (production, delivery, storage, rented, return_delivery,
       repair, reconditioning, end_of_life, scrapped)
       → bildet den wirtschaftlichen Lebenslauf ab, wird nur manuell geändert
    Beide Dimensionen existieren unabhängig voneinander.
-->

## Environment Setup

## Development vs Production

- DEV (lokal): `docker compose up -d` → Frontend `http://localhost:5173` (Vite), Backend `http://localhost:3000`
- PROD (lokal/prod-like): `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` → Frontend `http://localhost` (nginx)

### Development

<!-- Dev-Setup: Alle drei Container mit Hot-Reload und Testdaten -->
1. `.env` aus Vorlage erstellen und Werte eintragen:
   ```bash
   cp .env.example .env
   ```
2. Container starten (inkl. Seed-Daten, Hot-Reload):
   ```bash
   docker compose up -d
   ```
   `docker-compose.override.yml` wird automatisch gemergt und aktiviert:
   - Dev-Targets (`tsx watch`, `vite --host`)
   - Seed-Daten aus `seed.sql`
   - DB-Port `5432` exposed
   - Source-Volumes für Hot-Reload

   Frontend: `http://localhost:5173` | Backend: `http://localhost:3000`

### Production

<!-- Prod-Setup: Optimierte Images, keine Testdaten, strikte Secret-Validierung -->
1. `.env` mit echten Secrets befüllen (`JWT_SECRET`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `CORS_ORIGINS`).
2. Container im Production-Modus starten:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
   Prod-Modus:
   - Multi-Stage Builds (kompiliertes JS, nginx statt Vite)
   - `npm ci --omit=dev` (keine Dev-Dependencies)
   - Non-root User im Backend-Container
   - DB-Port nicht exposed
   - Kein Seed, kein Hot-Reload
   - `NODE_ENV=production` (Startup bricht ab bei fehlenden Secrets)

   Frontend: `http://localhost` (Port 80) | Backend intern auf Port 3000

## Seed-Daten

<!-- WICHTIG: Seed-Daten enthalten Klartextpasswörter und dürfen nur in Dev genutzt werden.
     seed.sql wird über docker-compose.override.yml als 02_seed.sql eingebunden.
     Zusätzlich existiert backend/scripts/seed_500_towers.ts für 500 generierte Türme
     (ebenfalls NUR für Dev/Staging, enthält Prod-Guard). -->
`backend/seed.sql` enthält Testbenutzer und Beispieldaten. Diese Datei wird **nur in Development** geladen (via `docker-compose.override.yml`) und darf niemals in Produktion verwendet werden.

## Running Smoke Tests

Backend-Smoke-Tests für die CRITICAL-API-Routen (Login, Me, Towers):

```bash
docker compose up -d
cd backend
npm test
```

In Docker (Dev-Container):

```bash
docker compose up -d
docker compose exec backend npm test
```

Hinweis: Die Tests erwarten Seed-Daten (z. B. `admin@gtower.local` / `admin123`) und mindestens einen Tower.

## CI Smoke Tests

GitHub Actions führt bei `push` und `pull_request` automatisch die Backend-Smoke-Tests aus:

- Workflow: `.github/workflows/smoke-tests.yml`
- Ablauf: `docker compose up -d` (DB + Backend) → Warten auf `/api/health` → `cd backend && npm test`

## Storage (DEV Local FS / PROD S3)

Das Backend speichert **keine BLOBs** in der Datenbank. In der DB liegen nur Metadaten (`documents`), die Dateien liegen im Storage.

### Konfiguration (ENV)

- `STORAGE_DRIVER=local|s3` (Default: `local`)

**Local (DEV)**
- `LOCAL_STORAGE_ROOT` (Default: `UPLOAD_DIR` falls gesetzt, sonst `/data/uploads`)
- Ablage: `towers/{tower_id}/{images|documents}/{uuid}.{ext}` (unterhalb von `LOCAL_STORAGE_ROOT`)

**S3 (PROD)**
- `S3_ENDPOINT` (optional, für MinIO/S3-kompatibel)
- `S3_BUCKET` (required)
- `S3_ACCESS_KEY` (required)
- `S3_SECRET_KEY` (required)
- `S3_REGION` (optional)
- Key-Format: `towers/{tower_id}/{images|documents}/{uuid}.{ext}`

### Upload/Download Flow (Dokumente)

- Upload: `POST /api/documents` (multipart/form-data) → Datei wird im Storage gespeichert → DB speichert Metadaten + `file_path` (Storage-Key)
- Download: `GET /api/documents/:id/download` → Auth/RBAC wie bisher → Datei wird aus dem Storage **gestreamt** (kein Presigned URL)

### Thumbnails (nur Images)

Bei Image-Uploads wird zusätzlich ein Thumbnail (~300px Breite) als JPG gespeichert.
Der Thumbnail-Key wird aus dem Original-Key abgeleitet: `<uuid>.thumb.jpg` im selben Ordner.

## Demo Seed (optional)

Große Demo-/Testdaten werden **nicht automatisch** erzeugt. Dafür gibt es ein separates CLI-Skript im Backend:

```bash
cd backend
npm run seed:demo -- --towers=5000 --documents=3000 --tickets=3000 --with-history --with-images
```

Im Docker-Backend (empfohlen, da `DATABASE_URL` in Dev oft auf `postgres` zeigt):

```bash
docker compose up -d
docker compose exec backend npm run seed:demo -- --towers=5000 --documents=3000 --tickets=3000 --with-history --with-images
```

Dry-Run (keine DB- oder Storage-Writes):

```bash
cd backend
npm run seed:demo -- --towers=5000 --documents=3000 --tickets=3000 --with-history --with-images --dry-run
```

Hinweis:
- Nur in Dev/Staging nutzen, **nicht** in Production ausführen.
- Das Skript erwartet, dass die DB bereits initialisiert ist und mind. ein User existiert (z. B. via `seed.sql`).
