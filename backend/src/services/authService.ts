import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import type { JwtPayload, RoleName } from '../models/types.js';

export const authService = {
  async login(email: string, password: string) {
    const res = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!res.rows.length) throw new AppError('Ungültige Anmeldedaten', 401);

    const user = res.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash)))
      throw new AppError('Ungültige Anmeldedaten', 401);

    const rolesRes = await query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1`, [user.id]
    );
    const roles: RoleName[] = rolesRes.rows.map((r: { name: RoleName }) => r.name);

    const payload: JwtPayload = { userId: user.id, email: user.email, roles };
    const token = jwt.sign(payload, jwtConfig.secret, {
      algorithm: jwtConfig.algorithm,
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    } as jwt.SignOptions);

    await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    return {
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, is_active: user.is_active, roles, last_login: user.last_login, created_at: user.created_at, updated_at: user.updated_at },
    };
  },

  async me(userId: string) {
    const res = await query(
      'SELECT id,email,first_name,last_name,is_active,last_login,created_at,updated_at FROM users WHERE id=$1', [userId]
    );
    if (!res.rows.length) throw new AppError('Benutzer nicht gefunden', 404);
    const rolesRes = await query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1`, [userId]
    );
    return { ...res.rows[0], roles: rolesRes.rows.map((r: { name: string }) => r.name) };
  },
};
