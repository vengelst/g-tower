/**
 * @module userController
 *
 * @description
 * Controller fuer die Benutzerverwaltung – CRUD-Operationen und Deaktivierung
 * von Benutzerkonten durch Administratoren.
 *
 * Rolle im Gesamtsystem:
 *   Nimmt HTTP-Anfragen von den User-Routen entgegen und delegiert
 *   saemtliche Geschaeftslogik an den userService.
 *   Architektur: Route → Controller → Service.
 *
 * Abhängigkeiten:
 *   - userService – Gesamte Benutzer-Geschaeftslogik (Anlegen, Aendern, Deaktivieren)
 *
 * Wichtige Annahmen:
 *   - req.user! ist durch authMiddleware garantiert vorhanden (JWT-Payload).
 *   - Alle Endpunkte erfordern Admin-Berechtigung (durch Routen-Middleware geprueft).
 *   - Benutzer werden deaktiviert (Soft-Delete), nicht physisch geloescht.
 *   - req.user!.userId wird bei create/update mitgegeben, damit im Service
 *     nachvollziehbar ist, WER die Aenderung vorgenommen hat.
 *
 * Aenderungshinweise:
 *   - Neue User-Endpunkte (z.B. Passwort-Reset durch Admin) hier ergaenzen.
 *   - Validierung und Geschaeftslogik gehoeren in den userService.
 */
import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService.js';

export const userController = {
  /** Gibt eine paginierte Liste aller Benutzer zurueck. */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      res.json(await userService.getAll(page, limit));
    } catch (e) { next(e); }
  },

  /** Gibt einen einzelnen Benutzer anhand seiner ID zurueck. */
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await userService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  /**
   * Erstellt einen neuen Benutzer.
   * req.user!.userId identifiziert den Admin, der den Benutzer anlegt.
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName, roles } = req.body;
      res.status(201).json(await userService.create(email, password, firstName, lastName, roles, req.user!.userId));
    } catch (e) { next(e); }
  },

  /**
   * Aktualisiert Benutzerdaten (E-Mail, Name, Rollen, Aktivstatus).
   * Alle Felder sind optional – nur uebergebene Felder werden geaendert.
   * req.user!.userId identifiziert den Admin, der die Aenderung vornimmt.
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, firstName, lastName, isActive, roles } = req.body;
      res.json(await userService.update(req.params.id as string, { email, firstName, lastName, isActive, roles }, req.user!.userId));
    } catch (e) { next(e); }
  },

  /**
   * Deaktiviert einen Benutzer (Soft-Delete).
   * Der Benutzer wird nicht physisch geloescht, sondern als inaktiv markiert.
   * Gibt 204 No Content bei Erfolg zurueck.
   */
  async deactivate(req: Request, res: Response, next: NextFunction) {
    try { await userService.deactivate(req.params.id as string); res.status(204).send(); } catch (e) { next(e); }
  },
};
