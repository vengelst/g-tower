import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;   // 15 min window
const MAX_ATTEMPTS = 5;              // max attempts before lockout
const LOCKOUT_BASE_MS = 60 * 1000;   // 1 min base lockout
const LOCKOUT_MAX_MS = 15 * 60 * 1000; // 15 min max lockout
const CLEANUP_INTERVAL = 5 * 60 * 1000;

const attempts = new Map<string, AttemptRecord>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttempt > WINDOW_MS && now > record.lockedUntil) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

function getKey(req: Request): { ipKey: string; emailKey: string | null } {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = req.body?.email;
  return {
    ipKey: `ip:${ip}`,
    emailKey: email ? `email:${email.toLowerCase()}` : null,
  };
}

function checkLimit(key: string): AttemptRecord | null {
  const record = attempts.get(key);
  if (!record) return null;

  const now = Date.now();

  // Locked out?
  if (now < record.lockedUntil) return record;

  // Window expired? Reset
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
    return null;
  }

  return record;
}

function getLockoutDuration(count: number): number {
  // Progressive: 1min, 2min, 4min, 8min, capped at 15min
  const duration = LOCKOUT_BASE_MS * Math.pow(2, Math.floor(count / MAX_ATTEMPTS) - 1);
  return Math.min(duration, LOCKOUT_MAX_MS);
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const { ipKey, emailKey } = getKey(req);

  // Check both keys — block if either is locked
  for (const key of [ipKey, emailKey]) {
    if (!key) continue;
    const record = checkLimit(key);
    if (record && Date.now() < record.lockedUntil) {
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      console.warn(`[RATE-LIMIT] Login blocked for ${key} — retry in ${retryAfter}s`);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' });
      return;
    }
  }

  next();
}

export function recordFailedLogin(req: Request): void {
  const { ipKey, emailKey } = getKey(req);
  const now = Date.now();

  for (const key of [ipKey, emailKey]) {
    if (!key) continue;
    const record = attempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: 0 };

    // Reset if window expired
    if (now - record.firstAttempt > WINDOW_MS) {
      record.count = 0;
      record.firstAttempt = now;
      record.lockedUntil = 0;
    }

    record.count++;

    if (record.count >= MAX_ATTEMPTS && now >= record.lockedUntil) {
      record.lockedUntil = now + getLockoutDuration(record.count);
      console.warn(`[RATE-LIMIT] Lockout triggered for ${key} — ${record.count} attempts, locked for ${getLockoutDuration(record.count) / 1000}s`);
    }

    attempts.set(key, record);
  }
}

export function resetLoginAttempts(req: Request): void {
  const { ipKey, emailKey } = getKey(req);
  attempts.delete(ipKey);
  if (emailKey) attempts.delete(emailKey);
}
