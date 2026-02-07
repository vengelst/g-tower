import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { RoleName } from '../models/types.js';

export const userService = {
  async getAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const total = +(await query('SELECT count(*) FROM users')).rows[0].count;
    const rows = (await query(
      'SELECT id,email,first_name,last_name,is_active,last_login,created_at,updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]
    )).rows;

    const data = await Promise.all(rows.map(async (u: { id: string }) => {
      const r = await query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1', [u.id]);
      return { ...u, roles: r.rows.map((x: { name: string }) => x.name) };
    }));

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id: string) {
    const res = await query('SELECT id,email,first_name,last_name,is_active,last_login,created_at,updated_at FROM users WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Benutzer nicht gefunden', 404);
    const r = await query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1', [id]);
    return { ...res.rows[0], roles: r.rows.map((x: { name: string }) => x.name) };
  },

  async create(email: string, password: string, firstName: string, lastName: string, roles: RoleName[], assignedBy: string) {
    const dup = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (dup.rows.length) throw new AppError('E-Mail bereits vergeben', 400);
    if (password.length < 8) throw new AppError('Passwort muss mind. 8 Zeichen haben', 400);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const hash = await bcrypt.hash(password, 12);
      const u = (await client.query(
        'INSERT INTO users (email,password_hash,first_name,last_name) VALUES ($1,$2,$3,$4) RETURNING id,email,first_name,last_name,is_active,created_at,updated_at',
        [email, hash, firstName, lastName]
      )).rows[0];

      for (const role of roles) {
        const rid = (await client.query('SELECT id FROM roles WHERE name=$1', [role])).rows[0];
        if (rid) await client.query('INSERT INTO user_roles (user_id,role_id,assigned_by) VALUES ($1,$2,$3)', [u.id, rid.id, assignedBy]);
      }
      await client.query('COMMIT');
      return { ...u, roles };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async update(id: string, data: { email?: string; firstName?: string; lastName?: string; isActive?: boolean; roles?: RoleName[] }, updatedBy: string) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const sets: string[] = []; const vals: unknown[] = []; let i = 1;
      if (data.email) { sets.push(`email=$${i++}`); vals.push(data.email); }
      if (data.firstName) { sets.push(`first_name=$${i++}`); vals.push(data.firstName); }
      if (data.lastName) { sets.push(`last_name=$${i++}`); vals.push(data.lastName); }
      if (data.isActive !== undefined) { sets.push(`is_active=$${i++}`); vals.push(data.isActive); }
      if (sets.length) {
        vals.push(id);
        await client.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i}`, vals);
      }
      if (data.roles) {
        await client.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
        for (const role of data.roles) {
          const rid = (await client.query('SELECT id FROM roles WHERE name=$1', [role])).rows[0];
          if (rid) await client.query('INSERT INTO user_roles (user_id,role_id,assigned_by) VALUES ($1,$2,$3)', [id, rid.id, updatedBy]);
        }
      }
      await client.query('COMMIT');
      return this.getById(id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async deactivate(id: string) {
    const res = await query('UPDATE users SET is_active=false WHERE id=$1', [id]);
    if (!res.rowCount) throw new AppError('Benutzer nicht gefunden', 404);
  },
};
