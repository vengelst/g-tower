/**
 * @module config/database
 *
 * @description Konfiguration und Bereitstellung des PostgreSQL-Connection-Pools.
 *   Exportiert einen gemeinsam genutzten Pool sowie Hilfsfunktionen für
 *   Einzelabfragen (`query`) und transaktionsfähige Clients (`getClient`).
 *
 * @role Zentrale Datenbankschicht, die von allen Services importiert wird.
 *   Services nutzen `query()` für einfache Abfragen und `getClient()` für
 *   Transaktionen (BEGIN/COMMIT/ROLLBACK). Controller und Routen greifen
 *   NICHT direkt auf die Datenbank zu (Route -> Controller -> Service).
 *
 * @dependencies
 *   - pg (node-postgres) – PostgreSQL-Client für Node.js
 *
 * @assumptions
 *   - Die Umgebungsvariable `DATABASE_URL` enthält einen gültigen
 *     PostgreSQL-Connection-String (z. B. "postgres://user:pass@host:5432/db").
 *   - Der Pool verwendet die pg-Defaults (max 10 Clients, idle-Timeout 10 s),
 *     sofern nicht über die Connection-String-Parameter überschrieben.
 *   - Bei einem Pool-Fehler (z. B. Verbindungsabbruch) wird lediglich geloggt;
 *     ein Neustart des Prozesses muss extern erfolgen (z. B. via PM2/Docker).
 *
 * @changelog
 *   – Initiale Erstellung: Pool-Setup, query-Shortcut, getClient-Export.
 */

import pg from 'pg';

/**
 * Globaler Connection-Pool.
 * Alle Datenbankzugriffe im Backend laufen über diesen Pool,
 * sodass Verbindungen effizient wiederverwendet werden.
 */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Fehler-Listener auf Pool-Ebene.
 * Fängt unerwartete Fehler auf idle Clients ab (z. B. Netzwerkunterbrechung).
 * Ohne diesen Listener würde ein unhandled error den Prozess beenden.
 */
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

/**
 * Führt eine einzelne SQL-Abfrage über den Pool aus.
 * Für einfache CRUD-Operationen ohne Transaktionsbedarf.
 */
export const query = (text: string, params?: unknown[]) => pool.query(text, params);

/**
 * Holt einen dedizierten Client aus dem Pool.
 * Wird für Transaktionen benötigt: client.query('BEGIN') → ... → client.query('COMMIT').
 * WICHTIG: Der Client muss nach Verwendung mit `client.release()` zurückgegeben werden.
 */
export const getClient = () => pool.connect();

export default pool;
