import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationTarget) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) (req as any).params = schemas.params.parse(req.params);
      if (schemas.query) (req as any).query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
        res.status(400).json({ error: 'Validierungsfehler', details: messages });
        return;
      }
      next(err);
    }
  };
}
