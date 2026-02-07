import { Router } from 'express';
import auth from './auth.js';
import users from './users.js';
import towers from './towers.js';
import tickets from './tickets.js';
import documents from './documents.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
router.use('/auth', auth);
router.use('/users', users);
router.use('/towers', towers);
router.use('/tickets', tickets);
router.use('/documents', documents);

export default router;
