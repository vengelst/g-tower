-- =============================================================================
-- init.sql – Datenbank-Schema für das G-Tower Management System
-- =============================================================================
-- Zweck:         Erstellt alle Tabellen, Indizes, Trigger und initiale Daten
--                (Rollen) für die PostgreSQL-Datenbank.
-- Rolle:         Wird beim ersten Start der Datenbank als 01_schema.sql
--                ausgeführt (docker-entrypoint-initdb.d). Läuft nur einmal –
--                bei vorhandenem Datenverzeichnis wird die Datei ignoriert.
-- Abhängigkeiten: PostgreSQL 16+, uuid-ossp Extension
-- Wichtige Annahmen:
--   - UUIDs als Primärschlüssel für alle Entitäten (uuid_generate_v4)
--   - TIMESTAMPTZ für alle Zeitstempel (Zeitzonen-sicher)
--   - Zwei unabhängige Status-Dimensionen für Towers:
--     1. status (VARCHAR 50): Operativer Status – active, warning, critical,
--        offline, maintenance, decommissioned. Wird durch Scheduler/System-
--        Checks automatisch und durch manuelle Änderungen gesetzt.
--     2. lifecycle_status (VARCHAR 32): Wirtschaftlicher Lebenslauf –
--        production, delivery, storage, rented, return_delivery, repair,
--        reconditioning, end_of_life, scrapped. Wird NUR manuell geändert.
--        Scheduler/System-Checks dürfen lifecycle_status NICHT verändern.
--   - scrapped ist ein Endzustand – kein weiterer Übergang möglich
--   - config (JSONB) speichert dynamische Tower-Daten wie battery_level
--     und last_heartbeat für die System-Checks
-- Änderungshinweise:
--   - Bei Schema-Änderungen: docker compose down -v && docker compose up -d
--     (Volume muss gelöscht werden, da init.sql nur bei leerer DB läuft)
--   - Neue Tabellen hier ergänzen, Seed-Daten in seed.sql
-- =============================================================================

-- UUID-Generierung aktivieren (wird für alle Primärschlüssel verwendet)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== ROLES ==========
-- Rollen-Tabelle: Definiert die vier RBAC-Rollen des Systems.
-- Hierarchie: admin (4) > operator (3) > service (2) > viewer (1)
-- Die Rollennamen werden im Backend als String verglichen (rbac.ts)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initiale Rollen – werden beim ersten DB-Start angelegt.
-- Diese vier Rollen sind fest im Code verankert (rbac.ts, authService.ts)
INSERT INTO roles (name, description) VALUES
    ('admin', 'Vollzugriff auf alle Funktionen'),
    ('operator', 'Betrieb & Status-Verwaltung'),
    ('service', 'Wartung & Ticket-Bearbeitung'),
    ('viewer', 'Nur Lesezugriff');

-- ========== USERS ==========
-- Benutzertabelle: Authentifizierung via E-Mail + bcrypt-Hash.
-- is_active: Deaktivierte User können sich nicht einloggen (authService prüft das)
-- last_login: Wird bei jedem erfolgreichen Login aktualisiert
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- idx_users_email entfernt: UNIQUE-Constraint auf email erzeugt bereits impliziten Index

-- ========== USER_ROLES ==========
-- Verknüpfungstabelle: User ↔ Rollen (m:n, aber faktisch 1:1 verwendet).
-- assigned_by: Audit-Information, welcher Admin die Rolle vergeben hat.
-- UNIQUE(user_id, role_id): Verhindert doppelte Rollenzuweisung
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- ========== TOWERS ==========
-- Zentrale Tower-Tabelle: Jeder Tower hat Standort, zwei Status-Dimensionen
-- und dynamische Konfiguration (JSONB).
-- config JSONB: Speichert battery_level (int) und last_heartbeat (ISO-String)
--   → werden vom Scheduler gelesen und für System-Checks ausgewertet
-- status: Operativer Status (durch System-Checks + manuelle Änderungen)
-- lifecycle_status: Wirtschaftlicher Status (NUR manuell, State Machine)
--   → Scheduler/System-Checks dürfen lifecycle_status NIEMALS ändern
CREATE TABLE towers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_zip VARCHAR(20),
    address_country VARCHAR(100) DEFAULT 'Deutschland',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    config JSONB DEFAULT '{}',
    commissioned_at TIMESTAMPTZ,
    decommissioned_at TIMESTAMPTZ,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'production',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- idx_towers_serial entfernt: UNIQUE-Constraint auf serial_number erzeugt impliziten Index
CREATE INDEX idx_towers_status ON towers(status);    -- Häufige Filterung nach Status (Dashboard, Karte)
CREATE INDEX idx_towers_city ON towers(address_city); -- Filterung nach Stadt

-- ========== TOWER_STATUS_HISTORY ==========
-- Audit-Trail für operative Statusänderungen (active↔warning↔critical↔offline↔maintenance↔decommissioned).
-- Jede Änderung erzeugt einen neuen Eintrag (Insert-Only, kein Update/Delete).
-- source: 'manual' (User-Aktion) oder 'system' (Scheduler/System-Check)
-- changed_by: Kann NULL sein bei automatischen System-Checks (source='system')
CREATE TABLE tower_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- idx_tsh_tower entfernt: durch Composite-Index idx_tsh_tower_changed abgedeckt
CREATE INDEX idx_tsh_tower_changed ON tower_status_history(tower_id, changed_at DESC); -- Sortierte Timeline pro Tower
CREATE INDEX idx_tsh_tower_status ON tower_status_history(tower_id, new_status);       -- Filter nach bestimmtem Status

-- ========== TOWER_LIFECYCLE_HISTORY ==========
-- Audit-Trail für Lifecycle-Statusänderungen (production→delivery→storage→rented→...→scrapped).
-- Gleiche Struktur wie tower_status_history, aber für die wirtschaftliche Dimension.
-- WICHTIG: Lifecycle-Übergänge werden durch eine State Machine im Backend validiert
-- (lifecycleService.ts). Ungültige Übergänge werden abgelehnt.
-- scrapped ist ein ENDZUSTAND – kein weiterer Übergang möglich.
CREATE TABLE tower_lifecycle_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
    old_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tlh_tower_changed ON tower_lifecycle_history(tower_id, changed_at DESC); -- Sortierte Timeline

-- ========== SERVICE_TICKETS ==========
-- Service-Tickets: Wartungsaufträge, Störungen, Inspektionen für Tower.
-- ticket_number: Menschenlesbarer Identifier (z.B. TKT-2024-001)
-- ticket_type: maintenance, incident, inspection
-- priority: low, medium, high, critical
-- status: open, pending, in_progress, closed
-- assigned_to: Techniker, der das Ticket bearbeitet (NULL = unzugewiesen)
CREATE TABLE service_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ticket_type VARCHAR(50) NOT NULL DEFAULT 'maintenance',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_tower ON service_tickets(tower_id);       -- Tickets pro Tower
CREATE INDEX idx_tickets_status ON service_tickets(status);       -- Filter nach Ticket-Status
CREATE INDEX idx_tickets_assigned ON service_tickets(assigned_to); -- Tickets pro Techniker

-- ========== DOCUMENTS ==========
-- Dokument-Metadaten: Verweist auf physische Dateien im Upload-Verzeichnis.
-- tower_id: Kann NULL sein (allgemeine Dokumente ohne Tower-Bezug)
-- ON DELETE SET NULL: Wenn ein Tower gelöscht wird, bleiben Dokumente erhalten
-- filename: UUID-basierter Dateiname auf dem Dateisystem
-- original_filename: Vom Benutzer hochgeladener Originalname
-- parent_document_id: Ermöglicht Versionierung (neues Dokument verweist auf Vorgänger)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id UUID REFERENCES towers(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    document_type VARCHAR(50),
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_tower ON documents(tower_id);

-- ========== AUDIT_LOG ==========
-- Allgemeines Audit-Log: Protokolliert CRUD-Aktionen auf allen Entitäten.
-- Wird von der audit-Middleware (audit.ts) automatisch befüllt.
-- old_values/new_values: JSONB-Snapshots des Vorher/Nachher-Zustands
-- ip_address: Client-IP des auslösenden Requests
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id); -- Suche nach Entität
CREATE INDEX idx_audit_created ON audit_log(created_at);           -- Chronologische Sortierung

-- ========== AUTO-UPDATE TRIGGER ==========
-- Automatische Aktualisierung von updated_at bei jeder UPDATE-Operation.
-- Wird auf users, towers, service_tickets und documents angewandt.
-- NICHT auf History-Tabellen (dort gibt es keine Updates, nur Inserts)
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_towers_updated BEFORE UPDATE ON towers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON service_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
