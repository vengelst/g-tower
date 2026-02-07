-- G-Tower Management System - PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== ROLES ==========
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
    ('admin', 'Vollzugriff auf alle Funktionen'),
    ('operator', 'Betrieb & Status-Verwaltung'),
    ('service', 'Wartung & Ticket-Bearbeitung'),
    ('viewer', 'Nur Lesezugriff');

-- ========== USERS ==========
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

CREATE INDEX idx_users_email ON users(email);

-- ========== USER_ROLES ==========
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_towers_serial ON towers(serial_number);
CREATE INDEX idx_towers_status ON towers(status);
CREATE INDEX idx_towers_city ON towers(address_city);

-- ========== TOWER_STATUS_HISTORY ==========
CREATE TABLE tower_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tsh_tower ON tower_status_history(tower_id);

-- ========== SERVICE_TICKETS ==========
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

CREATE INDEX idx_tickets_tower ON service_tickets(tower_id);
CREATE INDEX idx_tickets_status ON service_tickets(status);
CREATE INDEX idx_tickets_assigned ON service_tickets(assigned_to);

-- ========== DOCUMENTS ==========
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

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ========== AUTO-UPDATE TRIGGER ==========
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_towers_updated BEFORE UPDATE ON towers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON service_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
