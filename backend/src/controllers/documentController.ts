/**
 * @module documentController
 *
 * @description
 * Controller fuer die Dokumentenverwaltung – Upload, Download, Versionierung
 * und Loeschung von Dateien, die einem Tower zugeordnet sind.
 *
 * Rolle im Gesamtsystem:
 *   Nimmt HTTP-Anfragen von den Dokument-Routen entgegen und delegiert
 *   an den documentService. Datei-Uploads werden ueber Multer-Middleware
 *   verarbeitet (req.file), bevor dieser Controller aufgerufen wird.
 *   Architektur: Route (+ Multer) → Controller → Service.
 *
 * Abhängigkeiten:
 *   - documentService – Gesamte Dokumenten-Geschaeftslogik (Speicherung, Metadaten, Versionen)
 *   - Multer-Middleware – Stellt req.file bereit (wird in der Route konfiguriert)
 *
 * Wichtige Annahmen:
 *   - req.user! ist durch authMiddleware garantiert vorhanden (JWT-Payload)
 *     bei Upload- und Versionierungs-Endpunkten.
 *   - req.file wird durch Multer befuellt; fehlt es, wird 400 zurueckgegeben.
 *   - Fehlermeldungen auf Deutsch ("Keine Datei").
 *
 * Aenderungshinweise:
 *   - Neue Dokumenten-Endpunkte (z.B. Vorschau) als weitere Methoden ergaenzen.
 *   - Datei-Validierung (Groesse, Typ) sollte in der Multer-Konfiguration
 *     oder im documentService erfolgen, nicht hier im Controller.
 */
import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/documentService.js';

export const documentController = {
  /**
   * Gibt eine paginierte, optional gefilterte Liste aller Dokumente zurueck.
   * Unterstuetzte Filter: towerId, type (Dokumenttyp).
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, towerId, type } = req.query as unknown as { page: number; limit: number; towerId?: string; type?: string };
      res.json(await documentService.getAll(page, limit, { towerId, type }));
    } catch (e) { next(e); }
  },

  /** Gibt Metadaten eines einzelnen Dokuments anhand seiner ID zurueck. */
  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await documentService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  /**
   * Sendet die eigentliche Datei als Download an den Client.
   * Setzt Content-Disposition mit zwei Varianten des Dateinamens:
   *   1. ASCII-sicherer Fallback (Sonderzeichen durch '_' ersetzt)
   *   2. UTF-8-kodierter Originalname (filename*=UTF-8'')
   * So werden Umlaute und Sonderzeichen browseruebergreifend korrekt behandelt.
   */
  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const info = await documentService.getDownload(req.params.id as string);
      // ASCII-sicherer Dateiname als Fallback fuer aeltere Clients
      const safe = info.filename.replace(/[^\w.\-() ]/g, '_');
      // UTF-8-kodierter Originalname fuer moderne Browser
      const encoded = encodeURIComponent(info.filename);
      res.setHeader('Content-Type', info.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`);
      info.stream.on('error', (e) => next(e));
      info.stream.pipe(res);
    } catch (e) { next(e); }
  },

  /**
   * Laedt ein neues Dokument hoch und verknuepft es mit einem Tower.
   * Gibt 400 zurueck, falls keine Datei im Request enthalten ist.
   */
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
      res.status(201).json(await documentService.create(req.file, {
        towerId: req.body.towerId, title: req.body.title, description: req.body.description, documentType: req.body.documentType,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

  /**
   * Laedt eine neue Version eines bestehenden Dokuments hoch.
   * Die Versionierung wird im documentService verwaltet.
   */
  async uploadVersion(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
      res.status(201).json(await documentService.createVersion(req.params.id as string, req.file, req.user!.userId));
    } catch (e) { next(e); }
  },

  /** Loescht ein Dokument. Gibt 204 No Content bei Erfolg zurueck. */
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await documentService.delete(req.params.id as string); res.status(204).send(); } catch (e) { next(e); }
  },
};
