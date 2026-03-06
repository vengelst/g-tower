import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { TowerLifecycleStatus } from '../models/types.js';

const VALID_TRANSITIONS: Record<TowerLifecycleStatus, TowerLifecycleStatus[]> = {
  production:      ['delivery', 'storage', 'end_of_life'],
  delivery:        ['storage', 'rented'],
  storage:         ['delivery', 'rented', 'repair', 'end_of_life'],
  rented:          ['return_delivery'],
  return_delivery: ['storage', 'repair', 'reconditioning'],
  repair:          ['storage', 'reconditioning', 'end_of_life'],
  reconditioning:  ['storage', 'end_of_life'],
  end_of_life:     ['scrapped'],
  scrapped:        [],
};

function buildLifecycleWhere(towerId: string, filters: { source?: string; date_from?: string; date_to?: string }) {
  const conds: string[] = ['h.tower_id = $1'];
  const vals: unknown[] = [towerId];
  let i = 2;
  if (filters.source)    { conds.push(`h.source = $${i++}`);       vals.push(filters.source); }
  if (filters.date_from) { conds.push(`h.changed_at >= $${i++}`);  vals.push(filters.date_from); }
  if (filters.date_to)   { conds.push(`h.changed_at <= $${i++}`);  vals.push(filters.date_to); }
  return { where: `WHERE ${conds.join(' AND ')}`, vals, nextIdx: i };
}

function csvEscape(val: string): string {
  let s = val;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const lifecycleService = {
  getValidTransitions(current: string): TowerLifecycleStatus[] {
    return VALID_TRANSITIONS[current as TowerLifecycleStatus] ?? [];
  },

  async updateLifecycleStatus(towerId: string, newStatus: TowerLifecycleStatus, reason: string, changedBy: string) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const old = (await client.query('SELECT lifecycle_status FROM towers WHERE id=$1', [towerId])).rows[0];
      if (!old) throw new AppError('Tower nicht gefunden', 404);

      const allowed = VALID_TRANSITIONS[old.lifecycle_status as TowerLifecycleStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new AppError(`Ungültiger Übergang: ${old.lifecycle_status} → ${newStatus}`, 400);
      }

      const t = (await client.query('UPDATE towers SET lifecycle_status=$1 WHERE id=$2 RETURNING *', [newStatus, towerId])).rows[0];
      await client.query(
        'INSERT INTO tower_lifecycle_history (tower_id,old_status,new_status,reason,changed_by,source) VALUES ($1,$2,$3,$4,$5,$6)',
        [towerId, old.lifecycle_status, newStatus, reason, changedBy, 'manual']
      );
      await client.query('COMMIT');
      return t;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  },

  async getLifecycleHistory(towerId: string, page = 1, limit = 50, filters: { source?: string; date_from?: string; date_to?: string } = {}) {
    const exists = (await query('SELECT id FROM towers WHERE id=$1', [towerId])).rows[0];
    if (!exists) throw new AppError('Tower nicht gefunden', 404);

    const { where, vals, nextIdx } = buildLifecycleWhere(towerId, filters);
    let i = nextIdx;
    const offset = (page - 1) * limit;
    const total = +(await query(`SELECT count(*) FROM tower_lifecycle_history h ${where}`, vals)).rows[0].count;
    const data = (await query(
      `SELECT h.id, h.tower_id, h.old_status, h.new_status, h.reason, h.source, h.changed_at,
              h.changed_by, u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_lifecycle_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    )).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async exportLifecycleHistory(towerId: string, format: 'csv' | 'json', filters: { source?: string; date_from?: string; date_to?: string } = {}) {
    const EXPORT_LIMIT = 50_000;
    const tower = (await query('SELECT id, name, serial_number FROM towers WHERE id=$1', [towerId])).rows[0];
    if (!tower) throw new AppError('Tower nicht gefunden', 404);

    const { where, vals, nextIdx } = buildLifecycleWhere(towerId, filters);
    const total = +(await query(`SELECT count(*) FROM tower_lifecycle_history h ${where}`, vals)).rows[0].count;
    if (total > EXPORT_LIMIT) throw new AppError(`Export überschreitet das Limit von ${EXPORT_LIMIT} Einträgen (${total} gefunden). Bitte Filter einschränken.`, 400);

    const rows = (await query(
      `SELECT h.old_status, h.new_status, h.reason, h.source, h.changed_at,
              u.email as changed_by_email, u.first_name, u.last_name
       FROM tower_lifecycle_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ${where}
       ORDER BY h.changed_at DESC, h.id DESC
       LIMIT $${nextIdx}`,
      [...vals, EXPORT_LIMIT]
    )).rows;

    if (format === 'json') {
      return { contentType: 'application/json', filename: `${tower.serial_number}_lifecycle-history.json`, body: JSON.stringify(rows, null, 2) };
    }

    const header = 'Zeitpunkt;Alter Status;Neuer Status;Quelle;Grund;Geändert von;E-Mail';
    const csvRows = rows.map((r: Record<string, string | null>) => [
      csvEscape(new Date(r.changed_at!).toISOString()),
      csvEscape(r.old_status || ''),
      csvEscape(r.new_status!),
      csvEscape(r.source!),
      csvEscape(r.reason || ''),
      csvEscape(r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : ''),
      csvEscape(r.changed_by_email || ''),
    ].join(';'));
    const bom = '\uFEFF';
    return { contentType: 'text/csv; charset=utf-8', filename: `${tower.serial_number}_lifecycle-history.csv`, body: bom + header + '\n' + csvRows.join('\n') };
  },
};
