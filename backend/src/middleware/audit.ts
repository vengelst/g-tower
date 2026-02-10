/**
 * @module audit – Audit-Log-Hilfsfunktion
 *
 * @description
 * Schreibt CRUD-Aktionen in die Datenbanktabelle `audit_log`.
 * Protokolliert wer (userId/email), was (action/entityType/entityId),
 * mit welchen Aenderungen (oldValues/newValues) und von wo (IP-Adresse).
 *
 * Rolle im Gesamtsystem:
 *   Zentrale Nachvollziehbarkeit aller schreibenden Operationen.
 *   Wird aus Route-Handlern und Service-Schichten aufgerufen,
 *   um eine lueckenlose Aenderungshistorie zu fuehren.
 *
 * Abhaengigkeiten:
 *   - ../config/database.js – Stellt die `query`-Funktion fuer PostgreSQL-Abfragen bereit.
 *
 * Wichtige Annahmen:
 *   - Die Tabelle `audit_log` existiert mit den Spalten:
 *     user_id, user_email, action, entity_type, entity_id,
 *     old_values (JSONB), new_values (JSONB), ip_address.
 *   - oldValues/newValues werden als JSON-Strings gespeichert (JSON.stringify).
 *   - userId und userEmail koennen null sein (z.B. bei System-Aktionen oder
 *     fehlgeschlagenen Login-Versuchen ohne authentifizierten Benutzer).
 *
 * Aenderungshinweise:
 *   - Fehler beim Schreiben des Audit-Logs werden bewusst nur geloggt,
 *     NICHT weitergereicht – die eigentliche Operation soll nicht scheitern.
 *   - Bei Bedarf koennte ein Retry-Mechanismus oder eine Queue ergaenzt werden.
 */
import { query } from '../config/database.js';

/**
 * Schreibt einen einzelnen Audit-Log-Eintrag in die Datenbank.
 *
 * @param userId     – ID des handelnden Benutzers (null bei System-Aktionen)
 * @param userEmail  – E-Mail des handelnden Benutzers (null bei System-Aktionen)
 * @param action     – Art der Aktion, z.B. "CREATE", "UPDATE", "DELETE"
 * @param entityType – Betroffener Entitaetstyp, z.B. "user", "tower", "device"
 * @param entityId   – ID der betroffenen Entitaet (null falls nicht zutreffend)
 * @param oldValues  – Vorheriger Zustand des Objekts (null bei CREATE)
 * @param newValues  – Neuer Zustand des Objekts (null bei DELETE)
 * @param ip         – IP-Adresse des Clients
 */
export async function createAuditLog(
  userId: string | null,
  userEmail: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: unknown | null,
  newValues: unknown | null,
  ip: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, userEmail, action, entityType, entityId,
       /* Objektwerte werden als JSON-String serialisiert, damit PostgreSQL sie als JSONB speichern kann */
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       ip]
    );
  } catch (e) {
    /* Bewusst nur console.error: Audit-Fehler sollen die Hauptoperation nicht blockieren */
    console.error('Audit log failed:', e);
  }
}
