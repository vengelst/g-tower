import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import type { JwtPayload, RoleName } from '../models/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const VALID_ROLES: ReadonlySet<string> = new Set<RoleName>(['admin', 'operator', 'service', 'viewer']);

function isValidPayload(decoded: unknown): decoded is JwtPayload {
  if (typeof decoded !== 'object' || decoded === null) return false;
  const obj = decoded as Record<string, unknown>;
  if (typeof obj.userId !== 'string' || !obj.userId) return false;
  if (typeof obj.email !== 'string' || !obj.email) return false;
  if (!Array.isArray(obj.roles) || obj.roles.length === 0) return false;
  return obj.roles.every((r: unknown) => typeof r === 'string' && VALID_ROLES.has(r));
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Kein Token vorhanden' });
    return;
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
    if (!isValidPayload(decoded)) {
      res.status(401).json({ error: 'Token-Payload ungültig' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}
