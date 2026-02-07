import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/documentService.js';

export const documentController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, towerId, type } = req.query as unknown as { page: number; limit: number; towerId?: string; type?: string };
      res.json(await documentService.getAll(page, limit, { towerId, type }));
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await documentService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const info = await documentService.getFilePath(req.params.id as string);
      const safe = info.filename.replace(/[^\w.\-() ]/g, '_');
      const encoded = encodeURIComponent(info.filename);
      res.setHeader('Content-Type', info.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`);
      res.sendFile(info.path);
    } catch (e) { next(e); }
  },

  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
      res.status(201).json(await documentService.create(req.file, {
        towerId: req.body.towerId, title: req.body.title, description: req.body.description, documentType: req.body.documentType,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

  async uploadVersion(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return; }
      res.status(201).json(await documentService.createVersion(req.params.id as string, req.file, req.user!.userId));
    } catch (e) { next(e); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try { await documentService.delete(req.params.id as string); res.status(204).send(); } catch (e) { next(e); }
  },
};
