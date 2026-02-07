import { Request, Response, NextFunction } from 'express';
import type { RoleName } from '../models/types.js';

const hierarchy: Record<RoleName, number> = { admin: 4, operator: 3, service: 2, viewer: 1 };

export function requireRoles(...allowed: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Nicht authentifiziert' }); return; }
    if (req.user.roles.some(r => allowed.includes(r))) { next(); return; }
    res.status(403).json({ error: 'Keine Berechtigung' });
  };
}

export function requireMinRole(min: RoleName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Nicht authentifiziert' }); return; }
    const minLvl = hierarchy[min];
    if (req.user.roles.some(r => hierarchy[r] >= minLvl)) { next(); return; }
    res.status(403).json({ error: 'Keine Berechtigung' });
  };
}

export const isAdmin = requireRoles('admin');
export const isOperatorOrAbove = requireMinRole('operator');
export const isServiceOrAbove = requireMinRole('service');
