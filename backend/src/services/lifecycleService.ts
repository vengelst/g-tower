/**
 * @module lifecycleService
 *
 * Zweck:
 *   Verwaltung des wirtschaftlichen Lifecycle-Status eines Towers.
 *   Enthält die State-Machine (erlaubte Transitionen), schreibt History
 *   und unterstützt Export (CSV/JSON).
 *
 * WICHTIG:
 *   - Lifecycle ist strikt getrennt vom operativen Status.
 *   - Scheduler/System-Checks dürfen Lifecycle NICHT verändern.
 */

import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { TowerLifecycleStatus } from '../models/types.js';

const TRANSITIONS: Record<TowerLifecycleStatus, TowerLifecycleStatus[]> = {
  production: ['delivery'],
  delivery: ['storage', 'rented'],
  storage: ['rented'],
  rented: ['return_delivery', 'repair'],
  return_delivery: ['repair', 'reconditioning', 'end_of_life'],
  repair: ['reconditioning', 'end_of_life'],
  reconditioning: ['storage', 'rented', 'end_of_life'],
  end_of_life: ['scrapped'],
  scrapped: [],
};

export const lifecycleService = {
  /** Gibt die erlaubten Ziel-Statuswerte für einen aktuellen Status zurück. */
  getValidTransitions(current: TowerLifecycleStatus): TowerLifecycleStatus[] {
    return TRANSITIONS[current] || [];
  },

  /**
   * Setzt den Lifecycle-Status (manuell) und schreibt einen History-Eintrag.
   * Validiert die Transition serverseitig anhand der State-Machine.
   */
  async updateLifecycleStatus(towerId: string, newStatus: TowerLifecycleStatus, reason: string, changedBy: string) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const tower = (await client.query('SELECT id, lifecycle_status FROM towers WHERE id=$1', [towerId])).rows[0] as { id: string; lifecycle_status: TowerLifecycleStatus } | undefined;
      if (!tower) throw new AppError('Tower nicht gefunden', 404);

      const oldStatus = tower.lifecycle_status;
      if (oldStatus === newStatus) {
        // idempotent: keine History, nur aktuelles Objekt zurückgeben
        const updated = (await client.query('SELECT * FROM towers WHERE id=$1', [towerId])).rows[0];
        await client.query('COMMIT');
        return updated;
      }

      const allowed = this.getValidTransitions(oldStatus);
      if (!allowed.includes(newStatus)) throw new AppError(`Ungültiger Lifecycle-Übergang: ${oldStatus} → ${newStatus}`, 400);

      await client.query('UPDATE towers SET lifecycle_status=$2 WHERE id=$1', [towerId, newStatus]);
      await client.query(
        `INSERT INTO tower_lifecycle_history (tower_id, old_status, new_status, reason, changed_by, source)
         VALUES ($1,$2,$3,$4,$5,'manual')`,
        [towerId, oldStatus, newStatus, reason || null, changedBy],
      );

      const updated = (await client.query('SELECT * FROM towers WHERE id=$1', [towerId])).rows[0];
      await client.query('COMMIT');
      return updated;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /** Liefert die paginierte Lifecycle-Historie eines Towers. */
  async getLifecycleHistory(towerId: string, page = 1, limit = 20, filters: { source?: string; date_from?: string; date_to?: string } = {}) {
    const offset = (page - 1) * limit;
    const conds: string[] = ['h.tower_id = $1'];
    const vals: unknown[] = [towerId];
    let i = 2;
    if (filters.source) { conds.push(`h.source = $${i++}`); vals.push(filters.source); }
    if (filters.date_from) { conds.push(`h.changed_at >= $${i++}`); vals.push(filters.date_from); }
    if (filters.date_to) { conds.push(`h.changed_at <= $${i++}`); vals.push(filters.date_to); }
    const where = `WHERE ${conds.join(' AND ')}`;

    const total = +(await query(`SELECT count(*) FROM tower_lifecycle_history h ${where}`, vals)).rows[0].count;
    const data = (await query(
      `SELECT h.*, u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_lifecycle_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset],
    )).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /** Exportiert die Lifecycle-Historie als CSV oder JSON. */
  async exportLifecycleHistory(towerId: string, format: 'csv' | 'json', filters: { source?: string; date_from?: string; date_to?: string } = {}) {
    const EXPORT_LIMIT = 50_000;
    const tower = (await query('SELECT id, serial_number FROM towers WHERE id=$1', [towerId])).rows[0] as { id: string; serial_number: string } | undefined;
    if (!tower) throw new AppError('Tower nicht gefunden', 404);

    const conds: string[] = ['h.tower_id = $1'];
    const vals: unknown[] = [towerId];
    let i = 2;
    if (filters.source) { conds.push(`h.source = $${i++}`); vals.push(filters.source); }
    if (filters.date_from) { conds.push(`h.changed_at >= $${i++}`); vals.push(filters.date_from); }
    if (filters.date_to) { conds.push(`h.changed_at <= $${i++}`); vals.push(filters.date_to); }
    const where = `WHERE ${conds.join(' AND ')}`;

    const total = +(await query(`SELECT count(*) FROM tower_lifecycle_history h ${where}`, vals)).rows[0].count;
    if (total > EXPORT_LIMIT) throw new AppError(`Export überschreitet das Limit von ${EXPORT_LIMIT} Einträgen (${total} gefunden). Bitte Filter einschränken.`, 400);

    const rows = (await query(
      `SELECT h.old_status, h.new_status, h.reason, h.source, h.changed_at,
              u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_lifecycle_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${i}`,
      [...vals, EXPORT_LIMIT],
    )).rows;

    if (format === 'json') {
      return { contentType: 'application/json', filename: `${tower.serial_number}_lifecycle-history.json`, body: JSON.stringify(rows, null, 2) };
    }

    const header = 'Zeitpunkt;Alter Status;Neuer Status;Quelle;Grund;Geändert von;E-Mail';
    const csvRows = rows.map((r: any) => [
      csvEscape(new Date(r.changed_at).toISOString()),
      csvEscape(r.old_status || ''),
      csvEscape(r.new_status),
      csvEscape(r.source),
      csvEscape(r.reason || ''),
      csvEscape(r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : ''),
      csvEscape(r.changed_by_email || ''),
    ].join(';'));
    const bom = '\uFEFF';
    return { contentType: 'text/csv; charset=utf-8', filename: `${tower.serial_number}_lifecycle-history.csv`, body: bom + header + '\n' + csvRows.join('\n') };
  },
};

function csvEscape(val: string): string {
  let s = val;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

