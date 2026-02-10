/**
 * @module routes/auth
 *
 * @description Authentifizierungs-Router (Mount-Punkt: /api/auth)
 *
 * Zweck:
 *   Stellt die Endpunkte für Login, Logout und Abruf des aktuell
 *   angemeldeten Benutzers bereit.
 *
 * Rolle im Gesamtsystem:
 *   Einstiegspunkt für die Session-Verwaltung. Login erzeugt ein
 *   Auth-Token (JWT o. Ä.), das von allen anderen geschützten Routen
 *   über authMiddleware geprüft wird.
 *
 * Abhängigkeiten:
 *   - authController       – Geschäftslogik für Login/Logout/Me
 *   - authMiddleware        – prüft das Bearer-Token
 *   - validate              – Zod-basierte Request-Validierung
 *   - loginBody (Schema)    – Validierungsschema für den Login-Body
 *   - loginRateLimit        – Rate-Limiter gegen Brute-Force-Angriffe
 *
 * Wichtige Annahmen:
 *   - /login ist der einzige Endpunkt OHNE authMiddleware,
 *     da der Benutzer hier erst sein Token erhält.
 *   - /login wird zusätzlich durch loginRateLimit geschützt,
 *     um Brute-Force-Angriffe zu verhindern.
 *   - /logout und /me setzen ein gültiges Token voraus (authMiddleware).
 *
 * Änderungshinweise:
 *   - Neue Auth-Endpunkte (z. B. /refresh, /password-reset) hier ergänzen.
 *   - Middleware-Reihenfolge bei /login beachten:
 *     rateLimit → validate → controller.
 */

import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginBody } from '../schemas.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';

const router = Router();

/**
 * POST /login – Benutzer-Anmeldung.
 * Middleware-Kette: loginRateLimit → validate(body) → controller.login
 * Kein authMiddleware, da hier erst das Token erzeugt wird.
 */
router.post('/login', loginRateLimit, validate({ body: loginBody }), authController.login);

/** POST /logout – Aktive Session beenden. Erfordert gültiges Token. */
router.post('/logout', authMiddleware, authController.logout);

/** GET /me – Profildaten des aktuell angemeldeten Benutzers abrufen. */
router.get('/me', authMiddleware, authController.me);

export default router;
