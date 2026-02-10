/**
 * @module types
 *
 * @description
 * Zentrale Typdefinitionen fuer das gesamte g-tower Frontend.
 * Definiert alle Interfaces und Union-Types, die von Services, Komponenten und Views verwendet werden.
 *
 * @role_im_system
 * Einzige Quelle der Wahrheit ("Single Source of Truth") fuer die Datenstrukturen im Frontend.
 * Alle Service-Module importieren ihre Typen aus dieser Datei.
 * Die Typen bilden die Backend-Datenbankstrukturen und API-Responses ab.
 *
 * @abhaengigkeiten
 * - Keine externen Abhaengigkeiten (reine Typ-Definitionen)
 * - Wird von allen Service-Modulen und vielen UI-Komponenten importiert
 *
 * @wichtige_annahmen
 * - TowerStatus (6 Werte) und TowerLifecycleStatus (9 Werte) sind zwei UNABHAENGIGE Dimensionen:
 *   - TowerStatus beschreibt den operativen Zustand (aktiv, offline, Wartung, etc.)
 *   - TowerLifecycleStatus beschreibt den wirtschaftlichen Lebenszyklus (Produktion, Vermietung, Verschrottung, etc.)
 * - 'scrapped' ist ein Endzustand im Lifecycle – danach sind keine Uebergaenge mehr moeglich
 * - Felder mit '| null' koennen in der Datenbank NULL sein
 * - Zeitstempel (created_at, updated_at, etc.) sind ISO-8601-Strings
 *
 * @aenderungshinweise
 * - Bei Aenderung der Enums/Union-Types muessen auch die Backend-Definitionen angepasst werden
 * - Neue Felder sollten als optional (?) oder nullable (| null) hinzugefuegt werden, um Rueckwaertskompatibilitaet zu wahren
 * - PaginatedResponse<T> ist generisch und kann fuer alle paginierten Listen wiederverwendet werden
 */

// ============================================================================
// Benutzer & Rollen
// ============================================================================

/** Verfuegbare Benutzerrollen im System – bestimmen Zugriffsrechte auf Endpunkte und UI-Bereiche */
export type RoleName = 'admin' | 'operator' | 'service' | 'viewer';

/** Benutzerkonto mit Profildaten, Aktivitaetsstatus und zugewiesenen Rollen */
export interface User {
  id: string; email: string; first_name: string; last_name: string;
  is_active: boolean; last_login: string | null; roles: RoleName[];
  created_at: string; updated_at: string;
}

// ============================================================================
// Tower – Status & Lifecycle (zwei unabhaengige Dimensionen)
// ============================================================================

/**
 * Operativer Status eines Towers (6 Werte).
 * Beschreibt den aktuellen Betriebszustand – unabhaengig vom wirtschaftlichen Lifecycle.
 * - active: Tower ist in Betrieb
 * - offline: Tower ist nicht erreichbar / ausgeschaltet
 * - maintenance: Tower befindet sich in geplanter Wartung
 * - decommissioned: Tower wurde ausser Betrieb genommen
 * - warning: Betriebsparameter ausserhalb Normbereich
 * - critical: Kritischer Zustand, sofortiges Handeln erforderlich
 */
export type TowerStatus = 'active' | 'offline' | 'maintenance' | 'decommissioned' | 'warning' | 'critical';

/**
 * Wirtschaftlicher Lifecycle-Status eines Towers (9 Werte).
 * Beschreibt die aktuelle Phase im Lebenszyklus – unabhaengig vom operativen Status.
 * - production: Tower wird hergestellt
 * - delivery: Tower ist auf dem Weg zum Kunden
 * - storage: Tower ist eingelagert
 * - rented: Tower ist beim Kunden im Einsatz (vermietet)
 * - return_delivery: Tower wird vom Kunden zuruecktransportiert
 * - repair: Tower wird repariert
 * - reconditioning: Tower wird aufbereitet / generalueberholt
 * - end_of_life: Tower hat Lebensdauerende erreicht
 * - scrapped: Tower wurde verschrottet (ENDZUSTAND – keine weiteren Uebergaenge moeglich)
 */
export type TowerLifecycleStatus = 'production' | 'delivery' | 'storage' | 'rented' | 'return_delivery' | 'repair' | 'reconditioning' | 'end_of_life' | 'scrapped';

/** Stammdaten eines Towers inkl. Adresse, Koordinaten, aktuellem Status und Lifecycle-Status */
export interface Tower {
  id: string; serial_number: string; name: string; description: string | null;
  address_street: string | null; address_city: string | null; address_zip: string | null; address_country: string;
  latitude: number | null; longitude: number | null; status: TowerStatus; lifecycle_status: TowerLifecycleStatus;
  config: Record<string, unknown>; commissioned_at: string | null; decommissioned_at: string | null;
  created_at: string; updated_at: string;
}

// ============================================================================
// Tower-Historie (Status & Lifecycle)
// ============================================================================

/** Quelle einer Statusaenderung: manuell durch Benutzer oder automatisch durch das System */
export type HistorySource = 'manual' | 'system';

/** Einzelner Eintrag in der operativen Status-Historie eines Towers */
export interface TowerStatusHistory {
  id: string; tower_id: string; old_status: TowerStatus | null; new_status: TowerStatus;
  reason: string | null; source: HistorySource;
  changed_by: string | null; changed_by_email?: string;
  first_name?: string; last_name?: string; changed_at: string;
}

/** Einzelner Eintrag in der Lifecycle-Historie eines Towers */
export interface TowerLifecycleHistory {
  id: string; tower_id: string; old_status: TowerLifecycleStatus | null; new_status: TowerLifecycleStatus;
  reason: string | null; source: HistorySource;
  changed_by: string | null; changed_by_email?: string;
  first_name?: string; last_name?: string; changed_at: string;
}

/**
 * Erweiterte Tower-Ansicht mit eingebetteten Relationen.
 * Enthaelt sowohl statusHistory (operativ) als auch lifecycleHistory (wirtschaftlich),
 * sowie zugeordnete Tickets und Dokumente. Wird von der Tower-Detailseite verwendet.
 */
export interface TowerWithHistory extends Tower {
  statusHistory: TowerStatusHistory[];
  tickets: ServiceTicket[];
  documents: Document[];
  lifecycleHistory: TowerLifecycleHistory[];
}

// ============================================================================
// Service-Tickets
// ============================================================================

/** Art des Tickets: Wartung, Stoerfall oder Inspektion */
export type TicketType = 'maintenance' | 'incident' | 'inspection';

/** Prioritaetsstufen fuer Tickets (aufsteigend) */
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/** Statuslebenszyklus eines Tickets: open -> in_progress -> pending -> resolved -> closed */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

/** Service-Ticket mit allen Details, Tower-Zuordnung und optionalen Join-Feldern (tower_name etc.) */
export interface ServiceTicket {
  id: string; tower_id: string; ticket_number: string; title: string; description: string | null;
  ticket_type: TicketType; priority: TicketPriority; status: TicketStatus;
  assigned_to: string | null; assigned_at: string | null;
  resolution: string | null; resolved_at: string | null; due_date: string | null;
  created_by: string | null; created_at: string; updated_at: string;
  // Optionale Join-Felder, die vom Backend bei Bedarf mitgeliefert werden
  tower_name?: string; tower_serial?: string; assigned_to_name?: string; created_by_name?: string;
}

// ============================================================================
// Dokumente
// ============================================================================

/** Dokumenttypen: Handbuch, Zertifikat, Bericht, Bild oder Sonstiges */
export type DocumentType = 'manual' | 'certificate' | 'report' | 'image' | 'other';

/** Dokument-Metadaten (ohne Dateiinhalt). tower_id ist optional – Dokumente koennen auch global sein */
export interface Document {
  id: string; tower_id: string | null; original_filename: string;
  mime_type: string; file_size: number; title: string | null; description: string | null;
  document_type: DocumentType | null; version: number; created_at: string; tower_name?: string;
}

// ============================================================================
// Generische & Aggregierte Typen
// ============================================================================

/** Generischer Wrapper fuer paginierte API-Responses. Wird von allen Listen-Endpunkten verwendet */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number; };
}

/** Aggregierte Tower-Statistiken: Gesamtzahl und Aufschluesselung nach operativem Status */
export interface TowerStats { total: number; byStatus: Record<string, number>; }

/** Aggregierte Ticket-Statistiken: Gesamtzahl, nach Status und nach Prioritaet aufgeschluesselt */
export interface TicketStats { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }

/** Response des Login-Endpunkts: JWT-Token und zugehoeriger Benutzer */
export interface AuthResponse { token: string; user: User; }
