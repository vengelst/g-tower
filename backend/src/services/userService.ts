/**
 * @module userService
 *
 * Zweck:
 *   Benutzerverwaltung – CRUD-Operationen fuer Benutzerkonten und deren Rollen-Zuweisungen.
 *
 * Rolle im Gesamtsystem:
 *   Wird vom UserController aufgerufen (Route → Controller → Service).
 *   Verwaltet Benutzer-Stammdaten und die Zuordnung von Rollen (n:m ueber user_roles).
 *   Authentifizierung (Login, JWT) liegt beim authService – dieser Service
 *   kuemmert sich nur um die Administration.
 *
 * Abhängigkeiten:
 *   - bcryptjs: Passwort-Hashing bei Neuanlage
 *   - database.query / getClient: DB-Zugriff (Pool-Query bzw. dedizierter Client fuer Transaktionen)
 *   - AppError: Einheitliche Fehlerklasse fuer HTTP-Fehlercodes
 *   - RoleName (Typ): Erlaubte Rollennamen
 *
 * Wichtige Annahmen:
 *   - E-Mail-Adressen sind systemweit eindeutig.
 *   - Passwoerter muessen mindestens 8 Zeichen lang sein.
 *   - bcrypt-Kostenfaktor ist 12 (Sicherheit vs. Performance).
 *   - create() und update() verwenden Transaktionen (getClient + BEGIN/COMMIT/ROLLBACK),
 *     da Benutzer-Anlage und Rollen-Zuweisung atomar erfolgen muessen.
 *   - update() loescht bei Rollen-Aenderungen alle bestehenden Zuordnungen
 *     und legt sie neu an (Delete + Re-Insert Strategie).
 *   - deactivate() setzt nur is_active=false, loescht den Benutzer aber nicht.
 *     Deaktivierte Benutzer koennen sich nicht mehr anmelden (siehe authService.login).
 *   - getAll() laedt Rollen per N+1-Query (eine Abfrage pro Benutzer) –
 *     bei sehr vielen Benutzern koennte das optimiert werden.
 *
 * Änderungshinweise:
 *   - Bei neuen Benutzer-Feldern: create(), update() und getAll()/getById() anpassen.
 *   - Bei neuen Rollen: RoleName-Typ und roles-Tabelle erweitern.
 *   - Passwort-Aenderung ist hier nicht implementiert – ggf. als separate Methode ergaenzen.
 */
import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { RoleName } from '../models/types.js';

export const userService = {
  /**
   * Listet alle Benutzer mit Pagination.
   * Rollen werden pro Benutzer einzeln nachgeladen (N+1-Pattern).
   */
  async getAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const total = +(await query('SELECT count(*) FROM users')).rows[0].count;
    const rows = (await query(
      'SELECT id,email,first_name,last_name,is_active,last_login,created_at,updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]
    )).rows;

    /* Rollen pro Benutzer parallel nachladen */
    const data = await Promise.all(rows.map(async (u: { id: string }) => {
      const r = await query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1', [u.id]);
      return { ...u, roles: r.rows.map((x: { name: string }) => x.name) };
    }));

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /** Laedt einen einzelnen Benutzer mit seinen Rollen. */
  async getById(id: string) {
    const res = await query('SELECT id,email,first_name,last_name,is_active,last_login,created_at,updated_at FROM users WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Benutzer nicht gefunden', 404);
    const r = await query('SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1', [id]);
    return { ...res.rows[0], roles: r.rows.map((x: { name: string }) => x.name) };
  },

  /**
   * Legt einen neuen Benutzer an. Verwendet eine Transaktion, damit
   * Benutzer-Erstellung und Rollen-Zuweisung atomar erfolgen.
   */
  async create(email: string, password: string, firstName: string, lastName: string, roles: RoleName[], assignedBy: string) {
    /* Eindeutigkeit der E-Mail pruefen */
    const dup = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (dup.rows.length) throw new AppError('E-Mail bereits vergeben', 400);
    if (password.length < 8) throw new AppError('Passwort muss mind. 8 Zeichen haben', 400);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      /* Passwort mit bcrypt hashen (Kostenfaktor 12) */
      const hash = await bcrypt.hash(password, 12);
      const u = (await client.query(
        'INSERT INTO users (email,password_hash,first_name,last_name) VALUES ($1,$2,$3,$4) RETURNING id,email,first_name,last_name,is_active,created_at,updated_at',
        [email, hash, firstName, lastName]
      )).rows[0];

      /* Rollen zuweisen: Fuer jede Rolle die ID nachschlagen und Zuordnung erstellen */
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

  /**
   * Aktualisiert einen Benutzer (Partial Update).
   * Rollen werden bei Aenderung komplett neu gesetzt (Delete + Re-Insert),
   * da eine differenzielle Aktualisierung bei wenigen Rollen keinen Vorteil bietet.
   */
  async update(id: string, data: { email?: string; firstName?: string; lastName?: string; isActive?: boolean; roles?: RoleName[] }, updatedBy: string) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      /* Dynamische SET-Klausel: Nur uebergebene Felder aktualisieren */
      const sets: string[] = []; const vals: unknown[] = []; let i = 1;
      if (data.email) { sets.push(`email=$${i++}`); vals.push(data.email); }
      if (data.firstName) { sets.push(`first_name=$${i++}`); vals.push(data.firstName); }
      if (data.lastName) { sets.push(`last_name=$${i++}`); vals.push(data.lastName); }
      if (data.isActive !== undefined) { sets.push(`is_active=$${i++}`); vals.push(data.isActive); }
      if (sets.length) {
        vals.push(id);
        await client.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i}`, vals);
      }
      /* Rollen-Aktualisierung: Alle bestehenden Zuordnungen loeschen und neu anlegen */
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

  /**
   * Deaktiviert einen Benutzer (Soft Delete).
   * Der Benutzer wird nicht geloescht, kann sich aber nicht mehr anmelden.
   */
  async deactivate(id: string) {
    const res = await query('UPDATE users SET is_active=false WHERE id=$1', [id]);
    if (!res.rowCount) throw new AppError('Benutzer nicht gefunden', 404);
  },
};
