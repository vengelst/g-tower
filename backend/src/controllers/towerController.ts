import { Request, Response, NextFunction } from 'express';
import { towerService } from '../services/towerService.js';

export const towerController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, search, city, mode } = req.query as unknown as { page: number; limit: number; status?: string; search?: string; city?: string; mode?: string };
      res.json(await towerService.getAll(page, limit, { status, search, city, mode }));
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await towerService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { serialNumber, name, description, address, latitude, longitude, config } = req.body;
      res.status(201).json(await towerService.create({
        serial_number: serialNumber, name, description,
        address_street: address?.street, address_city: address?.city, address_zip: address?.zip, address_country: address?.country,
        latitude, longitude, config,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

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

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      res.json(await towerService.updateStatus(req.params.id as string, status, reason || '', req.user!.userId));
    } catch (e) { next(e); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try { await towerService.remove(req.params.id as string); res.status(204).end(); } catch (e) { next(e); }
  },

  async getStats(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await towerService.getStats()); } catch (e) { next(e); }
  },
};
