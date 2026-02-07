import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { paginationQuery, createUserBody, updateUserBody, idParams } from '../schemas.js';

const router = Router();
router.use(authMiddleware, isAdmin);

router.get('/', validate({ query: paginationQuery }), userController.getAll);
router.get('/:id', validate({ params: idParams }), userController.getById);
router.post('/', validate({ body: createUserBody }), userController.create);
router.put('/:id', validate({ params: idParams, body: updateUserBody }), userController.update);
router.delete('/:id', validate({ params: idParams }), userController.deactivate);

export default router;
