# AGENTS.md

## Cursor Cloud specific instructions

### Overview
G-Tower is a full-stack tower fleet management system (Express backend + React/Vite frontend + PostgreSQL). All three services run via Docker Compose in development.

### Running the dev environment
```bash
sudo docker compose -f docker-compose.dev.yml up -d
```
Backend: http://localhost:3000, Frontend: http://localhost:5173

### Key caveats
- Docker requires `sudo` in the Cloud Agent VM (user is not in docker group by default after fresh setup).
- The `.env.dev` file (gitignored) must exist at the repo root before starting Docker Compose. See `.env.example` for the template. Critical variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- Two source files (`backend/src/services/lifecycleService.ts` and `backend/src/services/storage/localStorageDriver.ts`) are referenced by existing code but were not committed to the repo. They were created during setup — if they are missing, the backend will crash on startup with `MODULE_NOT_FOUND`.
- The backend container mounts `./backend` as a volume, so local file changes are picked up by `tsx watch` automatically (hot-reload).
- The frontend Vite dev server proxies `/api` requests to `http://localhost:3000` (configured in `vite.config.ts`). No CORS issues in dev.
- PostgreSQL init scripts (`init.sql`, `seed.sql`) only run on a fresh volume. To re-seed: `sudo docker compose -f docker-compose.dev.yml down -v && sudo docker compose -f docker-compose.dev.yml up -d`.

### Tests
```bash
cd backend && npm run test          # runs smoke + storage integration tests
cd backend && npm run test:smoke    # API smoke tests only
cd backend && npm run test:storage  # document storage integration test
```
Tests run against the live backend at `http://localhost:3000` (containers must be up).

### TypeScript checks
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### Build
```bash
cd frontend && npm run build    # Vite production build
cd backend && npm run build     # TypeScript compilation
```

### Seed credentials
- admin@gtower.local / admin123 (admin role)
- operator@gtower.local / operator123
- service@gtower.local / service123
- viewer@gtower.local / viewer123
