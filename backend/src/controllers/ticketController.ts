/**
 * @module ticketController
 *
 * @description
 * Controller fuer die Ticket-/Aufgabenverwaltung (Stoerungen, Wartungen etc.).
 * Bietet CRUD-Operationen, Zuweisung und Statistiken fuer Tickets.
 *
 * Rolle im Gesamtsystem:
 *   Nimmt HTTP-Anfragen von den Ticket-Routen entgegen und delegiert
 *   saemtliche Geschaeftslogik an den ticketService.
 *   Architektur: Route → Controller → Service.
 *
 * Abhängigkeiten:
 *   - ticketService – Gesamte Ticket-Geschaeftslogik (CRUD, Zuweisung, Stats)
 *
 * Wichtige Annahmen:
 *   - req.user! ist durch authMiddleware garantiert vorhanden (JWT-Payload)
 *     bei schreibenden Endpunkten (create).
 *   - Tickets sind immer einem Tower zugeordnet (towerId).
 *   - camelCase im Request-Body wird hier auf snake_case fuer den Service gemappt.
 *
 * Aenderungshinweise:
 *   - Neue Ticket-Endpunkte (z.B. Kommentare) als weitere Methoden ergaenzen.
 *   - Validierung und Geschaeftslogik gehoeren in den ticketService.
 */
import { Request, Response, NextFunction } from 'express';
import { ticketService } from '../services/ticketService.js';

export const ticketController = {
  /**
   * Gibt eine paginierte, optional gefilterte Liste aller Tickets zurueck.
   * Unterstuetzte Filter: towerId, status, type, priority, assignedTo.
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, towerId, status, type, priority, assignedTo } = req.query as unknown as {
        page: number; limit: number; towerId?: string; status?: string;
        type?: string; priority?: string; assignedTo?: string;
      };
      res.json(await ticketService.getAll(page, limit, { towerId, status, type, priority, assignedTo }));
    } catch (e) { next(e); }
  },

  /** Gibt ein einzelnes Ticket anhand seiner ID zurueck. */
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await ticketService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  /**
   * Erstellt ein neues Ticket.
   * Mappt camelCase-Felder (towerId, ticketType, assignedTo, dueDate)
   * auf snake_case fuer die Service-/DB-Schicht.
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { towerId, title, description, ticketType, priority, assignedTo, dueDate } = req.body;
      res.status(201).json(await ticketService.create({
        tower_id: towerId, title, description, ticket_type: ticketType, priority, assigned_to: assignedTo, due_date: dueDate,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

  /**
   * Aktualisiert ein bestehendes Ticket (Titel, Beschreibung, Status, etc.).
   * Alle Felder sind optional – nur uebergebene Felder werden geaendert.
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, description, ticketType, priority, status, resolution, dueDate } = req.body;
      res.json(await ticketService.update(req.params.id as string, {
        title, description, ticket_type: ticketType, priority, status, resolution, due_date: dueDate,
      }));
    } catch (e) { next(e); }
  },

  /** Weist ein Ticket einem anderen Benutzer zu. */
  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await ticketService.assign(req.params.id as string, req.body.assignedTo));
    } catch (e) { next(e); }
  },

  /** Loescht ein Ticket. Gibt 204 No Content bei Erfolg zurueck. */
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await ticketService.remove(req.params.id as string); res.status(204).end(); } catch (e) { next(e); }
  },

  /** Gibt aggregierte Ticket-Statistiken zurueck (z.B. offene/geschlossene Tickets). */
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await ticketService.getStats()); } catch (e) { next(e); }
  },
};
