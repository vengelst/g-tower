/**
 * @module errorHandler – Zentrale Fehlerbehandlung
 *
 * @description
 * Stellt die anwendungseigene Fehlerklasse `AppError` sowie die globalen
 * Express-Error-Handler bereit. Unterscheidet zwischen kontrollierten
 * Anwendungsfehlern (AppError) und unerwarteten Laufzeitfehlern.
 *
 * Rolle im Gesamtsystem:
 *   Wird als letzte Middleware in der Express-Pipeline registriert und
 *   faengt alle nicht anderweitig behandelten Fehler ab. Sorgt fuer
 *   einheitliche JSON-Fehlerantworten an den Client.
 *
 * Abhaengigkeiten:
 *   - express (Request, Response, NextFunction)
 *
 * Wichtige Annahmen:
 *   - AppError wird in Route-Handlern und Services geworfen, um kontrollierte
 *     HTTP-Fehlercodes (z.B. 400, 404, 409) zurueckzugeben.
 *   - Alle anderen Fehler (TypeError, DB-Fehler etc.) werden als 500 behandelt.
 *   - Fehlerdetails unbekannter Fehler werden NICHT an den Client gesendet,
 *     um keine internen Informationen preiszugeben.
 *
 * Aenderungshinweise:
 *   - Fuer strukturiertes Logging kann console.error durch einen Logger
 *     (z.B. Winston/Pino) ersetzt werden.
 *   - notFoundHandler muss VOR dem errorHandler registriert werden.
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Anwendungseigene Fehlerklasse fuer kontrollierte HTTP-Fehler.
 * Traegt einen statusCode, der direkt als HTTP-Statuscode verwendet wird.
 *
 * Verwendung: `throw new AppError('Benutzer nicht gefunden', 404);`
 */
export class AppError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
  }
}

/**
 * Globaler Express-Error-Handler (4-Parameter-Signatur, damit Express ihn als
 * Error-Handler erkennt).
 *
 * - AppError-Instanzen: HTTP-Statuscode und Nachricht aus dem Fehler verwenden.
 * - Alle anderen Fehler: 500 mit generischer Meldung, Details nur serverseitig loggen.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    /* Kontrollierter Fehler – statusCode und Nachricht direkt zurueckgeben */
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  /* Unerwarteter Fehler – Details nur auf dem Server loggen, Client erhaelt generische Meldung */
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
}

/**
 * Catch-All fuer nicht definierte Routen.
 * Wird als regulaere Middleware (NICHT Error-Handler) vor dem errorHandler registriert.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route nicht gefunden' });
}
