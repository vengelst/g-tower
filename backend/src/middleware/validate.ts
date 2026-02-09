/**
 * @module validate – Request-Validierungs-Middleware (Zod)
 *
 * @description
 * Generische Middleware-Factory, die eingehende Requests (body, query, params)
 * gegen Zod-Schemas validiert. Ersetzt bei Erfolg die Request-Daten durch die
 * geparsten (und ggf. transformierten) Werte.
 *
 * Rolle im Gesamtsystem:
 *   Wird als Middleware VOR den Route-Handlern eingesetzt und stellt sicher,
 *   dass alle Eingabedaten den erwarteten Typen und Constraints entsprechen.
 *   Verhindert, dass ungueltige Daten in die Business-Logik gelangen.
 *
 * Abhaengigkeiten:
 *   - zod (ZodSchema, ZodError)
 *   - express (Request, Response, NextFunction)
 *
 * Wichtige Annahmen:
 *   - Zod-Schemas werden in den jeweiligen Route-Modulen definiert und
 *     an diese Middleware uebergeben.
 *   - body, query und params koennen einzeln oder kombiniert validiert werden.
 *   - Zod's .parse() ersetzt die Originaldaten – dadurch werden Default-Werte
 *     und Transformationen (z.B. .trim(), .transform()) automatisch angewendet.
 *   - Nicht-Zod-Fehler werden an den globalen Error-Handler weitergeleitet.
 *
 * Aenderungshinweise:
 *   - Bei Bedarf koennen weitere Validierungsziele (z.B. headers) ergaenzt werden.
 *   - Die Fehlerformatierung (path + message) kann angepasst werden, falls das
 *     Frontend ein anderes Format erwartet.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Definiert, welche Teile des Requests validiert werden sollen.
 * Jeder Schluessel ist optional – nur angegebene Schemas werden geprueft.
 */
interface ValidationTarget {
  body?: ZodSchema;    // Schema fuer den Request-Body
  query?: ZodSchema;   // Schema fuer Query-Parameter
  params?: ZodSchema;  // Schema fuer URL-Parameter (z.B. :id)
}

/**
 * Middleware-Factory: Gibt eine Express-Middleware zurueck, die den Request
 * gegen die uebergebenen Zod-Schemas validiert.
 *
 * Reihenfolge der Validierung: params → query → body.
 * Bei einem Validierungsfehler wird sofort 400 mit Details zurueckgegeben.
 *
 * @param schemas – Objekt mit optionalen Zod-Schemas fuer body, query, params
 */
export function validate(schemas: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      /*
       * Jedes Schema wird einzeln geprueft. .parse() wirft bei Fehlern eine ZodError.
       * Die geparsten Werte ersetzen die Originale, damit nachfolgende Handler
       * bereits bereinigte/transformierte Daten erhalten.
       */
      if (schemas.params) (req as any).params = schemas.params.parse(req.params);
      if (schemas.query) (req as any).query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        /* Zod-Fehler: Alle Validierungsprobleme als lesbare Strings zusammenfassen */
        const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
        res.status(400).json({ error: 'Validierungsfehler', details: messages });
        return;
      }
      /* Unerwarteter Fehler (kein Zod) → an globalen Error-Handler weiterleiten */
      next(err);
    }
  };
}
