/**
 * @module config/jwt
 *
 * @description Konfiguration fuer die JSON-Web-Token-basierte Authentifizierung.
 *   Buendelt alle JWT-relevanten Parameter in einem zentralen Objekt.
 *
 * @role Wird von der Auth-Middleware und dem Auth-Service importiert, um
 *   Tokens zu signieren (Login) und zu verifizieren (geschuetzte Endpunkte).
 *   Keine eigene Logik – reine Konfiguration.
 *
 * @dependencies
 *   - Keine externen Abhaengigkeiten (nur process.env).
 *
 * @assumptions
 *   - `JWT_SECRET` MUSS als Umgebungsvariable gesetzt sein. Fehlt sie,
 *     fuehrt der `as string`-Cast zu `undefined`, was beim Signieren/
 *     Verifizieren einen Laufzeitfehler ausloest. Eine fruehe Pruefung
 *     beim Serverstart (z. B. in server.ts) wird empfohlen.
 *   - `JWT_EXPIRES_IN` ist optional; Default ist 30 Minuten.
 *   - Algorithmus HS256 (HMAC-SHA256) – symmetrisch, d. h. derselbe
 *     Schluessel wird zum Signieren und Verifizieren verwendet.
 *   - `issuer` und `audience` dienen zur Absicherung gegen Token-Missbrauch
 *     zwischen unterschiedlichen Systemen.
 *
 * @changelog
 *   – Initiale Erstellung: JWT-Konfigurationsobjekt mit Secret, Ablaufzeit,
 *     Algorithmus, Issuer und Audience.
 */

export const jwtConfig = {
  /** Geheimer Schluessel zum Signieren/Verifizieren – MUSS ueber Umgebungsvariable gesetzt werden */
  secret: process.env.JWT_SECRET as string,

  /** Token-Ablaufzeit (z. B. '30m', '1h', '7d'); Default: 30 Minuten */
  expiresIn: process.env.JWT_EXPIRES_IN || '30m',

  /** Signatur-Algorithmus – HS256 ist symmetrisch (gleicher Key fuer Sign + Verify) */
  algorithm: 'HS256' as const,

  /** Identifiziert den Aussteller des Tokens – wird beim Verify geprueft */
  issuer: 'gtower-api',

  /** Identifiziert den vorgesehenen Empfaenger – wird beim Verify geprueft */
  audience: 'gtower-client',
};
