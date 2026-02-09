/**
 * @module auth – Authentifizierungs-Middleware
 *
 * @description
 * Verifiziert JWT-Bearer-Tokens aus dem Authorization-Header und reichert
 * das Express-Request-Objekt mit den dekodierten Benutzerdaten an (`req.user`).
 * Wird als Guard vor geschuetzten Routen eingesetzt.
 *
 * Rolle im Gesamtsystem:
 *   Erste Verteidigungslinie: Jede geschuetzte Route durchlaeuft zuerst diese
 *   Middleware, bevor RBAC (rbac.ts) die Rollenebene prueft.
 *
 * Abhaengigkeiten:
 *   - jsonwebtoken          – Token-Verifizierung (HS256)
 *   - ../config/jwt.js      – Zentrale JWT-Konfiguration (secret, algorithm, issuer, audience)
 *   - ../models/types.js    – JwtPayload- und RoleName-Typdefinitionen
 *
 * Wichtige Annahmen:
 *   - Der Token wird als "Bearer <token>" im Authorization-Header uebergeben.
 *   - Der Payload enthaelt immer userId (string), email (string) und roles (RoleName[]).
 *   - Gueltige Rollen sind ausschliesslich: admin, operator, service, viewer.
 *   - Die JWT-Konfiguration (secret, issuer, audience) ist zur Laufzeit korrekt gesetzt.
 *
 * Aenderungshinweise:
 *   - Bei Erweiterung des Rollenmodells muss VALID_ROLES angepasst werden.
 *   - Soll auf asymmetrische Signaturen (RS256) umgestellt werden, muessen
 *     jwtConfig.algorithm und die verify-Optionen geaendert werden.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import type { JwtPayload, RoleName } from '../models/types.js';

/**
 * Globale Erweiterung des Express-Request-Typs um das optionale `user`-Feld.
 * Dadurch koennen nachfolgende Middleware und Route-Handler typsicher auf
 * die JWT-Payload-Daten zugreifen.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Menge aller gueltig anerkannten Rollennamen – dient der Payload-Validierung. */
const VALID_ROLES: ReadonlySet<string> = new Set<RoleName>(['admin', 'operator', 'service', 'viewer']);

/**
 * Type-Guard: Prueft, ob das dekodierte JWT-Objekt die erwartete Struktur hat.
 * Stellt sicher, dass userId und email nicht-leere Strings sind und
 * mindestens eine gueltige Rolle vorhanden ist.
 * Verhindert, dass manipulierte oder fehlerhafte Tokens akzeptiert werden.
 */
function isValidPayload(decoded: unknown): decoded is JwtPayload {
  if (typeof decoded !== 'object' || decoded === null) return false;
  const obj = decoded as Record<string, unknown>;
  if (typeof obj.userId !== 'string' || !obj.userId) return false;
  if (typeof obj.email !== 'string' || !obj.email) return false;
  if (!Array.isArray(obj.roles) || obj.roles.length === 0) return false;
  /* Jede Rolle muss ein String sein UND in der erlaubten Menge enthalten sein */
  return obj.roles.every((r: unknown) => typeof r === 'string' && VALID_ROLES.has(r));
}

/**
 * Express-Middleware: Authentifizierung via JWT.
 *
 * Ablauf:
 *   1. Authorization-Header auf "Bearer "-Praefix pruefen.
 *   2. Token mit HS256, Issuer und Audience verifizieren.
 *   3. Payload-Struktur mit isValidPayload validieren.
 *   4. Bei Erfolg: req.user setzen und an naechste Middleware weiterleiten.
 *   5. Bei Fehler: 401-Antwort zurueckgeben (kein next()-Aufruf).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  /* Fehlender oder falsch formatierter Header → sofort ablehnen */
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Kein Token vorhanden' });
    return;
  }
  try {
    /* Token nach dem "Bearer "-Praefix extrahieren und kryptographisch pruefen */
    const decoded = jwt.verify(header.split(' ')[1], jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
    /* Strukturelle Payload-Validierung (userId, email, roles) */
    if (!isValidPayload(decoded)) {
      res.status(401).json({ error: 'Token-Payload ungültig' });
      return;
    }
    /* Validierte Benutzerdaten fuer nachfolgende Middleware/Handler bereitstellen */
    req.user = decoded;
    next();
  } catch {
    /* Faengt sowohl abgelaufene als auch ungueltig signierte Tokens ab */
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}
