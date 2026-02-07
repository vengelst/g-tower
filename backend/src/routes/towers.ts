import { Router } from 'express';
import { towerController } from '../controllers/towerController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isOperatorOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { towerListQuery, createTowerBody, updateTowerBody, updateTowerStatusBody, idParams } from '../schemas.js';

const router = Router();
router.use(authMiddleware);

router.get('/stats', towerController.getStats);
router.get('/', validate({ query: towerListQuery }), towerController.getAll);
router.get('/:id', validate({ params: idParams }), towerController.getById);
router.post('/', isOperatorOrAbove, validate({ body: createTowerBody }), towerController.create);
router.put('/:id', isOperatorOrAbove, validate({ params: idParams, body: updateTowerBody }), towerController.update);
router.patch('/:id/status', isOperatorOrAbove, validate({ params: idParams, body: updateTowerStatusBody }), towerController.updateStatus);
router.delete('/:id', isOperatorOrAbove, validate({ params: idParams }), towerController.remove);

export default router;
