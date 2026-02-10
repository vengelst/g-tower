/**
 * @module routes/users
 *
 * @description Benutzer-Router (Mount-Punkt: /api/users)
 *
 * Zweck:
 *   CRUD-Operationen fuer die Benutzerverwaltung. Ermoeglicht das
 *   Anlegen, Abrufen, Aktualisieren und Deaktivieren von Benutzerkonten.
 *
 * Rolle im Gesamtsystem:
 *   Administrations-Bereich. Nur Benutzer mit der hoechsten Rolle
 *   (admin, Stufe 4) duerfen auf diese Endpunkte zugreifen.
 *   Normale Benutzer verwalten ihr eigenes Profil ueber /api/auth/me.
 *
 * Abhängigkeiten:
 *   - userController        – Geschäftslogik fuer Benutzerverwaltung
 *   - authMiddleware         – Token-Prüfung
 *   - isAdmin                – RBAC-Guard: Rolle == admin (4)
 *   - validate               – Zod-basierte Request-Validierung
 *   - Schemas: paginationQuery, createUserBody, updateUserBody, idParams
 *
 * Wichtige Annahmen:
 *   - authMiddleware UND isAdmin werden global auf Router-Ebene
 *     angewandt, d. h. JEDER Endpunkt ist ausschliesslich fuer
 *     Administratoren erreichbar.
 *   - DELETE deaktiviert den Benutzer (Soft-Delete via
 *     controller.deactivate), loescht ihn also nicht physisch.
 *   - Pagination-Query wird beim Abruf der Benutzerliste validiert.
 *
 * Änderungshinweise:
 *   - Soll ein Endpunkt fuer niedrigere Rollen geoeffnet werden,
 *     muss der Guard von der Router-Ebene entfernt und pro Route
 *     individuell gesetzt werden.
 *   - Bei Einfuehrung von Rollen-Aenderungs-Endpunkten besonderen
 *     Schutz beachten (Privilege Escalation verhindern).
 */

import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { paginationQuery, createUserBody, updateUserBody, idParams } from '../schemas.js';

const router = Router();

/**
 * Globale Middleware fuer den gesamten Users-Router:
 * 1. authMiddleware – stellt sicher, dass ein gueltiges Token vorliegt.
 * 2. isAdmin – erlaubt nur Benutzern mit Rolle admin (Stufe 4) den Zugriff.
 */
router.use(authMiddleware, isAdmin);

/* ── CRUD-Endpunkte (nur Admin) ─────────────────────────────────── */

/** Paginierte Liste aller Benutzer abrufen. */
router.get('/', validate({ query: paginationQuery }), userController.getAll);

/** Einzelnen Benutzer anhand seiner ID abrufen. */
router.get('/:id', validate({ params: idParams }), userController.getById);

/** Neuen Benutzer anlegen. */
router.post('/', validate({ body: createUserBody }), userController.create);

/** Benutzerdaten aktualisieren (vollstaendiges Update). */
router.put('/:id', validate({ params: idParams, body: updateUserBody }), userController.update);

/**
 * Benutzer deaktivieren (Soft-Delete).
 * Der Benutzer wird nicht physisch geloescht, sondern als inaktiv markiert,
 * um Referenzintegritaet (z. B. in Tickets) zu wahren.
 */
router.delete('/:id', validate({ params: idParams }), userController.deactivate);

export default router;
