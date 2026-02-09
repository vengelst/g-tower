/**
 * @module routes/tickets
 *
 * @description Ticket-Router (Mount-Punkt: /api/tickets)
 *
 * Zweck:
 *   CRUD-Operationen und Zuweisung fuer Stoerungstickets,
 *   die sich auf einzelne Funktuerme beziehen.
 *
 * Rolle im Gesamtsystem:
 *   Tickets dokumentieren Stoerungen, Wartungsaufgaben oder
 *   sonstige Vorgaenge an Tuermen. Sie sind die operative
 *   Arbeitseinheit fuer Service-Techniker und Operatoren.
 *
 * Abhängigkeiten:
 *   - ticketController      – gesamte Ticket-Geschäftslogik
 *   - authMiddleware         – Token-Prüfung (global auf Router-Ebene)
 *   - isServiceOrAbove       – RBAC-Guard: Rolle >= service (2)
 *   - validate               – Zod-basierte Request-Validierung
 *   - Schemas: ticketListQuery, createTicketBody, updateTicketBody,
 *     assignTicketBody, idParams
 *
 * Wichtige Annahmen:
 *   - authMiddleware wird einmalig auf Router-Ebene angewandt,
 *     gilt also fuer ALLE Endpunkte dieses Routers.
 *   - Lese-Endpunkte (GET) sind fuer alle authentifizierten Rollen
 *     zugaenglich (viewer und hoeher).
 *   - Schreib-Endpunkte (POST/PUT/PATCH/DELETE) erfordern mindestens
 *     die Rolle "service" (Stufe 2), da Viewer nur lesend auf
 *     Tickets zugreifen duerfen.
 *   - Die Ticket-Zuweisung (PATCH /:id/assign) ist ein eigenstaendiger
 *     Endpunkt, damit sie unabhaengig vom sonstigen Update
 *     aufgerufen werden kann.
 *
 * Änderungshinweise:
 *   - Neue Ticket-Endpunkte hier ergänzen (z. B. Kommentar-System).
 *   - Bei Aenderung der Mindest-Rolle Schreib-Guard anpassen
 *     (isServiceOrAbove ↔ isOperatorOrAbove).
 */

import { Router } from 'express';
import { ticketController } from '../controllers/ticketController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isServiceOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ticketListQuery, createTicketBody, updateTicketBody, assignTicketBody, idParams } from '../schemas.js';

const router = Router();

/** Alle Endpunkte dieses Routers erfordern ein gueltiges Auth-Token. */
router.use(authMiddleware);

/* ── Lese-Endpunkte (alle authentifizierten Rollen) ────────────── */

/** Aggregierte Ticket-Statistiken (z. B. offene/geschlossene Tickets). */
router.get('/stats', ticketController.getStats);

/** Paginierte/filtrierbare Liste aller Tickets. */
router.get('/', validate({ query: ticketListQuery }), ticketController.getAll);

/** Einzelnes Ticket anhand seiner ID abrufen. */
router.get('/:id', validate({ params: idParams }), ticketController.getById);

/* ── Schreib-Endpunkte (Rolle >= service) ───────────────────────── */

/** Neues Ticket erstellen. */
router.post('/', isServiceOrAbove, validate({ body: createTicketBody }), ticketController.create);

/** Ticket-Daten aktualisieren (vollstaendiges Update). */
router.put('/:id', isServiceOrAbove, validate({ params: idParams, body: updateTicketBody }), ticketController.update);

/**
 * Ticket einem Bearbeiter zuweisen.
 * Eigener Endpunkt, damit Zuweisung ohne vollstaendiges Update moeglich ist.
 */
router.patch('/:id/assign', isServiceOrAbove, validate({ params: idParams, body: assignTicketBody }), ticketController.assign);

/** Ticket loeschen. */
router.delete('/:id', isServiceOrAbove, validate({ params: idParams }), ticketController.remove);

export default router;
