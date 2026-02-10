/**
 * @module towerController
 *
 * @description
 * Controller fuer die Tower-Verwaltung – der zentrale Ressourcen-Controller der Anwendung.
 * Umfasst CRUD-Operationen, operativen Statuswechsel, Lifecycle-Management
 * sowie Historie-Abfragen und -Exporte.
 *
 * Rolle im Gesamtsystem:
 *   Nimmt HTTP-Anfragen von den Tower-Routen entgegen und leitet sie an
 *   towerService (CRUD + operativer Status) bzw. lifecycleService
 *   (Lifecycle-Status) weiter. Enthaelt selbst KEINE Geschaeftslogik.
 *
 * Abhängigkeiten:
 *   - towerService      – CRUD, operativer Statuswechsel, Statistiken, Historie-Export
 *   - lifecycleService  – Lifecycle-Statuswechsel, -Historie, -Export, Transitions
 *
 * Wichtige Annahmen:
 *   - req.user! ist durch authMiddleware garantiert vorhanden (JWT-Payload)
 *     bei allen schreibenden Endpunkten.
 *   - Zwei getrennte Status-Dimensionen:
 *       1. Operativer Status (online/offline/stoerung) – via towerService.updateStatus
 *       2. Lifecycle-Status (geplant/aktiv/stillgelegt/…) – via lifecycleService
 *     Der Lifecycle-Status wird NUR manuell geaendert, NIE durch einen Scheduler.
 *   - Query-Parameter (page, limit etc.) kommen als Strings und werden vom
 *     Service bzw. der Validierungs-Middleware in die korrekten Typen konvertiert.
 *
 * Aenderungshinweise:
 *   - Neue Tower-Endpunkte als weitere Methoden ergaenzen.
 *   - Geschaeftslogik und Validierung gehoeren in towerService/lifecycleService.
 *   - Export-Formate werden im Service behandelt; hier nur Header setzen.
 */
import { Request, Response, NextFunction } from 'express';
import { towerService } from '../services/towerService.js';
import { lifecycleService } from '../services/lifecycleService.js';

export const towerController = {
  /**
   * Gibt eine paginierte, optional gefilterte Liste aller Tower zurueck.
   * Unterstuetzte Filter: status, search (Freitext), city, mode.
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, search, city, mode } = req.query as unknown as { page: number; limit: number; status?: string; search?: string; city?: string; mode?: string };
      res.json(await towerService.getAll(page, limit, { status, search, city, mode }));
    } catch (e) { next(e); }
  },

  /** Gibt einen einzelnen Tower anhand seiner ID zurueck. */
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await towerService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  /**
   * Erstellt einen neuen Tower.
   * Mappt camelCase-Felder aus dem Request-Body auf snake_case fuer die DB-Schicht.
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { serialNumber, name, description, address, latitude, longitude, config } = req.body;
      // Adressfelder werden einzeln aus dem verschachtelten address-Objekt extrahiert
      res.status(201).json(await towerService.create({
        serial_number: serialNumber, name, description,
        address_street: address?.street, address_city: address?.city, address_zip: address?.zip, address_country: address?.country,
        latitude, longitude, config,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

  /**
   * Aktualisiert Tower-Stammdaten (Name, Adresse, Konfiguration etc.).
   * Aendert NICHT den operativen Status oder den Lifecycle-Status.
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { serialNumber, name, description, address, latitude, longitude, config } = req.body;
      res.json(await towerService.update(req.params.id as string, {
        serial_number: serialNumber, name, description,
        address_street: address?.street, address_city: address?.city, address_zip: address?.zip, address_country: address?.country,
        latitude, longitude, config,
      }));
    } catch (e) { next(e); }
  },

  /**
   * Aendert den operativen Status eines Towers (z.B. online → offline).
   * Optional kann ein Grund angegeben werden, der in der Historie gespeichert wird.
   */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      res.json(await towerService.updateStatus(req.params.id as string, status, reason || '', req.user!.userId));
    } catch (e) { next(e); }
  },

  /** Gibt die paginierte operative Status-Historie eines Towers zurueck. */
  async getStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, source, date_from, date_to } = req.query as unknown as {
        page: number; limit: number; status?: string; source?: string; date_from?: string; date_to?: string;
      };
      res.json(await towerService.getStatusHistory(req.params.id as string, page, limit, { status, source, date_from, date_to }));
    } catch (e) { next(e); }
  },

  /**
   * Exportiert die operative Status-Historie als CSV oder JSON.
   * Setzt Content-Type und Content-Disposition fuer den Datei-Download.
   */
  async exportStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { format, status, source, date_from, date_to } = req.query as unknown as {
        format: 'csv' | 'json'; status?: string; source?: string; date_from?: string; date_to?: string;
      };
      const result = await towerService.exportStatusHistory(req.params.id as string, format || 'csv', { status, source, date_from, date_to });
      // Download-Header setzen – Dateiname und MIME-Type kommen vom Service
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.body);
    } catch (e) { next(e); }
  },

  /** Loescht einen Tower. Gibt 204 No Content bei Erfolg zurueck. */
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await towerService.remove(req.params.id as string); res.status(204).end(); } catch (e) { next(e); }
  },

  /** Gibt aggregierte Tower-Statistiken zurueck (z.B. Anzahl nach Status). */
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await towerService.getStats()); } catch (e) { next(e); }
  },

  // ── Lifecycle-Status (getrennt vom operativen Status) ──────────────

  /**
   * Aendert den Lifecycle-Status eines Towers (z.B. geplant → aktiv).
   * Wird NUR manuell durch einen Benutzer ausgeloest, nie automatisch.
   * Delegiert an lifecycleService, der auch die erlaubten Uebergaenge prueft.
   */
  async updateLifecycleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      res.json(await lifecycleService.updateLifecycleStatus(req.params.id as string, status, reason || '', req.user!.userId));
    } catch (e) { next(e); }
  },

  /** Gibt die paginierte Lifecycle-Historie eines Towers zurueck. */
  async getLifecycleHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, source, date_from, date_to } = req.query as unknown as {
        page: number; limit: number; source?: string; date_from?: string; date_to?: string;
      };
      res.json(await lifecycleService.getLifecycleHistory(req.params.id as string, page, limit, { source, date_from, date_to }));
    } catch (e) { next(e); }
  },

  /**
   * Exportiert die Lifecycle-Historie als CSV oder JSON.
   * Analog zu exportStatusHistory, aber fuer den Lifecycle-Verlauf.
   */
  async exportLifecycleHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { format, source, date_from, date_to } = req.query as unknown as {
        format: 'csv' | 'json'; source?: string; date_from?: string; date_to?: string;
      };
      const result = await lifecycleService.exportLifecycleHistory(req.params.id as string, format || 'csv', { source, date_from, date_to });
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.body);
    } catch (e) { next(e); }
  },

  /**
   * Gibt den aktuellen Lifecycle-Status und die davon erlaubten
   * Uebergaenge (Transitions) zurueck – nuetzlich fuer die UI,
   * um nur gueltige Statuswechsel anzubieten.
   */
  async getValidLifecycleTransitions(req: Request, res: Response, next: NextFunction) {
    try {
      // Erst den Tower laden, um den aktuellen lifecycle_status zu erhalten
      const tower = await towerService.getById(req.params.id as string);
      res.json({ current: tower.lifecycle_status, transitions: lifecycleService.getValidTransitions(tower.lifecycle_status) });
    } catch (e) { next(e); }
  },
};
