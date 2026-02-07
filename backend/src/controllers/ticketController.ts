import { Request, Response, NextFunction } from 'express';
import { ticketService } from '../services/ticketService.js';

export const ticketController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, towerId, status, type, priority, assignedTo } = req.query as unknown as {
        page: number; limit: number; towerId?: string; status?: string;
        type?: string; priority?: string; assignedTo?: string;
      };
      res.json(await ticketService.getAll(page, limit, { towerId, status, type, priority, assignedTo }));
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json(await ticketService.getById(req.params.id as string)); } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { towerId, title, description, ticketType, priority, assignedTo, dueDate } = req.body;
      res.status(201).json(await ticketService.create({
        tower_id: towerId, title, description, ticket_type: ticketType, priority, assigned_to: assignedTo, due_date: dueDate,
      }, req.user!.userId));
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, description, ticketType, priority, status, resolution, dueDate } = req.body;
      res.json(await ticketService.update(req.params.id as string, {
        title, description, ticket_type: ticketType, priority, status, resolution, due_date: dueDate,
      }));
    } catch (e) { next(e); }
  },

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await ticketService.assign(req.params.id as string, req.body.assignedTo));
    } catch (e) { next(e); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try { await ticketService.remove(req.params.id as string); res.status(204).end(); } catch (e) { next(e); }
  },

  async getStats(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await ticketService.getStats()); } catch (e) { next(e); }
  },
};
