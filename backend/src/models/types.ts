/**
 * @module models/types
 *
 * @description Zentrale TypeScript-Typdefinitionen fuer alle Domaenen-Entitaeten.
 *   Bildet die Datenbankzeilen 1:1 als Interfaces ab (snake_case, passend zu
 *   den PostgreSQL-Spaltennamen).
 *
 * @role Einzige Quelle der Wahrheit fuer die Typisierung im gesamten Backend.
 *   Wird von Services, Controllern und ggf. Middleware importiert.
 *   Aenderungen hier wirken sich auf alle Schichten aus.
 *
 * @dependencies
 *   - Keine externen Abhaengigkeiten (reine Typdefinitionen).
 *
 * @assumptions
 *   - Alle IDs sind UUIDs (v4) als Strings.
 *   - Zeitstempel (created_at, updated_at etc.) kommen als ISO-8601-Strings
 *     aus der Datenbank (pg gibt `timestamptz` standardmaessig als String zurueck).
 *   - Zwei getrennte Status-Dimensionen fuer Towers:
 *       - Operativer Status (TowerStatus): Beschreibt den aktuellen Betriebszustand.
 *         Wird durch Scheduler/System-Checks UND manuelle Eingriffe veraendert.
 *       - Lifecycle-Status (TowerLifecycleStatus): Beschreibt die Phase im Lebenszyklus.
 *         Wird NUR manuell geaendert. `scrapped` ist ein irreversibler Endzustand.
 *   - RBAC-Rollen: admin (4) > operator (3) > service (2) > viewer (1).
 *   - Felder mit `| null` sind in der DB als nullable definiert.
 *
 * @changelog
 *   – Initiale Erstellung: User, Role, JWT, Tower, Lifecycle, Ticket, Document, Pagination.
 */

// ---- Users & Roles ----

/** Datenbankzeile der `users`-Tabelle */
export interface User {
  id: string;
  email: string;
  /** Bcrypt-Hash des Passworts – darf NIEMALS an den Client gesendet werden */
  password_hash: string;
  first_name: string;
  last_name: string;
  /** Deaktivierte Benutzer koennen sich nicht einloggen */
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * RBAC-Rollennamen mit absteigender Berechtigungsstufe:
 * admin (4) > operator (3) > service (2) > viewer (1).
 * Ein Benutzer kann mehrere Rollen haben; die hoechste zaehlt.
 */
export type RoleName = 'admin' | 'operator' | 'service' | 'viewer';

/**
 * Payload, das im JWT-Token kodiert wird.
 * Enthaelt die Benutzer-ID, E-Mail und zugewiesene Rollen.
 * Wird beim Login erzeugt und bei jedem authentifizierten Request ausgelesen.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roles: RoleName[];
}

// ---- Towers ----

/**
 * Operativer Status eines Towers.
 * Wird durch Scheduler/System-Checks (z. B. Heartbeat-Pruefung) und
 * manuelle Eingriffe gesetzt. NICHT mit dem Lifecycle-Status verwechseln.
 */
export type TowerStatus = 'active' | 'offline' | 'maintenance' | 'decommissioned' | 'warning' | 'critical';

/**
 * Lifecycle-Status eines Towers – bildet den Lebenszyklus ab:
 * production -> delivery -> storage -> rented -> return_delivery -> repair ->
 * reconditioning -> end_of_life -> scrapped.
 * WICHTIG: Scheduler/System-Checks aendern diesen Status NIEMALS.
 * `scrapped` ist ein Endzustand und kann nicht rueckgaengig gemacht werden.
 */
export type TowerLifecycleStatus = 'production' | 'delivery' | 'storage' | 'rented' | 'return_delivery' | 'repair' | 'reconditioning' | 'end_of_life' | 'scrapped';

/** Datenbankzeile der `towers`-Tabelle */
export interface Tower {
  id: string;
  serial_number: string;
  name: string;
  description: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string;
  latitude: number | null;
  longitude: number | null;
  /** Operativer Status – unabhaengig vom Lifecycle-Status */
  status: TowerStatus;
  /** Lifecycle-Status – unabhaengig vom operativen Status */
  lifecycle_status: TowerLifecycleStatus;
  /** Freiformiges Konfigurationsobjekt (z. B. Sensor-Schwellwerte) */
  config: Record<string, unknown>;
  /** Zeitpunkt der Inbetriebnahme */
  commissioned_at: string | null;
  /** Zeitpunkt der Ausserbetriebnahme */
  decommissioned_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Eintrag in der Lifecycle-Historie eines Towers.
 * Dokumentiert jeden Uebergang zwischen Lifecycle-Statuswerten.
 * Die optionalen Felder (changed_by_email, first_name, last_name) werden
 * per JOIN beim Lesen befuellt und sind nicht in der Tabelle selbst vorhanden.
 */
export interface TowerLifecycleHistory {
  id: string;
  tower_id: string;
  /** Vorheriger Status (null beim ersten Eintrag) */
  old_status: TowerLifecycleStatus | null;
  new_status: TowerLifecycleStatus;
  reason: string | null;
  /** UUID des Benutzers, der die Aenderung ausgeloest hat (null bei System) */
  changed_by: string | null;
  /** Folgende Felder werden per JOIN befuellt (nicht in der DB-Tabelle) */
  changed_by_email?: string;
  first_name?: string;
  last_name?: string;
  /** 'manual' = durch Benutzer, 'system' = automatisch (theoretisch, aktuell nicht verwendet) */
  source: 'manual' | 'system';
  changed_at: string;
}

// ---- Tickets ----

/** Art des Service-Tickets */
export type TicketType = 'maintenance' | 'incident' | 'inspection';

/** Prioritaet eines Tickets – bestimmt die Bearbeitungsreihenfolge */
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/** Workflow-Status eines Tickets (von Erstellung bis Abschluss) */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

/** Datenbankzeile der `service_tickets`-Tabelle */
export interface ServiceTicket {
  id: string;
  tower_id: string;
  /** Automatisch generierte, lesbare Ticket-Nummer (z. B. "TKT-00042") */
  ticket_number: string;
  title: string;
  description: string | null;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  /** UUID des zugewiesenen Benutzers (null = nicht zugewiesen) */
  assigned_to: string | null;
  assigned_at: string | null;
  /** Freitext-Beschreibung der Loesung (wird bei Abschluss gesetzt) */
  resolution: string | null;
  resolved_at: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Documents ----

/** Typ eines hochgeladenen Dokuments */
export type DocumentType = 'manual' | 'certificate' | 'report' | 'image' | 'other';

/** Datenbankzeile der `documents`-Tabelle */
export interface Document {
  id: string;
  /** Optionaler Bezug zu einem Tower (null = globales Dokument) */
  tower_id: string | null;
  original_filename: string;
  mime_type: string;
  /** Dateigroesse in Bytes */
  file_size: number;
  title: string | null;
  description: string | null;
  document_type: DocumentType | null;
  /** Versionsnummer – wird bei erneutem Upload desselben Dokuments hochgezaehlt */
  version: number;
  /** Verweis auf die vorherige Version (null = erste Version) */
  parent_document_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Pagination ----

/**
 * Generische Antwortstruktur fuer paginierte Listen-Endpunkte.
 * Wird von allen Service-Methoden zurueckgegeben, die Listen liefern.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}
