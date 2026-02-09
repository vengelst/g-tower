/**
 * @module towerService
 *
 * Zweck:
 *   Zentraler Service fuer die Tower-Verwaltung – CRUD-Operationen, operativer
 *   Status-Wechsel, Status-Historie und CSV/JSON-Export der Historie.
 *
 * Rolle im Gesamtsystem:
 *   Wird vom TowerController aufgerufen (Route → Controller → Service).
 *   Enthaelt die gesamte Geschaeftslogik fuer Tower-Stammdaten und den
 *   **operativen Status** (active, warning, critical, offline, maintenance,
 *   decommissioned). Der Lifecycle-Status wird separat im lifecycleService
 *   verwaltet – beide Dimensionen sind voneinander unabhaengig.
 *
 *   updateStatus() wird sowohl manuell (ueber Controller) als auch automatisch
 *   vom Scheduler (systemChecks) aufgerufen – daher der Parameter "source".
 *
 * Abhängigkeiten:
 *   - database.query / getClient: DB-Zugriff (Pool-Query bzw. dedizierter Client fuer Transaktionen)
 *   - AppError: Einheitliche Fehlerklasse fuer HTTP-Fehlercodes
 *   - TowerStatus (Typ): Erlaubte operative Status-Werte
 *
 * Wichtige Annahmen:
 *   - Seriennummern (serial_number) sind systemweit eindeutig.
 *   - updateStatus() nutzt getClient() + BEGIN/COMMIT/ROLLBACK, damit
 *     Status-Update und History-Eintrag atomar erfolgen.
 *   - create() setzt commissioned_at automatisch auf NOW().
 *   - Beim Status-Wechsel zu "decommissioned" wird decommissioned_at gesetzt.
 *   - CSV-Export: UTF-8 BOM-Prefix (\uFEFF) fuer Excel-Kompatibilitaet,
 *     Semikolon als Trennzeichen (deutsche Konvention).
 *   - csvEscape() schuetzt gegen CSV-Injection (fuehrende Sonderzeichen).
 *   - Export hat ein hartes Limit von 50.000 Eintraegen.
 *
 * Änderungshinweise:
 *   - Bei neuen Tower-Feldern: create(), update() und getAll() anpassen.
 *   - Bei neuen Status-Werten: TowerStatus-Typ, STATUS_PRIORITY in systemChecks
 *     und ggf. Frontend-Anzeige aktualisieren.
 *   - buildHistoryWhere() wird von getStatusHistory() und exportStatusHistory()
 *     gemeinsam genutzt – Aenderungen wirken sich auf beide aus.
 */
import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { TowerStatus } from '../models/types.js';

export const towerService = {
  /**
   * Listet alle Tower mit Pagination und optionalen Filtern.
   * Im Modus "map" werden nur Geo-Koordinaten geladen (fuer Kartenansicht).
   */
  async getAll(page = 1, limit = 20, filters: { status?: string; search?: string; city?: string; mode?: string } = {}) {
    /* Kartenansicht: Nur Tower mit Koordinaten, reduzierte Spalten, kein Paging */
    if (filters.mode === 'map') {
      const data = (await query(
        `SELECT id, name, serial_number, status, latitude::float, longitude::float FROM towers WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY name LIMIT 2000`
      )).rows;
      return { data, pagination: { total: data.length, page: 1, limit: data.length, totalPages: 1 } };
    }

    const offset = (page - 1) * limit;
    /* Dynamische WHERE-Klausel: Filter werden als parametrisierte Bedingungen angehaengt */
    const conds: string[] = []; const vals: unknown[] = []; let i = 1;

    if (filters.status) { conds.push(`status=$${i++}`); vals.push(filters.status); }
    if (filters.city) { conds.push(`address_city ILIKE $${i++}`); vals.push(`%${filters.city}%`); }
    /* Suche greift auf Name UND Seriennummer gleichzeitig zu (gleicher Parameter-Index) */
    if (filters.search) { conds.push(`(name ILIKE $${i} OR serial_number ILIKE $${i})`); vals.push(`%${filters.search}%`); i++; }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = +(await query(`SELECT count(*) FROM towers ${where}`, vals)).rows[0].count;
    const data = (await query(`SELECT * FROM towers ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`, [...vals, limit, offset])).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /**
   * Laedt einen einzelnen Tower mit allen zugehoerigen Detail-Daten:
   * Status-Historie, Tickets, Dokumente und Lifecycle-Historie.
   * Die vier Unter-Abfragen laufen parallel (Promise.all) fuer bessere Performance.
   */
  async getById(id: string) {
    const t = (await query('SELECT * FROM towers WHERE id=$1', [id])).rows[0];
    if (!t) throw new AppError('Tower nicht gefunden', 404);

    /* Vier Detail-Abfragen parallel ausfuehren */
    const [historyRes, ticketsRes, documentsRes, lifecycleRes] = await Promise.all([
      query(
        `SELECT h.*, u.first_name, u.last_name FROM tower_status_history h LEFT JOIN users u ON h.changed_by=u.id WHERE h.tower_id=$1 ORDER BY h.changed_at DESC LIMIT 50`, [id]
      ),
      query(
        `SELECT st.*, concat(ua.first_name,' ',ua.last_name) as assigned_to_name,
                concat(uc.first_name,' ',uc.last_name) as created_by_name
         FROM service_tickets st
         LEFT JOIN users ua ON st.assigned_to=ua.id
         LEFT JOIN users uc ON st.created_by=uc.id
         WHERE st.tower_id=$1 ORDER BY st.created_at DESC LIMIT 10`, [id]
      ),
      query(
        `SELECT id, tower_id, original_filename, mime_type, file_size,
                title, description, document_type, version, parent_document_id,
                uploaded_by, created_at, updated_at
         FROM documents WHERE tower_id=$1 ORDER BY created_at DESC LIMIT 10`, [id]
      ),
      query(
        `SELECT h.*, u.first_name, u.last_name FROM tower_lifecycle_history h LEFT JOIN users u ON h.changed_by=u.id WHERE h.tower_id=$1 ORDER BY h.changed_at DESC LIMIT 10`, [id]
      ),
    ]);

    return { ...t, statusHistory: historyRes.rows, tickets: ticketsRes.rows, documents: documentsRes.rows, lifecycleHistory: lifecycleRes.rows };
  },

  /**
   * Erstellt einen neuen Tower. Verwendet eine Transaktion, damit Tower-Anlage
   * und initialer History-Eintrag atomar erfolgen.
   */
  async create(data: Record<string, unknown>, createdBy: string) {
    /* Eindeutigkeit der Seriennummer pruefen */
    const dup = await query('SELECT id FROM towers WHERE serial_number=$1', [data.serial_number]);
    if (dup.rows.length) throw new AppError('Seriennummer bereits vergeben', 400);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const t = (await client.query(
        `INSERT INTO towers (serial_number,name,description,address_street,address_city,address_zip,address_country,latitude,longitude,status,config,commissioned_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12) RETURNING *`,
        [data.serial_number, data.name, data.description || null, data.address_street || null, data.address_city || null, data.address_zip || null, data.address_country || 'Deutschland', data.latitude || null, data.longitude || null, data.status || 'active', JSON.stringify(data.config || {}), createdBy]
      )).rows[0];
      /* Initialen History-Eintrag fuer den neuen Tower erstellen (old_status = NULL) */
      await client.query(
        `INSERT INTO tower_status_history (tower_id,old_status,new_status,reason,changed_by,source) VALUES ($1,NULL,$2,'Tower erstellt',$3,'manual')`,
        [t.id, t.status, createdBy]
      );
      await client.query('COMMIT');
      return t;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  },

  /**
   * Aktualisiert Tower-Stammdaten (NICHT den Status – dafuer updateStatus() verwenden).
   * Nur uebergebene Felder werden aktualisiert (Partial Update).
   */
  async update(id: string, data: Record<string, unknown>) {
    const existing = (await query('SELECT * FROM towers WHERE id=$1', [id])).rows[0];
    if (!existing) throw new AppError('Tower nicht gefunden', 404);

    /* Nur erlaubte Felder dynamisch in die SET-Klausel aufnehmen */
    const fields = ['serial_number','name','description','address_street','address_city','address_zip','address_country','latitude','longitude','config'];
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f}=$${i++}`);
        /* config wird als JSON-String gespeichert */
        vals.push(f === 'config' ? JSON.stringify(data[f]) : data[f]);
      }
    }
    if (!sets.length) return existing;
    vals.push(id);
    return (await query(`UPDATE towers SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals)).rows[0];
  },

  /**
   * Aendert den **operativen Status** eines Towers (z.B. active → warning).
   * Wird sowohl manuell (Controller) als auch automatisch (systemChecks/Scheduler)
   * aufgerufen. Die Transaktion stellt sicher, dass Status-Update und
   * History-Eintrag immer zusammen gespeichert werden.
   *
   * Hinweis: Diese Methode aendert NIEMALS den Lifecycle-Status.
   */
  async updateStatus(id: string, newStatus: TowerStatus, reason: string, changedBy: string | null, source: 'manual' | 'system' = 'manual') {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const old = (await client.query('SELECT status FROM towers WHERE id=$1', [id])).rows[0];
      if (!old) throw new AppError('Tower nicht gefunden', 404);

      const t = (await client.query('UPDATE towers SET status=$1 WHERE id=$2 RETURNING *', [newStatus, id])).rows[0];
      await client.query(
        'INSERT INTO tower_status_history (tower_id,old_status,new_status,reason,changed_by,source) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, old.status, newStatus, reason, changedBy, source]
      );
      /* Bei Ausserbetriebnahme den Zeitstempel setzen */
      if (newStatus === 'decommissioned') {
        await client.query('UPDATE towers SET decommissioned_at=NOW() WHERE id=$1', [id]);
      }
      await client.query('COMMIT');
      return t;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  },

  /**
   * Liefert die paginierte Status-Historie eines Towers mit optionalen Filtern.
   */
  async getStatusHistory(towerId: string, page = 1, limit = 50, filters: { status?: string; source?: string; date_from?: string; date_to?: string } = {}) {
    const exists = (await query('SELECT id FROM towers WHERE id=$1', [towerId])).rows[0];
    if (!exists) throw new AppError('Tower nicht gefunden', 404);

    const { where, vals, nextIdx } = buildHistoryWhere(towerId, filters);
    let i = nextIdx;
    const offset = (page - 1) * limit;
    const total = +(await query(`SELECT count(*) FROM tower_status_history h ${where}`, vals)).rows[0].count;
    const data = (await query(
      `SELECT h.id, h.tower_id, h.old_status, h.new_status, h.reason, h.source, h.changed_at,
              h.changed_by, u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    )).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /**
   * Exportiert die Status-Historie als CSV oder JSON.
   * CSV nutzt UTF-8 BOM und Semikolon als Trennzeichen fuer Excel-Kompatibilitaet.
   */
  async exportStatusHistory(towerId: string, format: 'csv' | 'json', filters: { status?: string; source?: string; date_from?: string; date_to?: string } = {}) {
    const EXPORT_LIMIT = 50_000;
    const tower = (await query('SELECT id, name, serial_number FROM towers WHERE id=$1', [towerId])).rows[0];
    if (!tower) throw new AppError('Tower nicht gefunden', 404);

    const { where, vals, nextIdx } = buildHistoryWhere(towerId, filters);
    /* Vor dem eigentlichen Export pruefen, ob das Limit ueberschritten wird */
    const total = +(await query(`SELECT count(*) FROM tower_status_history h ${where}`, vals)).rows[0].count;
    if (total > EXPORT_LIMIT) throw new AppError(`Export überschreitet das Limit von ${EXPORT_LIMIT} Einträgen (${total} gefunden). Bitte Filter einschränken.`, 400);

    const rows = (await query(
      `SELECT h.old_status, h.new_status, h.reason, h.source, h.changed_at,
              u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${nextIdx}`,
      [...vals, EXPORT_LIMIT]
    )).rows;

    if (format === 'json') {
      return { contentType: 'application/json', filename: `${tower.serial_number}_status-history.json`, body: JSON.stringify(rows, null, 2) };
    }

    /* CSV-Aufbau: Header-Zeile mit deutschen Spaltenbezeichnungen */
    const header = 'Zeitpunkt;Alter Status;Neuer Status;Quelle;Grund;Geändert von;E-Mail';
    const csvRows = rows.map(r => [
      csvEscape(new Date(r.changed_at).toISOString()),
      csvEscape(r.old_status || ''),
      csvEscape(r.new_status),
      csvEscape(r.source),
      csvEscape(r.reason || ''),
      csvEscape(r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : ''),
      csvEscape(r.changed_by_email || ''),
    ].join(';'));
    /* BOM (Byte Order Mark) am Anfang, damit Excel die Datei als UTF-8 erkennt */
    const bom = '\uFEFF';
    return { contentType: 'text/csv; charset=utf-8', filename: `${tower.serial_number}_status-history.csv`, body: bom + header + '\n' + csvRows.join('\n') };
  },

  /** Loescht einen Tower vollstaendig (Cascade-Verhalten abhaengig vom DB-Schema). */
  async remove(id: string) {
    const res = await query('DELETE FROM towers WHERE id=$1 RETURNING id', [id]);
    if (!res.rows.length) throw new AppError('Tower nicht gefunden', 404);
  },

  /** Liefert aggregierte Statistiken: Gesamtanzahl und Aufschluesselung nach Status. */
  async getStats() {
    const total = +(await query('SELECT count(*) FROM towers')).rows[0].count;
    const rows = (await query('SELECT status, count(*) as count FROM towers GROUP BY status')).rows;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = +r.count;
    return { total, byStatus };
  },
};

/**
 * Hilfsfunktion: Baut die WHERE-Klausel fuer Status-Historie-Abfragen.
 * Wird von getStatusHistory() und exportStatusHistory() gemeinsam genutzt.
 * Gibt die Klausel, die Parameterwerte und den naechsten freien Index zurueck.
 */
function buildHistoryWhere(towerId: string, filters: { status?: string; source?: string; date_from?: string; date_to?: string }) {
  const conds: string[] = ['h.tower_id = $1'];
  const vals: unknown[] = [towerId];
  let i = 2;
  if (filters.status) { conds.push(`h.new_status = $${i++}`); vals.push(filters.status); }
  if (filters.source) { conds.push(`h.source = $${i++}`); vals.push(filters.source); }
  if (filters.date_from) { conds.push(`h.changed_at >= $${i++}`); vals.push(filters.date_from); }
  if (filters.date_to) { conds.push(`h.changed_at <= $${i++}`); vals.push(filters.date_to); }
  return { where: `WHERE ${conds.join(' AND ')}`, vals, nextIdx: i };
}

/**
 * Hilfsfunktion: Escaped einen Wert fuer die CSV-Ausgabe.
 * - Fuehrende Sonderzeichen (=, +, -, @) werden mit einem Apostroph prefixed,
 *   um CSV-Injection in Tabellenkalkulationen zu verhindern.
 * - Werte mit Semikolon, Anfuehrungszeichen oder Zeilenumbruechen werden
 *   in doppelte Anfuehrungszeichen eingeschlossen.
 */
function csvEscape(val: string): string {
  let s = val;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
