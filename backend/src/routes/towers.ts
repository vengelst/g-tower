/**
 * @module routes/towers
 *
 * @description Tower-Router (Mount-Punkt: /api/towers)
 *
 * Zweck:
 *   CRUD-Operationen fuer Funktuerme sowie deren operativen Status
 *   und Lifecycle-Verwaltung (Planung → Bau → Betrieb → Rueckbau).
 *
 * Rolle im Gesamtsystem:
 *   Kern-Ressource der Anwendung. Jeder Turm besitzt zwei voneinander
 *   unabhaengige Zustands-Dimensionen:
 *     1. Operativer Status  – aktueller Betriebszustand (online/offline/…)
 *     2. Lifecycle-Status   – Position im Lebenszyklus (geplant/aktiv/…)
 *   Beide haben eigene Historien-Endpunkte mit CSV-Export.
 *
 * Abhängigkeiten:
 *   - towerController       – gesamte Turm-Geschäftslogik
 *   - authMiddleware         – Token-Prüfung (global auf Router-Ebene)
 *   - isOperatorOrAbove      – RBAC-Guard: Rolle >= operator (3)
 *   - validate               – Zod-basierte Request-Validierung
 *   - Schemas: towerListQuery, createTowerBody, updateTowerBody,
 *     updateTowerStatusBody, statusHistoryQuery, statusHistoryExportQuery,
 *     updateLifecycleStatusBody, lifecycleHistoryQuery,
 *     lifecycleHistoryExportQuery, idParams
 *
 * Wichtige Annahmen:
 *   - authMiddleware wird einmalig auf Router-Ebene angewandt,
 *     gilt also fuer ALLE Endpunkte dieses Routers.
 *   - Lese-Endpunkte (GET) sind fuer alle authentifizierten Rollen
 *     zugaenglich (viewer und hoeher).
 *   - Schreib-Endpunkte (POST/PUT/PATCH/DELETE) erfordern mindestens
 *     die Rolle "operator" (Stufe 3).
 *   - Die Lifecycle-Transitionen werden serverseitig validiert
 *     (nur gueltige Uebergaenge erlaubt); der GET-Endpunkt
 *     /lifecycle-transitions liefert die erlaubten Zielzustaende.
 *
 * Änderungshinweise:
 *   - Neue Tower-Endpunkte hier ergänzen, RBAC-Guard je nach
 *     Schutzbedarf setzen (isOperatorOrAbove fuer Schreibzugriffe).
 *   - Export-Endpunkte liefern CSV – bei Formatänderung auch
 *     die zugehoerigen Export-Schemas anpassen.
 */

import { Router } from 'express';
import { towerController } from '../controllers/towerController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isOperatorOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { towerListQuery, createTowerBody, updateTowerBody, updateTowerStatusBody, statusHistoryQuery, statusHistoryExportQuery, updateLifecycleStatusBody, lifecycleHistoryQuery, lifecycleHistoryExportQuery, idParams } from '../schemas.js';

const router = Router();

/** Alle Endpunkte dieses Routers erfordern ein gueltiges Auth-Token. */
router.use(authMiddleware);

/* ── Lese-Endpunkte (alle authentifizierten Rollen) ────────────── */

/** Aggregierte Statistiken ueber alle Tuerme (Dashboard-Kacheln). */
router.get('/stats', towerController.getStats);

/** Paginierte/filtrierbare Liste aller Tuerme. */
router.get('/', validate({ query: towerListQuery }), towerController.getAll);

/** Einzelnen Turm anhand seiner ID abrufen. */
router.get('/:id', validate({ params: idParams }), towerController.getById);

/** Operativer Status-Verlauf eines Turms (paginiert). */
router.get('/:id/status-history', validate({ params: idParams, query: statusHistoryQuery }), towerController.getStatusHistory);

/** CSV-Export des operativen Status-Verlaufs. */
router.get('/:id/status-history/export', validate({ params: idParams, query: statusHistoryExportQuery }), towerController.exportStatusHistory);

/* ── Schreib-Endpunkte (Rolle >= operator) ──────────────────────── */

/** Neuen Turm anlegen. */
router.post('/', isOperatorOrAbove, validate({ body: createTowerBody }), towerController.create);

/** Turm-Stammdaten aktualisieren (vollstaendiges Update). */
router.put('/:id', isOperatorOrAbove, validate({ params: idParams, body: updateTowerBody }), towerController.update);

/** Operativen Status eines Turms aendern (z. B. online → offline). */
router.patch('/:id/status', isOperatorOrAbove, validate({ params: idParams, body: updateTowerStatusBody }), towerController.updateStatus);

/** Turm loeschen (Soft- oder Hard-Delete je nach Controller-Logik). */
router.delete('/:id', isOperatorOrAbove, validate({ params: idParams }), towerController.remove);

/* ── Lifecycle-Endpunkte ────────────────────────────────────────── */

/** Gueltige Lifecycle-Transitionen fuer den aktuellen Zustand abrufen. */
router.get('/:id/lifecycle-transitions', validate({ params: idParams }), towerController.getValidLifecycleTransitions);

/** Lifecycle-Verlauf eines Turms (paginiert). */
router.get('/:id/lifecycle-history', validate({ params: idParams, query: lifecycleHistoryQuery }), towerController.getLifecycleHistory);

/** CSV-Export des Lifecycle-Verlaufs. */
router.get('/:id/lifecycle-history/export', validate({ params: idParams, query: lifecycleHistoryExportQuery }), towerController.exportLifecycleHistory);

/** Lifecycle-Status aendern (z. B. geplant → aktiv). Nur gueltige Transitionen werden akzeptiert. */
router.patch('/:id/lifecycle', isOperatorOrAbove, validate({ params: idParams, body: updateLifecycleStatusBody }), towerController.updateLifecycleStatus);

export default router;
