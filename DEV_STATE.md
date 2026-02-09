# DEV_STATE – G-TOWER / Q-TOWER APP

## 1. Projektüberblick
G‑Tower ist ein Tower‑Management‑System mit REST‑Backend (Express + TypeScript), SPA‑Frontend (React + Vite + Tailwind) und PostgreSQL. Kernobjekt ist der **Tower** mit zwei unabhängigen Zustandsdimensionen:
- **Operativer Status** (`active|warning|critical|offline|maintenance|decommissioned`) – manuell änderbar und zusätzlich durch einen in‑process Scheduler (System‑Checks) verschlechterbar.
- **Lifecycle‑Status** (`production|delivery|storage|rented|return_delivery|repair|reconditioning|end_of_life|scrapped`) – nur manuell änderbar, serverseitig über eine State‑Machine validiert.

Zusätzlich existieren **Service‑Tickets** (tower‑gebunden), **Dokumente** (Upload/Download/Metadaten; Storage lokal oder S3), **Benutzerverwaltung** mit RBAC (4 Rollen) und ein **Audit‑Log** in der DB.

## 2. Architekturübersicht
- **Frontend (Technologie, Status)**
  - React 18 SPA, Routing via `react-router-dom`, UI‑Utilities via Tailwind, Kartenansicht via Leaflet/React‑Leaflet.
  - Auth‑State im `AuthContext` (Token in `localStorage`), Route‑Schutz via `ProtectedRoute` (Frontend‑RBAC als UX‑Guard).
  - API‑Zugriff zentral über `frontend/src/services/api.ts` (fetch‑Wrapper, Token‑Header, 401→Logout, Blob‑Downloads).
  - Status: Kernseiten vorhanden (Login, Dashboard, Towers, Tower‑Detail, Map, Tickets, Dokumente, Users).

- **Backend (Technologie, Status)**
  - Express 4 + TypeScript, klare Schichtung: **Route → Controller → Service → DB**.
  - Input‑Validierung via Zod (`backend/src/schemas.ts`) + `validate` Middleware.
  - Auth via JWT (HS256) + `authMiddleware`, Autorisierung via RBAC‑Middleware (`requireMinRole/requireRoles`).
  - Status: Die Domänen Towers, Tickets, Documents, Users, Auth sind implementiert; Tests existieren (Smoke + Dokument‑Storage Integration).

- **Datenbank (Typ, Schema, Status)**
  - PostgreSQL (Compose), Schema wird über `backend/init.sql` beim **ersten** DB‑Start erstellt (docker‑entrypoint init).
  - Keine Migrations‑Pipeline erkennbar (Schemaänderung erfordert aktuell Volume‑Reset).

- **Docker / Deployment**
  - `docker-compose.yml` (Basis), `docker-compose.override.yml` (Dev‑Overrides: Hot‑Reload + Seed), `docker-compose.prod.yml` (Prod‑Portmapping Frontend), zusätzlich `docker-compose.dev.yml` + `.env.dev` als standardisierter DEV‑Stack.
  - Backend/Frontend sind Multi‑Stage Dockerfiles (dev/prod). Frontend prod läuft via nginx und proxyt `/api/` auf `backend:3000`.

## 3. Implementierte Funktionen
(Nur anhand Code/Schema aufgeführte, tatsächlich vorhandene Funktionalität.)

- **Auth**
  - Login: JWT‑Ausgabe inkl. Rollen (`POST /api/auth/login`)
  - Logout (serverseitig nur Audit/Antwort; JWT‑Invalidierung clientseitig): `POST /api/auth/logout`
  - Current user: `GET /api/auth/me`
  - Brute‑Force‑Schutz: In‑Memory Login‑Rate‑Limit (IP + E‑Mail).

- **RBAC**
  - Rollenmodell: `admin > operator > service > viewer` (Backend enforced; Frontend zusätzlich als UX‑Guard).

- **Tower‑Verwaltung**
  - Tower‑Liste inkl. Filter/Pagination; separater „map“-Modus (bis 2000 Towers mit Koordinaten, ohne Paging).
  - Tower‑Detail: Tower + letzte Status‑Historie + Tickets + Dokumente + Lifecycle‑Historie (parallel geladene Queries im Backend).
  - Create/Update/Delete (Delete ist ein echtes `DELETE FROM towers`).
  - Operativer Status‑Change inkl. History‑Eintrag (Transaktion).
  - Status‑Historie: paginiert, filterbar, CSV/JSON‑Export mit Excel‑BOM + CSV‑Injection‑Escape, Export‑Limit 50k.
  - Tower‑Stats: Gesamtzahl + Gruppierung nach operativem Status.

- **Lifecycle**
  - Serverseitige State‑Machine (Transitions) + Update (Transaktion) + History + Export (CSV/JSON, Export‑Limit 50k).
  - API liefert erlaubte Zielzustände pro Tower (`/lifecycle-transitions`) für UI‑Auswahl.

- **System‑Checks (Scheduler)**
  - In‑process `setInterval` im Backend‑Startup.
  - Regeln auf `towers.config`:
    - `battery_level <= 5` → `critical`
    - `battery_level <= 20` → `warning`
    - `last_heartbeat` älter als `HEARTBEAT_TIMEOUT_MINUTES` (Default 5) → `offline`
  - Überschreibt **keine** geschützten Status (`maintenance`, `decommissioned`) und wendet nur **Verschlechterungen** an (keine Auto‑Recovery).

- **Tickets**
  - Ticket‑Liste (Filter/Pagination), Ticket‑Detail, Create/Update/Delete.
  - Separate Zuweisungs‑Route (`PATCH /api/tickets/:id/assign`).
  - Ticket‑Stats: Gesamtzahl + Gruppierung nach Status und Priorität.

- **Dokumente**
  - Dokument‑Liste (Filter/Pagination), Metadaten‑Detail, Upload, Download (streamed), Delete.
  - Storage‑Abstraktion: `local` oder `s3` Driver.
  - Thumbnails: best‑effort bei Image‑Uploads (~300px, JPG).

- **Audit‑Log**
  - DB‑Tabelle `audit_log` + Helper `createAuditLog()` wird u.a. bei Login/Logout/Failed‑Login genutzt (Fehler im Audit‑Write blockieren die Hauptoperation nicht).

- **Frontend‑Screens**
  - Dashboard: Tower‑Stats + Ticket‑Stats.
  - Towers: Liste + Create‑Modal.
  - Tower‑Detail: Tabs (Details, Status‑Historie inkl. Filter/Export + Audit‑Drawer, Tickets‑Übersicht, Dokument‑Übersicht, Lifecycle‑Historie) + Status/Lifecycle‑Modals.
  - Map: Leaflet‑Karte mit farbcodierten Markern.
  - Tickets: Liste + Create‑Modal + Detail‑Modal (Status/Resolution Update).
  - Dokumente: Liste + Upload‑Modal + Download + Delete (RBAC).
  - Users (Admin): Liste + Create/Edit Modals + „Deaktivieren“ via DELETE.

## 4. Teilweise implementierte / vorbereitete Funktionen
- **Dokument‑Versionierung**
  - Backend: `POST /api/documents/:id/version` existiert.
  - Frontend: Keine UI/Service‑Methode für Version‑Upload; UI zeigt zwar `version`, bietet aber nur Download.

- **Ticket‑Zuweisung**
  - Backend: `PATCH /api/tickets/:id/assign` existiert.
  - Frontend: `ticketService.assign()` existiert, wird in den Pages jedoch nicht genutzt (keine Zuweisungs‑UI erkennbar).

- **Tower‑Stammdaten editieren**
  - Backend: `PUT /api/towers/:id` existiert (Partial Update im Service).
  - Frontend: Es gibt kein erkennbares Edit‑Formular für Tower‑Stammdaten (nur Create sowie Status/Lifecycle‑Änderungen).

- **Multi‑Role Users**
  - Backend/Schema erlauben mehrere Rollen pro User (n:m).
  - Frontend‑User‑UI behandelt effektiv „eine Rolle“ (`roles[0]`), Seed setzt ebenfalls 1 Rolle/User.

- **S3‑Storage**
  - Backend: S3 Driver implementiert und per ENV konfigurierbar.
  - Docker/Infra: Keine S3/MinIO‑Compose‑Definition im Repo (Nutzung nur über externe Infrastruktur/ENV ableitbar).

## 5. Fehlende / noch nicht implementierte Kernfunktionen
(Nur ableitbar aus vorhandenem Code/Struktur – keine Feature‑Spekulation.)
- **Migrations‑Strategie**: Schema ist „init.sql‑only“; es gibt keine versionierten Migrationen/Runner im Repo.
- **Passwort ändern / Passwort‑Reset**: Keine API‑Endpunkte dafür vorhanden; Frontend hat keinen „Passwort vergessen“-Flow.
- **Token Refresh / Session Management**: JWT ist stateless; keine Refresh‑Token/Blacklist‑Mechanik im Code erkennbar.

## 6. API‑Übersicht
Prefix: `/api`

- `GET /health` – Healthcheck (ohne Auth)

**Auth**
- `POST /auth/login` – Login (Rate‑Limit + Zod Body)
- `POST /auth/logout` – Logout (Auth)
- `GET /auth/me` – Current user (Auth)

**Users (Admin‑only)**
- `GET /users` – Liste (Pagination)
- `GET /users/:id` – Detail
- `POST /users` – Create
- `PUT /users/:id` – Update
- `DELETE /users/:id` – Deaktivieren (Soft‑Delete: `is_active=false`)

**Towers (Auth; Write: Operator+)**
- `GET /towers/stats` – Aggregierte Statistiken
- `GET /towers` – Liste (Filter/Pagination; `mode=map` liefert reduzierte Daten)
- `GET /towers/:id` – Detail inkl. „letzte“ History/Tickets/Documents/LifecycleHistory
- `GET /towers/:id/status-history` – Operative Status‑Historie (Filter/Pagination)
- `GET /towers/:id/status-history/export` – Export CSV/JSON
- `POST /towers` – Create
- `PUT /towers/:id` – Update
- `PATCH /towers/:id/status` – Operativer Statuswechsel (History)
- `DELETE /towers/:id` – Delete
- `GET /towers/:id/lifecycle-transitions` – Erlaubte Lifecycle‑Transitions
- `GET /towers/:id/lifecycle-history` – Lifecycle‑Historie (Filter/Pagination)
- `GET /towers/:id/lifecycle-history/export` – Export CSV/JSON
- `PATCH /towers/:id/lifecycle` – Lifecycle‑Statuswechsel (State‑Machine)

**Tickets (Auth; Write: Service+)**
- `GET /tickets/stats` – Aggregierte Statistiken
- `GET /tickets` – Liste (Filter/Pagination)
- `GET /tickets/:id` – Detail
- `POST /tickets` – Create
- `PUT /tickets/:id` – Update
- `PATCH /tickets/:id/assign` – Zuweisung
- `DELETE /tickets/:id` – Delete

**Documents (Auth; Upload: Service+, Delete: Operator+)**
- `GET /documents` – Liste (Filter/Pagination)
- `GET /documents/:id` – Metadaten‑Detail
- `GET /documents/:id/download` – Download (stream)
- `POST /documents` – Upload (multipart)
- `POST /documents/:id/version` – Upload neue Version (Backend vorhanden)
- `DELETE /documents/:id` – Delete (DB + Storage)

## 7. Datenbank‑Analyse
- **Tabellen**
  - `roles`, `users`, `user_roles`
  - `towers`
  - `tower_status_history`
  - `tower_lifecycle_history`
  - `service_tickets`
  - `documents`
  - `audit_log`

- **Relationen (Auszug)**
  - `user_roles.user_id → users.id` (CASCADE), `user_roles.role_id → roles.id` (CASCADE)
  - `towers.created_by → users.id` (SET NULL/NULLABLE)
  - `tower_status_history.tower_id → towers.id` (CASCADE), `changed_by → users.id` (NULLABLE)
  - `tower_lifecycle_history.tower_id → towers.id` (CASCADE), `changed_by → users.id` (NULLABLE)
  - `service_tickets.tower_id → towers.id` (CASCADE), `assigned_to/created_by → users.id`
  - `documents.tower_id → towers.id` (ON DELETE SET NULL), `parent_document_id → documents.id`, `uploaded_by → users.id`
  - `audit_log.user_id → users.id` (NULLABLE)

- **Seed‑Logik**
  - Schema: `backend/init.sql` (einmalig beim initialen DB‑Start).
  - DEV‑Seed: `backend/seed.sql` (wird in Dev‑Compose als `02_seed.sql` eingebunden; nur bei leerem DB‑Volume).
  - Zusätzlich: `backend/scripts/seed-demo.ts` generiert große Demo‑Daten (Towers/Tickets/Docs/Images) und nutzt u.a. `documentService` (Storage‑Writes).

- **Erkennbare Probleme**
  - **Keine Migrationen**: Schema ist nicht versioniert; jede Schemaänderung ist aktuell „Volume löschen“.
  - **Seed‑Drift / Inkonsistenz**:
    - `backend/seed.sql` referenziert ein Script `backend/scripts/seed_500_towers.ts`, das im Repo nicht existiert.
    - In `backend/seed.sql` sind `documents.file_path` als absolute Pfade wie `/app/uploads/seed-doc-XXX.txt` eingetragen; das passt nicht zum Storage‑Key‑Format, das `documentService`/Storage‑Driver tatsächlich erzeugen (`towers/{tower_id}/{images|documents}/{uuid}.{ext}`).
  - **Enums als VARCHAR**: Status-/Lifecycle‑Felder sind `VARCHAR` ohne DB‑CHECK‑Constraints; Validierung passiert primär in der API (Zod/Service‑Logik).

## 8. Bekannte technische Probleme
- **Dokumentation/Repo‑Drift**
  - `backend/package.json` enthält `npm run seed` → `tsx src/seed.ts`, aber `backend/src/seed.ts` existiert nicht.
  - `README.md`/Kommentare referenzieren Scripts/Verhalten, die im Workspace so nicht (mehr) existieren (z.B. `seed_500_towers.ts`).
  - `backend/seed.sql` beschreibt Heartbeat‑Timeout 15 Minuten, `backend/src/services/systemChecks.ts` nutzt Default 5 Minuten (konfigurierbar via ENV).
  - `frontend/src/context/AuthContext.tsx` beschreibt „Axios/Interceptors“, tatsächlich wird `fetch` via `api.ts` genutzt.

- **Tooling‑Skripte inkonsistent**
  - `tools/dev-check.ps1` nutzt `docker compose exec db …`, im Compose heißt der Service `postgres`.
  - `tools/check-dev.sh` nutzt `pg_isready -U postgres`, in `.env.dev`/Compose ist der User `gtower`.
  - `tools/phase3_lifecycle_checks.ps1` erwartet 500 Seed‑Towers mit Serial `GT-SEED-%` (nicht durch `backend/seed.sql` erzeugt).

- **Storage‑Robustheit/Sicherheit (lokaler Driver)**
  - `LocalStorageDriver` löst `storagePath` via `path.resolve(rootDir, rel)` auf. Falls jemals ein absoluter oder `..`‑haltiger `storagePath` in der DB landet, kann das Root‑Verzeichnis umgangen werden.
  - Der DEV‑Seed setzt `documents.file_path` als absoluten Pfad (`/app/uploads/...`), was in Kombination mit `LOCAL_STORAGE_ROOT=/data/uploads` zu nicht auffindbaren Dateien führen kann.

- **Skalierung/Performance**
  - Login‑Rate‑Limit ist In‑Memory (nicht clusterfähig).
  - `userService.getAll()` lädt Rollen per N+1‑Query.
  - Ticketnummern basieren auf `Date.now().toString(36)` (theoretisches Kollisionsrisiko bei hoher Parallelität).

## 9. Reifegrad‑Einschätzung
MVP mit fortgeschrittenen Elementen: Die Kern‑Domänen (Towers inkl. Historien/Exports, Lifecycle‑State‑Machine, Tickets, Dokumente inkl. Storage‑Abstraktion, RBAC/JWT) sind funktionsfähig implementiert, Docker‑Dev/Prod‑Setups und CI‑Smoke‑Tests existieren. Gleichzeitig gibt es deutliche **Dokumentations‑ und Tooling‑Inkonsistenzen**, fehlende Migrationsstrategie und einzelne „prepared but not finished“ Bereiche (z.B. Dokument‑Versionierung im UI).

## 10. Empfehlungen für nächste Schritte
1. **Repo konsolidieren**: Fehlende/obsolete Seeds und Scripts bereinigen (README/Kommentare ↔ Dateien ↔ `package.json` ↔ Tools).
2. **Migrations‑Workflow einführen**: Weg von „init.sql only“ hin zu versionierten Migrationen (und klarer DEV/PROD‑Policy).
3. **Storage hardenen + Seed anpassen**: `file_path` konsequent als Storage‑Key (nicht absoluter FS‑Pfad) behandeln; Local driver gegen absolute/Traversal‑Keys absichern; `seed.sql` entsprechend korrigieren.
4. **Frontend‑Lücken schließen**: UI für Dokument‑Version‑Upload und Ticket‑Zuweisung; optional Tower‑Edit‑Formular.
5. **Technische Schulden priorisiert abbauen**: N+1 in Users, Rate‑Limit‑Store (Redis) falls Multi‑Instanz, Ticket‑ID‑Strategie, optional Auto‑Recovery/Policy für System‑Checks.
