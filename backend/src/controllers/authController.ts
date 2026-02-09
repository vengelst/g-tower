/**
 * @module authController
 *
 * @description
 * Controller fuer Authentifizierung (Login, Logout, aktuelle Sitzung).
 *
 * Rolle im Gesamtsystem:
 *   Empfaengt HTTP-Anfragen von den Auth-Routen und delegiert die gesamte
 *   Geschaeftslogik an den authService. Zusaetzlich werden Audit-Logs
 *   geschrieben und der Brute-Force-Schutz (Login-Rate-Limit) gesteuert.
 *
 * Abhängigkeiten:
 *   - authService        – Authentifizierungs-Geschaeftslogik (Login, User-Daten)
 *   - createAuditLog     – Schreibt revisionssichere Audit-Eintraege
 *   - loginRateLimit     – Zaehler fuer fehlgeschlagene Login-Versuche (IP-basiert)
 *   - AppError           – Einheitliche Fehlerklasse des Projekts
 *
 * Wichtige Annahmen:
 *   - Bei /me und /logout ist req.user durch authMiddleware garantiert gesetzt (JWT-Payload).
 *   - Bei /login ist req.user NICHT vorhanden (oeffentlicher Endpunkt).
 *   - Fehlermeldungen werden auf Deutsch an den Client zurueckgegeben.
 *
 * Aenderungshinweise:
 *   - Neue Auth-Endpunkte (z.B. Passwort-Reset) hier als weitere Methoden ergaenzen.
 *   - Geschaeftslogik gehoert NICHT in diesen Controller, sondern in authService.
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { createAuditLog } from '../middleware/audit.js';
import { recordFailedLogin, resetLoginAttempts } from '../middleware/loginRateLimit.js';
import { AppError } from '../middleware/errorHandler.js';

export const authController = {
  /**
   * Benutzer-Login: Validiert Zugangsdaten und gibt JWT zurueck.
   * Bei Erfolg wird der Fehlzaehler zurueckgesetzt, bei Misserfolg erhoeht.
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      // Login erfolgreich – Brute-Force-Zaehler fuer diese IP zuruecksetzen
      resetLoginAttempts(req);

      // Audit-Eintrag fuer erfolgreichen Login (inkl. IP fuer Nachvollziehbarkeit)
      await createAuditLog(result.user.id, email, 'login', 'user', result.user.id, null, null, req.ip || null);
      res.json(result);
    } catch (e) {
      // Nur bei tatsaechlich falschem Passwort (401) den Fehlzaehler erhoehen
      if (e instanceof AppError && e.statusCode === 401) {
        recordFailedLogin(req);
        console.warn(`[AUTH] Failed login attempt for ${req.body.email} from ${req.ip}`);
        await createAuditLog(null, req.body.email, 'login_failed', 'user', null, null, null, req.ip || null);
      }
      next(e);
    }
  },

  /**
   * Benutzer-Logout: Schreibt Audit-Eintrag und bestaetigt die Abmeldung.
   * Token-Invalidierung findet clientseitig statt (JWT wird verworfen).
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) await createAuditLog(req.user.userId, req.user.email, 'logout', 'user', req.user.userId, null, null, req.ip || null);
      res.json({ message: 'Abgemeldet' });
    } catch (e) { next(e); }
  },

  /**
   * Gibt die Profildaten des aktuell angemeldeten Benutzers zurueck.
   * req.user! ist durch authMiddleware garantiert vorhanden.
   */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.me(req.user!.userId));
    } catch (e) { next(e); }
  },
};
