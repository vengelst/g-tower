/**
 * @module routes/index
 *
 * @description Zentraler API-Router (Mount-Punkt: /api)
 *
 * Zweck:
 *   Aggregiert alle Domänen-Router des Backends unter einem gemeinsamen
 *   Präfix und stellt den Health-Check-Endpunkt bereit.
 *
 * Rolle im Gesamtsystem:
 *   Einzige Datei, die in der Express-App gemountet wird (app.use('/api', router)).
 *   Alle Sub-Router (auth, users, towers, tickets, documents) werden hier
 *   registriert, sodass neue Domänen zentral eingefügt werden können.
 *
 * Abhängigkeiten:
 *   - express.Router
 *   - Domänen-Router: auth, users, towers, tickets, documents
 *
 * Wichtige Annahmen:
 *   - Der Health-Endpunkt (/api/health) ist bewusst NICHT authentifiziert,
 *     damit externe Monitoring-Dienste (z. B. Kubernetes-Probes) ihn
 *     ohne Token erreichen können.
 *   - Die Reihenfolge der router.use()-Aufrufe bestimmt die
 *     Matching-Priorität bei mehrdeutigen Pfaden.
 *
 * Änderungshinweise:
 *   - Neue Domänen-Router hier per router.use() einhängen.
 *   - Health-Endpunkt NICHT hinter authMiddleware verschieben.
 */

import { Router } from 'express';
import auth from './auth.js';
import users from './users.js';
import towers from './towers.js';
import tickets from './tickets.js';
import documents from './documents.js';

const router = Router();

/**
 * Health-Check – absichtlich ohne Authentifizierung.
 * Gibt JSON mit Status und aktuellem Zeitstempel zurück.
 * Wird von Load-Balancern und Monitoring-Tools abgefragt.
 */
router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

/* ── Domänen-Router ────────────────────────────────────────────────── */
router.use('/auth', auth);       // Authentifizierung (Login, Logout, Session)
router.use('/users', users);     // Benutzerverwaltung (nur Admin)
router.use('/towers', towers);   // Turm-Verwaltung und Status/Lifecycle
router.use('/tickets', tickets); // Ticket-/Störungsmanagement
router.use('/documents', documents); // Dokumenten-Upload und -Download

export default router;
