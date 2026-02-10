/**
 * @module schemas
 *
 * @description Zentrale Zod-Validierungsschemas für alle API-Endpunkte.
 *   Definiert Request-Body-, Query- und Param-Schemas, die in den Controllern
 *   bzw. einer Validierungs-Middleware eingesetzt werden.
 *
 * @role Einzige Quelle der Wahrheit für die Eingabevalidierung.
 *   Stellt sicher, dass fehlerhafte Daten nie die Service-Schicht erreichen.
 *   Wird von den Routen/Controllern importiert (Route → Controller → Service).
 *
 * @dependencies
 *   - zod – Schema-Validierungsbibliothek
 *
 * @assumptions
 *   - UUIDs folgen dem kanonischen Format (8-4-4-4-12, hex, case-insensitive).
 *   - Pagination: Seite >= 1, Limit 1–100, Default 20 Einträge pro Seite.
 *   - Zwei getrennte Status-Dimensionen für Towers:
 *       • Operativer Status (`towerStatus`): active | warning | critical | offline |
 *         maintenance | decommissioned – wird durch Scheduler/System-Checks und
 *         manuelle Eingriffe verändert.
 *       • Lifecycle-Status (`towerLifecycleStatus`): production | delivery | storage |
 *         rented | return_delivery | repair | reconditioning | end_of_life | scrapped.
 *         Wird NUR manuell geändert; Scheduler/System-Checks greifen hier NICHT ein.
 *         `scrapped` ist ein irreversibler Endzustand.
 *   - RBAC-Rollen: admin (4) > operator (3) > service (2) > viewer (1).
 *   - Fehlermeldungen sind auf Deutsch, da die Zielgruppe deutschsprachig ist.
 *
 * @changelog
 *   – Initiale Erstellung: Auth-, Tower-, Lifecycle-, Ticket-, User-, Document-Schemas.
 */

import { z } from 'zod';

// ── Shared ──────────────────────────────────────────────

/** UUID v4 im kanonischen Format (wird für alle Entitäts-IDs wiederverwendet) */
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');

/**
 * Basis-Paginierung für Listen-Endpunkte.
 * `passthrough()` erlaubt zusätzliche Query-Parameter, die von
 * abgeleiteten Schemas (z. B. towerListQuery) ergänzt werden.
 */
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).passthrough();

/** Wiederverwendbares Schema für `:id`-Route-Parameter */
const idParams = z.object({ id: uuid });

// ── Auth ────────────────────────────────────────────────

/** Validierung des Login-Request-Bodys (E-Mail + Passwort) */
export const loginBody = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

// ── Towers ──────────────────────────────────────────────

/**
 * Operativer Status eines Towers.
 * Wird durch System-Checks (Scheduler) und manuelle Eingriffe gesetzt.
 * WICHTIG: Dieser Status ist unabhängig vom Lifecycle-Status.
 */
const towerStatus = z.enum(['active', 'offline', 'maintenance', 'decommissioned', 'warning', 'critical']);

/** Query-Parameter für die Tower-Liste inkl. optionaler Filter und Kartenansicht */
export const towerListQuery = paginationQuery.extend({
  status: towerStatus.optional(),
  search: z.string().optional(),
  city: z.string().optional(),
  /** mode='map' liefert ein reduziertes Payload für die Kartenansicht */
  mode: z.enum(['map']).optional(),
});

/** Validierung beim Anlegen eines neuen Towers */
export const createTowerBody = z.object({
  serialNumber: z.string().min(1, 'Seriennummer erforderlich'),
  name: z.string().min(1, 'Name erforderlich'),
  description: z.string().nullish(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  /** Freiformiges Konfigurations-Objekt (key-value), z. B. Schwellwerte für Sensoren */
  config: z.record(z.string(), z.unknown()).optional(),
});

/** Partial-Schema: Beim Update sind alle Felder optional */
export const updateTowerBody = createTowerBody.partial();

/**
 * Body für manuelle Änderung des operativen Status.
 * `reason` dokumentiert den Grund der Statusänderung (für die Historie).
 */
export const updateTowerStatusBody = z.object({
  status: towerStatus,
  reason: z.string().optional(),
});

/** Quelle einer Statusänderung: manuell durch Benutzer oder automatisch durch System */
const historySource = z.enum(['manual', 'system']);

/**
 * Gemeinsame Filter für die operative Status-Historie.
 * Wiederverwendet in Query- und Export-Schemas.
 */
const historyFilters = {
  status: towerStatus.optional(),
  source: historySource.optional(),
  date_from: z.string().datetime({ message: 'date_from muss ISO-8601 sein' }).optional(),
  date_to: z.string().datetime({ message: 'date_to muss ISO-8601 sein' }).optional(),
};

/** Query-Parameter für die paginierte operative Status-Historie */
export const statusHistoryQuery = paginationQuery.extend(historyFilters);

/** Query-Parameter für den Export der operativen Status-Historie (CSV/JSON, ohne Paginierung) */
export const statusHistoryExportQuery = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  ...historyFilters,
});

// ── Lifecycle ────────────────────────────────────────────

/**
 * Lifecycle-Status eines Towers.
 * Bildet den Lebenszyklus ab: Produktion → Auslieferung → Lager → Vermietung → ...
 * WICHTIG: `scrapped` ist ein Endzustand – einmal gesetzt, nicht mehr änderbar.
 * Scheduler/System-Checks verändern diesen Status NIEMALS.
 */
const towerLifecycleStatus = z.enum(['production', 'delivery', 'storage', 'rented', 'return_delivery', 'repair', 'reconditioning', 'end_of_life', 'scrapped']);

/**
 * Body für manuelle Änderung des Lifecycle-Status.
 * Nur durch berechtigte Benutzer (nicht durch das System) ausgelöst.
 */
export const updateLifecycleStatusBody = z.object({
  status: towerLifecycleStatus,
  reason: z.string().optional(),
});

/** Filter für die Lifecycle-Historie (analog zu operativen Filtern, aber ohne Status-Filter) */
const lifecycleHistoryFilters = {
  source: historySource.optional(),
  date_from: z.string().datetime({ message: 'date_from muss ISO-8601 sein' }).optional(),
  date_to: z.string().datetime({ message: 'date_to muss ISO-8601 sein' }).optional(),
};

/** Query-Parameter für die paginierte Lifecycle-Historie */
export const lifecycleHistoryQuery = paginationQuery.extend(lifecycleHistoryFilters);

/** Query-Parameter für den Export der Lifecycle-Historie (CSV/JSON, ohne Paginierung) */
export const lifecycleHistoryExportQuery = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  ...lifecycleHistoryFilters,
});

// ── Tickets ─────────────────────────────────────────────

/** Art des Service-Tickets */
const ticketType = z.enum(['maintenance', 'incident', 'inspection']);

/** Priorität: Bestimmt die Bearbeitungsreihenfolge */
const ticketPriority = z.enum(['low', 'medium', 'high', 'critical']);

/** Workflow-Status eines Tickets (von Erstellung bis Abschluss) */
const ticketStatus = z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']);

/** Query-Parameter für die Ticket-Liste inkl. optionaler Filter */
export const ticketListQuery = paginationQuery.extend({
  towerId: uuid.optional(),
  status: ticketStatus.optional(),
  type: ticketType.optional(),
  priority: ticketPriority.optional(),
  assignedTo: uuid.optional(),
});

/** Validierung beim Anlegen eines neuen Tickets */
export const createTicketBody = z.object({
  towerId: uuid,
  title: z.string().min(1, 'Titel erforderlich'),
  description: z.string().nullish(),
  ticketType: ticketType.default('maintenance'),
  priority: ticketPriority.default('medium'),
  assignedTo: uuid.nullish(),
  dueDate: z.string().datetime().nullish(),
});

/** Validierung beim Aktualisieren eines bestehenden Tickets (alle Felder optional) */
export const updateTicketBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  ticketType: ticketType.optional(),
  priority: ticketPriority.optional(),
  status: ticketStatus.optional(),
  resolution: z.string().nullish(),
  dueDate: z.string().datetime().nullish(),
});

/** Body für die Zuweisung eines Tickets an einen Benutzer */
export const assignTicketBody = z.object({
  assignedTo: uuid,
});

// ── Users ───────────────────────────────────────────────

/**
 * RBAC-Rollen mit absteigender Berechtigungsstufe:
 * admin (4) > operator (3) > service (2) > viewer (1).
 */
const roleName = z.enum(['admin', 'operator', 'service', 'viewer']);

/** Validierung beim Anlegen eines neuen Benutzers */
export const createUserBody = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein'),
  firstName: z.string().min(1, 'Vorname erforderlich'),
  lastName: z.string().min(1, 'Nachname erforderlich'),
  /** Standard-Rolle ist 'viewer' – mindestens eine Rolle muss zugewiesen sein */
  roles: z.array(roleName).min(1).default(['viewer']),
});

/** Validierung beim Aktualisieren eines bestehenden Benutzers (alle Felder optional) */
export const updateUserBody = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  roles: z.array(roleName).min(1).optional(),
});

// ── Documents ───────────────────────────────────────────

/** Dokumententyp – klassifiziert hochgeladene Dateien */
const documentType = z.enum(['manual', 'certificate', 'report', 'image', 'other']);

/** Query-Parameter für die Dokumenten-Liste */
export const documentListQuery = paginationQuery.extend({
  towerId: uuid.optional(),
  type: documentType.optional(),
});

/**
 * Validierung für den Dokument-Upload (Metadaten).
 * `towerId` kann leer sein (z. B. für globale Dokumente ohne Tower-Bezug).
 */
export const uploadDocumentBody = z.object({
  towerId: uuid.optional().or(z.literal('')),
  title: z.string().optional(),
  description: z.string().optional(),
  documentType: documentType.default('other'),
});

// ── Re-exports ──────────────────────────────────────────
export { paginationQuery, idParams };
