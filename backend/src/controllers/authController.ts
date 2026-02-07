import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { createAuditLog } from '../middleware/audit.js';
import { recordFailedLogin, resetLoginAttempts } from '../middleware/loginRateLimit.js';
import { AppError } from '../middleware/errorHandler.js';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      resetLoginAttempts(req);
      await createAuditLog(result.user.id, email, 'login', 'user', result.user.id, null, null, req.ip || null);
      res.json(result);
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 401) {
        recordFailedLogin(req);
        console.warn(`[AUTH] Failed login attempt for ${req.body.email} from ${req.ip}`);
        await createAuditLog(null, req.body.email, 'login_failed', 'user', null, null, null, req.ip || null);
      }
      next(e);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) await createAuditLog(req.user.userId, req.user.email, 'logout', 'user', req.user.userId, null, null, req.ip || null);
      res.json({ message: 'Abgemeldet' });
    } catch (e) { next(e); }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.me(req.user!.userId));
    } catch (e) { next(e); }
  },
};
