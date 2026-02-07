import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginBody } from '../schemas.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';

const router = Router();
router.post('/login', loginRateLimit, validate({ body: loginBody }), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);

export default router;
