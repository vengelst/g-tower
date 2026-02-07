import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService.js';

export const userController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      res.json(await userService.getAll(page, limit));
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await userService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName, roles } = req.body;
      res.status(201).json(await userService.create(email, password, firstName, lastName, roles, req.user!.userId));
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, firstName, lastName, isActive, roles } = req.body;
      res.json(await userService.update(req.params.id as string, { email, firstName, lastName, isActive, roles }, req.user!.userId));
    } catch (e) { next(e); }
  },

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try { await userService.deactivate(req.params.id as string); res.status(204).send(); } catch (e) { next(e); }
  },
};
