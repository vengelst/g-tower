/**
 * @module rbac – Rollenbasierte Zugriffskontrolle (Role-Based Access Control)
 *
 * @description
 * Stellt Middleware-Factories bereit, die den Zugriff auf Routen anhand
 * der Benutzerrollen einschraenken. Unterstuetzt sowohl exakte Rollenpruefung
 * als auch hierarchische Mindestrollenpruefung.
 *
 * Rolle im Gesamtsystem:
 *   Zweite Verteidigungslinie NACH der Authentifizierung (auth.ts).
 *   Waehrend auth.ts sicherstellt, dass der Benutzer authentifiziert ist,
 *   prueft rbac.ts, ob er die noetige Berechtigung fuer die jeweilige Route hat.
 *
 * Abhaengigkeiten:
 *   - express (Request, Response, NextFunction)
 *   - ../models/types.js – RoleName-Typdefinition
 *   - Setzt voraus, dass auth.ts vorher ausgefuehrt wurde und req.user gesetzt hat.
 *
 * Wichtige Annahmen:
 *   - Rollenhierarchie: admin(4) > operator(3) > service(2) > viewer(1).
 *   - Ein Benutzer kann mehrere Rollen besitzen (req.user.roles ist ein Array).
 *   - Es genuegt, wenn EINE der Benutzerrollen die Anforderung erfuellt.
 *   - req.user ist undefined, wenn die Auth-Middleware nicht durchlaufen wurde.
 *
 * Aenderungshinweise:
 *   - Bei neuen Rollen muss die `hierarchy`-Map erweitert werden.
 *   - Die vorgefertigten Convenience-Exporte (isAdmin etc.) koennen nach
 *     Bedarf ergaenzt werden.
 */
import { Request, Response, NextFunction } from 'express';
import type { RoleName } from '../models/types.js';

/**
 * Numerische Hierarchie der Rollen. Hoehere Werte bedeuten mehr Rechte.
 * Wird von requireMinRole() fuer den Vergleich herangezogen.
 */
const hierarchy: Record<RoleName, number> = { admin: 4, operator: 3, service: 2, viewer: 1 };

/**
 * Middleware-Factory: Erfordert, dass der Benutzer exakt eine der
 * angegebenen Rollen besitzt. Keine hierarchische Auswertung.
 *
 * Beispiel: requireRoles('admin', 'operator') – erlaubt nur admin ODER operator.
 */
export function requireRoles(...allowed: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Nicht authentifiziert' }); return; }
    /* Pruefe ob mindestens eine Benutzerrolle in der Erlaubt-Liste enthalten ist */
    if (req.user.roles.some(r => allowed.includes(r))) { next(); return; }
    res.status(403).json({ error: 'Keine Berechtigung' });
  };
}

/**
 * Middleware-Factory: Erfordert, dass der Benutzer mindestens die angegebene
 * Rolle in der Hierarchie erreicht. Hoeherstehende Rollen erfuellen die
 * Anforderung automatisch.
 *
 * Beispiel: requireMinRole('service') – erlaubt service(2), operator(3) und admin(4).
 */
export function requireMinRole(min: RoleName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Nicht authentifiziert' }); return; }
    const minLvl = hierarchy[min];
    /* Pruefe ob mindestens eine Benutzerrolle die Mindest-Hierarchiestufe erreicht */
    if (req.user.roles.some(r => hierarchy[r] >= minLvl)) { next(); return; }
    res.status(403).json({ error: 'Keine Berechtigung' });
  };
}

/* ======================== Vorgefertigte Convenience-Middleware ======================== */

/** Nur Administratoren (Rolle "admin") */
export const isAdmin = requireRoles('admin');

/** Operator oder hoeher (operator, admin) */
export const isOperatorOrAbove = requireMinRole('operator');

/** Service oder hoeher (service, operator, admin) */
export const isServiceOrAbove = requireMinRole('service');
