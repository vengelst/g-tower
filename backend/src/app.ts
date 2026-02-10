/**
 * @module app
 *
 * @description Zentrale Express-Applikation des G-Tower-Backends.
 *   Konfiguriert Middleware (CORS, Body-Parsing), bindet alle API-Routen
 *   unter dem Präfix `/api` ein und registriert die globalen Error-Handler.
 *
 * @role Einstiegspunkt für den HTTP-Server. Wird von `server.ts` (o. Ä.)
 *   importiert und mit `app.listen()` gestartet. Enthält selbst keine
 *   Geschäftslogik – diese liegt in den Services (Route → Controller → Service).
 *
 * @dependencies
 *   - express          – HTTP-Framework
 *   - cors             – Cross-Origin-Middleware
 *   - ./routes/index   – Gesammelter API-Router (alle Domänen-Routen)
 *   - ./middleware/errorHandler – Globale Fehlerbehandlung (404 + generisch)
 *
 * @assumptions
 *   - Die Umgebungsvariable `CORS_ORIGINS` enthält eine kommaseparierte Liste
 *     erlaubter Origins (z. B. "http://localhost:5173,https://app.example.com").
 *     Fehlt sie, wird eine leere Liste verwendet → nur Requests ohne Origin
 *     (z. B. Server-zu-Server) werden durchgelassen.
 *   - Alle API-Endpunkte liegen unter `/api` (z. B. `/api/towers`, `/api/auth`).
 *
 * @changelog
 *   – Initiale Erstellung: Express-Setup mit CORS, JSON-Parsing, Routing.
 */

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

/**
 * Erlaubte CORS-Origins aus der Umgebungsvariable parsen.
 * Kommasepariert, Whitespace wird getrimmt.
 * Leeres Array = kein externer Browser-Origin erlaubt.
 */
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    /**
     * Dynamische Origin-Prüfung:
     * - `!origin` ist true bei Server-zu-Server-Requests (kein Browser) → erlauben.
     * - Ansonsten wird gegen die Whitelist geprüft.
     * - Abgelehnte Origins werden geloggt, aber nicht mit einem Fehler beantwortet
     *   (callback(null, false) setzt lediglich keine CORS-Header).
     */
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(null, false);
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Alle API-Routen unter dem gemeinsamen Präfix `/api` einbinden */
app.use('/api', routes);

/** 404-Handler für nicht gematchte Routen (muss VOR dem generischen Error-Handler stehen) */
app.use(notFoundHandler);

/** Generischer Error-Handler – fängt alle weitergeleiteten Fehler ab */
app.use(errorHandler);

export default app;
