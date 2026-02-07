# G-Tower

Tower-Management-System mit Backend (Express/TypeScript), Frontend (React/Vite) und PostgreSQL.

## Environment Setup

### Development

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

1. `.env` mit echten Secrets befüllen (`JWT_SECRET`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `CORS_ORIGINS`).
2. Container mit **nur** der Basis-Datei starten:
   ```bash
   docker compose -f docker-compose.yml up -d
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

`backend/seed.sql` enthält Testbenutzer und Beispieldaten. Diese Datei wird **nur in Development** geladen (via `docker-compose.override.yml`) und darf niemals in Produktion verwendet werden.
