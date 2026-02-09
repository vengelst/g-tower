/**
 * @module authService
 *
 * Zweck:
 *   Authentifizierungs-Service – verwaltet Login und Benutzer-Selbstauskunft (me).
 *
 * Rolle im Gesamtsystem:
 *   Wird vom AuthController aufgerufen (Route → Controller → Service).
 *   Einziger Ort, an dem JWT-Tokens erzeugt werden. Liefert nach erfolgreicher
 *   Authentifizierung ein signiertes Token samt Benutzerprofil zurück.
 *
 * Abhängigkeiten:
 *   - bcryptjs: Passwort-Hashing und -Vergleich
 *   - jsonwebtoken: JWT-Erzeugung
 *   - database.query: Einzelne SQL-Abfragen (kein Client/Transaktion nötig)
 *   - jwtConfig: Zentrale JWT-Konfiguration (Secret, Algorithmus, TTL, Issuer, Audience)
 *   - AppError: Einheitliche Fehlerklasse für HTTP-Fehlercodes
 *
 * Wichtige Annahmen:
 *   - Ein Benutzer kann mehrere Rollen besitzen (n:m über user_roles).
 *   - Nur aktive Benutzer (is_active=true) dürfen sich anmelden.
 *   - Die Fehlermeldung bei falschem Passwort ist bewusst identisch mit der bei
 *     unbekanntem Benutzer, um Benutzer-Enumeration zu verhindern.
 *   - last_login wird bei jedem erfolgreichen Login aktualisiert.
 *
 * Änderungshinweise:
 *   - Bei Änderungen am JWT-Payload (JwtPayload) muss auch die Middleware
 *     (authMiddleware) angepasst werden, die das Token verifiziert.
 *   - Rollenabfrage wird sowohl in login() als auch in me() durchgeführt –
 *     bei Schema-Änderungen an der Rollen-Tabelle beide Stellen prüfen.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { jwtConfig } from '../config/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import type { JwtPayload, RoleName } from '../models/types.js';

export const authService = {
  /**
   * Authentifiziert einen Benutzer per E-Mail und Passwort.
   * Gibt bei Erfolg ein JWT-Token und das Benutzerprofil zurück.
   */
  async login(email: string, password: string) {
    /* Benutzer anhand E-Mail suchen – nur aktive Accounts berücksichtigen */
    const res = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!res.rows.length) throw new AppError('Ungültige Anmeldedaten', 401);

    const user = res.rows[0];
    /* Passwort gegen den gespeicherten bcrypt-Hash prüfen */
    if (!(await bcrypt.compare(password, user.password_hash)))
      throw new AppError('Ungültige Anmeldedaten', 401);

    /* Alle zugewiesenen Rollen des Benutzers laden (n:m-Beziehung) */
    const rolesRes = await query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=$1`, [user.id]
    );
    const roles: RoleName[] = rolesRes.rows.map((r: { name: RoleName }) => r.name);

    /* JWT-Token mit Benutzer-ID, E-Mail und Rollen als Payload erzeugen */
    const payload: JwtPayload = { userId: user.id, email: user.email, roles };
    const token = jwt.sign(payload, jwtConfig.secret, {
      algorithm: jwtConfig.algorithm,
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    } as jwt.SignOptions);

    /* Letzten Login-Zeitstempel aktualisieren */
    await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    return {
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, is_active: user.is_active, roles, last_login: user.last_login, created_at: user.created_at, updated_at: user.updated_at },
    };
  },

  /**
   * Gibt das Profil des aktuell eingeloggten Benutzers zurück.
   * Wird typischerweise beim Laden der Anwendung aufgerufen, um den
   * Session-Zustand wiederherzustellen.
   */
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
