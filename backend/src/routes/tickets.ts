import { Router } from 'express';
import { ticketController } from '../controllers/ticketController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isServiceOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ticketListQuery, createTicketBody, updateTicketBody, assignTicketBody, idParams } from '../schemas.js';

const router = Router();
router.use(authMiddleware);

router.get('/stats', ticketController.getStats);
router.get('/', validate({ query: ticketListQuery }), ticketController.getAll);
router.get('/:id', validate({ params: idParams }), ticketController.getById);
router.post('/', isServiceOrAbove, validate({ body: createTicketBody }), ticketController.create);
router.put('/:id', isServiceOrAbove, validate({ params: idParams, body: updateTicketBody }), ticketController.update);
router.patch('/:id/assign', isServiceOrAbove, validate({ params: idParams, body: assignTicketBody }), ticketController.assign);
router.delete('/:id', isServiceOrAbove, validate({ params: idParams }), ticketController.remove);

export default router;
