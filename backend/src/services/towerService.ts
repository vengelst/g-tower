import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { TowerStatus } from '../models/types.js';

export const towerService = {
  async getAll(page = 1, limit = 20, filters: { status?: string; search?: string; city?: string; mode?: string } = {}) {
    if (filters.mode === 'map') {
      const data = (await query(
        `SELECT id, name, serial_number, status, latitude::float, longitude::float FROM towers WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY name LIMIT 2000`
      )).rows;
      return { data, pagination: { total: data.length, page: 1, limit: data.length, totalPages: 1 } };
    }

    const offset = (page - 1) * limit;
    const conds: string[] = []; const vals: unknown[] = []; let i = 1;

    if (filters.status) { conds.push(`status=$${i++}`); vals.push(filters.status); }
    if (filters.city) { conds.push(`address_city ILIKE $${i++}`); vals.push(`%${filters.city}%`); }
    if (filters.search) { conds.push(`(name ILIKE $${i} OR serial_number ILIKE $${i})`); vals.push(`%${filters.search}%`); i++; }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = +(await query(`SELECT count(*) FROM towers ${where}`, vals)).rows[0].count;
    const data = (await query(`SELECT * FROM towers ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`, [...vals, limit, offset])).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id: string) {
    const t = (await query('SELECT * FROM towers WHERE id=$1', [id])).rows[0];
    if (!t) throw new AppError('Tower nicht gefunden', 404);

    const [historyRes, ticketsRes, documentsRes] = await Promise.all([
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
    ]);

    return { ...t, statusHistory: historyRes.rows, tickets: ticketsRes.rows, documents: documentsRes.rows };
  },

  async create(data: Record<string, unknown>, createdBy: string) {
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
      await client.query(
        `INSERT INTO tower_status_history (tower_id,old_status,new_status,reason,changed_by) VALUES ($1,NULL,$2,'Tower erstellt',$3)`,
        [t.id, t.status, createdBy]
      );
      await client.query('COMMIT');
      return t;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  },

  async update(id: string, data: Record<string, unknown>) {
    const existing = (await query('SELECT * FROM towers WHERE id=$1', [id])).rows[0];
    if (!existing) throw new AppError('Tower nicht gefunden', 404);

    const fields = ['serial_number','name','description','address_street','address_city','address_zip','address_country','latitude','longitude','config'];
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f}=$${i++}`);
        vals.push(f === 'config' ? JSON.stringify(data[f]) : data[f]);
      }
    }
    if (!sets.length) return existing;
    vals.push(id);
    return (await query(`UPDATE towers SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals)).rows[0];
  },

  async updateStatus(id: string, newStatus: TowerStatus, reason: string, changedBy: string) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const old = (await client.query('SELECT status FROM towers WHERE id=$1', [id])).rows[0];
      if (!old) throw new AppError('Tower nicht gefunden', 404);

      const t = (await client.query('UPDATE towers SET status=$1 WHERE id=$2 RETURNING *', [newStatus, id])).rows[0];
      await client.query(
        'INSERT INTO tower_status_history (tower_id,old_status,new_status,reason,changed_by) VALUES ($1,$2,$3,$4,$5)',
        [id, old.status, newStatus, reason, changedBy]
      );
      if (newStatus === 'decommissioned') {
        await client.query('UPDATE towers SET decommissioned_at=NOW() WHERE id=$1', [id]);
      }
      await client.query('COMMIT');
      return t;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  },

  async remove(id: string) {
    const res = await query('DELETE FROM towers WHERE id=$1 RETURNING id', [id]);
    if (!res.rows.length) throw new AppError('Tower nicht gefunden', 404);
  },

  async getStats() {
    const total = +(await query('SELECT count(*) FROM towers')).rows[0].count;
    const rows = (await query('SELECT status, count(*) as count FROM towers GROUP BY status')).rows;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = +r.count;
    return { total, byStatus };
  },
};
