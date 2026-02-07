import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { documentController } from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isServiceOrAbove, isOperatorOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { documentListQuery, uploadDocumentBody, idParams } from '../schemas.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf','image/png','image/jpeg','image/gif',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    cb(null, ok.includes(file.mimetype));
  },
});

const router = Router();
router.use(authMiddleware);

router.get('/', validate({ query: documentListQuery }), documentController.getAll);
router.get('/:id', validate({ params: idParams }), documentController.getById);
router.get('/:id/download', validate({ params: idParams }), documentController.download);
router.post('/', isServiceOrAbove, upload.single('file'), validate({ body: uploadDocumentBody }), documentController.upload);
router.post('/:id/version', isServiceOrAbove, validate({ params: idParams }), upload.single('file'), documentController.uploadVersion);
router.delete('/:id', isOperatorOrAbove, validate({ params: idParams }), documentController.remove);

export default router;
