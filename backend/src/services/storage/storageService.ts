import path from 'node:path';
import type { StorageDriver, StorageDriverName } from './types.js';
import { LocalStorageDriver } from './localStorageDriver.js';
import { S3StorageDriver } from './s3StorageDriver.js';
import { AppError } from '../../middleware/errorHandler.js';

function getDriverName(): StorageDriverName {
  const raw = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (raw === 'local' || raw === 's3') return raw;
  return 'local';
}

export function createStorageDriver(): StorageDriver {
  const driver = getDriverName();

  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new AppError('S3-Konfiguration unvollständig (S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY)', 500);
    }
    return new S3StorageDriver(bucket, {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE ? process.env.S3_FORCE_PATH_STYLE === 'true' : undefined,
    });
  }

  // local
  // Root dir: explizit via LOCAL_STORAGE_ROOT, sonst bestehendes UPLOAD_DIR, sonst /data/uploads (Architektur-Vorgabe).
  const root = process.env.LOCAL_STORAGE_ROOT || process.env.UPLOAD_DIR || '/data/uploads';
  // Wenn relativ angegeben, auf Projekt-Root (cwd) beziehen.
  const abs = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
  return new LocalStorageDriver(abs);
}

