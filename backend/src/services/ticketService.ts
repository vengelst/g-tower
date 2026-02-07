import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export const ticketService = {
  async getAll(page = 1, limit = 20, filters: { towerId?: string; status?: string; type?: string; priority?: string; assignedTo?: string } = {}) {
    const offset = (page - 1) * limit;
    const conds: string[] = []; const vals: unknown[] = []; let i = 1;

    if (filters.towerId) { conds.push(`st.tower_id=$${i++}`); vals.push(filters.towerId); }
    if (filters.status) { conds.push(`st.status=$${i++}`); vals.push(filters.status); }
    if (filters.type) { conds.push(`st.ticket_type=$${i++}`); vals.push(filters.type); }
    if (filters.priority) { conds.push(`st.priority=$${i++}`); vals.push(filters.priority); }
    if (filters.assignedTo) { conds.push(`st.assigned_to=$${i++}`); vals.push(filters.assignedTo); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = +(await query(`SELECT count(*) FROM service_tickets st ${where}`, vals)).rows[0].count;

    const data = (await query(
      `SELECT st.*, t.name as tower_name, t.serial_number as tower_serial,
        concat(ua.first_name,' ',ua.last_name) as assigned_to_name,
        concat(uc.first_name,' ',uc.last_name) as created_by_name
       FROM service_tickets st
       LEFT JOIN towers t ON st.tower_id=t.id
       LEFT JOIN users ua ON st.assigned_to=ua.id
       LEFT JOIN users uc ON st.created_by=uc.id
       ${where} ORDER BY st.created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    )).rows;

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id: string) {
    const res = await query(
      `SELECT st.*, t.name as tower_name, concat(ua.first_name,' ',ua.last_name) as assigned_to_name
       FROM service_tickets st LEFT JOIN towers t ON st.tower_id=t.id LEFT JOIN users ua ON st.assigned_to=ua.id
       WHERE st.id=$1`, [id]
    );
    if (!res.rows.length) throw new AppError('Ticket nicht gefunden', 404);
    return res.rows[0];
  },

  async create(data: Record<string, unknown>, createdBy: string) {
    const towerOk = (await query('SELECT id FROM towers WHERE id=$1', [data.tower_id])).rows.length;
    if (!towerOk) throw new AppError('Tower nicht gefunden', 404);

    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    return (await query(
      `INSERT INTO service_tickets (tower_id,ticket_number,title,description,ticket_type,priority,status,assigned_to,due_date,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9) RETURNING *`,
      [data.tower_id, ticketNumber, data.title, data.description || null, data.ticket_type || 'maintenance', data.priority || 'medium', data.assigned_to || null, data.due_date || null, createdBy]
    )).rows[0];
  },

  async update(id: string, data: Record<string, unknown>) {
    const fields = ['title','description','ticket_type','priority','status','resolution','due_date'];
    const sets: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) {
      if (data[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(data[f]); }
    }
    if (data.status === 'resolved' || data.status === 'closed') sets.push('resolved_at=NOW()');
    if (!sets.length) throw new AppError('Keine Änderungen', 400);
    vals.push(id);
    const res = await query(`UPDATE service_tickets SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    if (!res.rows.length) throw new AppError('Ticket nicht gefunden', 404);
    return res.rows[0];
  },

  async assign(id: string, assignedTo: string) {
    const res = await query('UPDATE service_tickets SET assigned_to=$1, assigned_at=NOW() WHERE id=$2 RETURNING *', [assignedTo, id]);
    if (!res.rows.length) throw new AppError('Ticket nicht gefunden', 404);
    return res.rows[0];
  },

  async remove(id: string) {
    const res = await query('DELETE FROM service_tickets WHERE id=$1 RETURNING id', [id]);
    if (!res.rows.length) throw new AppError('Ticket nicht gefunden', 404);
  },

  async getStats() {
    const total = +(await query('SELECT count(*) FROM service_tickets')).rows[0].count;
    const byStatus: Record<string, number> = {};
    for (const r of (await query('SELECT status, count(*) as count FROM service_tickets GROUP BY status')).rows)
      byStatus[r.status] = +r.count;
    const byPriority: Record<string, number> = {};
    for (const r of (await query('SELECT priority, count(*) as count FROM service_tickets GROUP BY priority')).rows)
      byPriority[r.priority] = +r.count;
    return { total, byStatus, byPriority };
  },
};
