/**
 * @module loginRateLimit – Rate-Limiting fuer Login-Versuche
 *
 * @description
 * Schuetzt den Login-Endpunkt vor Brute-Force-Angriffen durch
 * In-Memory-Rate-Limiting mit progressivem Lockout.
 * Trackt fehlgeschlagene Versuche sowohl pro IP-Adresse als auch
 * pro E-Mail-Adresse, um sowohl Credential-Stuffing als auch
 * gezielte Account-Angriffe zu erkennen.
 *
 * Rolle im Gesamtsystem:
 *   Wird ausschliesslich auf der Login-Route als Middleware eingesetzt
 *   (VOR der eigentlichen Authentifizierungslogik). Ergaenzt die
 *   JWT-basierte Auth-Middleware (auth.ts), die erst NACH dem Login greift.
 *
 * Abhaengigkeiten:
 *   - express (Request, Response, NextFunction)
 *   - Keine externen Abhaengigkeiten (In-Memory-Speicherung via Map)
 *
 * Wichtige Annahmen:
 *   - Laeuft in einem einzelnen Prozess; bei Cluster-/Multi-Instanz-Betrieb
 *     wuerde ein externer Store (z.B. Redis) benoetigt.
 *   - req.body.email ist zum Zeitpunkt des Middleware-Aufrufs bereits geparsed
 *     (body-parser/express.json muss vorher registriert sein).
 *   - req.ip liefert die echte Client-IP (ggf. trust proxy konfigurieren).
 *
 * Aenderungshinweise:
 *   - Fuer horizontale Skalierung auf Redis oder aehnlichen Store umstellen.
 *   - WINDOW_MS, MAX_ATTEMPTS und LOCKOUT-Konstanten bei Bedarf anpassen.
 *   - Der Cleanup-Intervall (5 Min) verhindert unbegrenztes Speicherwachstum.
 */
import { Request, Response, NextFunction } from 'express';

/** Datensatz fuer einen einzelnen Rate-Limit-Schluessel (IP oder E-Mail) */
interface AttemptRecord {
  count: number;         // Anzahl fehlgeschlagener Versuche im aktuellen Fenster
  firstAttempt: number;  // Timestamp des ersten Versuchs im Fenster (ms)
  lockedUntil: number;   // Timestamp, bis wann der Schluessel gesperrt ist (0 = nicht gesperrt)
}

/* ======================== Konfigurationskonstanten ======================== */

const WINDOW_MS = 15 * 60 * 1000;   // 15 min window
const MAX_ATTEMPTS = 5;              // max attempts before lockout
const LOCKOUT_BASE_MS = 60 * 1000;   // 1 min base lockout
const LOCKOUT_MAX_MS = 15 * 60 * 1000; // 15 min max lockout
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/** In-Memory-Speicher: Schluessel ("ip:<ip>" oder "email:<email>") → Versuchsdaten */
const attempts = new Map<string, AttemptRecord>();

/**
 * Periodischer Cleanup-Task: Entfernt abgelaufene Eintraege aus der Map,
 * um Speicherlecks bei langlebigen Serverprozessen zu vermeiden.
 * Ein Eintrag wird geloescht, wenn sowohl das Zeitfenster abgelaufen
 * als auch kein aktiver Lockout mehr besteht.
 */
// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttempt > WINDOW_MS && now > record.lockedUntil) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Erzeugt die Rate-Limit-Schluessel fuer den aktuellen Request.
 * Es werden zwei Schluessel verwendet:
 *   - ipKey:    immer vorhanden – begrenzt Versuche pro Quell-IP
 *   - emailKey: nur vorhanden wenn E-Mail im Body – begrenzt Versuche pro Ziel-Account
 */
function getKey(req: Request): { ipKey: string; emailKey: string | null } {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = req.body?.email;
  return {
    ipKey: `ip:${ip}`,
    /* E-Mail wird lowercase normalisiert, um Umgehung durch Grossschreibung zu verhindern */
    emailKey: email ? `email:${email.toLowerCase()}` : null,
  };
}

/**
 * Prueft den aktuellen Zustand eines Rate-Limit-Schluessels.
 *
 * @returns AttemptRecord wenn aktiver Lockout oder laufendes Fenster,
 *          null wenn kein Eintrag oder Fenster abgelaufen (Eintrag wird geloescht).
 */
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

/**
 * Berechnet die Lockout-Dauer basierend auf der Anzahl fehlgeschlagener Versuche.
 * Progressiver Anstieg: 1min → 2min → 4min → 8min → max 15min.
 * Die Verdopplung erfolgt bei jedem weiteren Erreichen von MAX_ATTEMPTS
 * (d.h. bei 5, 10, 15, ... Versuchen).
 */
function getLockoutDuration(count: number): number {
  // Progressive: 1min, 2min, 4min, 8min, capped at 15min
  const duration = LOCKOUT_BASE_MS * Math.pow(2, Math.floor(count / MAX_ATTEMPTS) - 1);
  return Math.min(duration, LOCKOUT_MAX_MS);
}

/**
 * Express-Middleware: Prueft vor dem Login, ob IP oder E-Mail gesperrt sind.
 * Bei aktivem Lockout wird 429 (Too Many Requests) mit Retry-After-Header
 * zurueckgegeben. Andernfalls wird der Request weitergeleitet.
 */
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const { ipKey, emailKey } = getKey(req);

  /* Beide Schluessel pruefen – Blockierung wenn einer von beiden gesperrt ist */
  // Check both keys — block if either is locked
  for (const key of [ipKey, emailKey]) {
    if (!key) continue;
    const record = checkLimit(key);
    if (record && Date.now() < record.lockedUntil) {
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      console.warn(`[RATE-LIMIT] Login blocked for ${key} — retry in ${retryAfter}s`);
      /* Retry-After-Header gibt dem Client an, wann ein neuer Versuch moeglich ist */
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' });
      return;
    }
  }

  next();
}

/**
 * Wird nach einem fehlgeschlagenen Login-Versuch vom Auth-Handler aufgerufen.
 * Erhoeht den Zaehler fuer IP und E-Mail und aktiviert bei Erreichen
 * von MAX_ATTEMPTS einen progressiven Lockout.
 */
export function recordFailedLogin(req: Request): void {
  const { ipKey, emailKey } = getKey(req);
  const now = Date.now();

  for (const key of [ipKey, emailKey]) {
    if (!key) continue;
    const record = attempts.get(key) || { count: 0, firstAttempt: now, lockedUntil: 0 };

    /* Zeitfenster abgelaufen → Zaehler zuruecksetzen fuer neues Fenster */
    // Reset if window expired
    if (now - record.firstAttempt > WINDOW_MS) {
      record.count = 0;
      record.firstAttempt = now;
      record.lockedUntil = 0;
    }

    record.count++;

    /* Schwelle erreicht und kein aktiver Lockout → neuen Lockout setzen */
    if (record.count >= MAX_ATTEMPTS && now >= record.lockedUntil) {
      record.lockedUntil = now + getLockoutDuration(record.count);
      console.warn(`[RATE-LIMIT] Lockout triggered for ${key} — ${record.count} attempts, locked for ${getLockoutDuration(record.count) / 1000}s`);
    }

    attempts.set(key, record);
  }
}

/**
 * Wird nach erfolgreichem Login aufgerufen, um alle Versuchszaehler
 * fuer die betreffende IP und E-Mail zurueckzusetzen.
 * Verhindert, dass ein erfolgreicher Login durch vorherige Fehlversuche
 * nachtraeglich blockiert wird.
 */
export function resetLoginAttempts(req: Request): void {
  const { ipKey, emailKey } = getKey(req);
  attempts.delete(ipKey);
  if (emailKey) attempts.delete(emailKey);
}
