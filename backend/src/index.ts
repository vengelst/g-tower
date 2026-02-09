/**
 * index.ts – Einstiegspunkt des G-Tower Backends
 * =============================================================================
 * Zweck:         Lädt Umgebungsvariablen, prüft Pflichtfelder, startet den
 *                Express-Server und den System-Check-Scheduler.
 * Rolle:         Wird als erster Code ausgeführt (CMD in Dockerfile).
 *                Orchestriert den Startup-Prozess.
 * Abhängigkeiten: dotenv (.env-Datei), app.ts (Express-App), systemChecks.ts
 * Wichtige Annahmen:
 *   - In Produktion (NODE_ENV=production) bricht der Start bei fehlenden
 *     Umgebungsvariablen sofort ab (process.exit(1))
 *   - In Entwicklung wird nur gewarnt, damit der Dev-Server trotzdem startet
 *   - Der Scheduler für System-Checks läuft in-process (kein separater Worker)
 *   - System-Checks prüfen NUR den operativen Status (battery, heartbeat).
 *     Der Lifecycle-Status wird vom Scheduler NIEMALS verändert.
 * Änderungshinweise:
 *   - Neue Pflicht-Umgebungsvariablen in requiredEnv ergänzen
 *   - Scheduler-Intervall über SYSTEM_CHECK_INTERVAL_MS konfigurierbar
 */

import dotenv from 'dotenv';
dotenv.config();

// Pflicht-Umgebungsvariablen: Ohne diese kann die App nicht korrekt arbeiten
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL', 'CORS_ORIGINS'] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    // Produktion: Sofortiger Abbruch – fehlende Secrets = Sicherheitsrisiko
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    // Entwicklung: Nur Warnung, damit docker compose up trotzdem funktioniert
    console.warn(`WARNING: Missing environment variables: ${missing.join(', ')} — set them before deploying to production`);
  }
}

import app from './app.js';
import { runSystemChecks } from './services/systemChecks.js';

const PORT = process.env.PORT || 3000;
// Scheduler-Intervall: Wie oft System-Checks laufen (Standard: 60 Sekunden)
const SYSTEM_CHECK_INTERVAL_MS = parseInt(process.env.SYSTEM_CHECK_INTERVAL_MS || '60000', 10);

app.listen(PORT, () => {
  console.log(`G-Tower Backend running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);

  // System-Check-Scheduler: Prüft regelmäßig battery_level und last_heartbeat
  // aller Towers und setzt ggf. den operativen Status (warning/critical/offline).
  // Geschützte Status (maintenance, decommissioned) werden NICHT überschrieben.
  console.log(`[SystemChecks] Scheduler started — interval: ${SYSTEM_CHECK_INTERVAL_MS}ms`);
  setInterval(runSystemChecks, SYSTEM_CHECK_INTERVAL_MS);
  // Erster Lauf sofort beim Start, danach im Intervall
  runSystemChecks();
});
