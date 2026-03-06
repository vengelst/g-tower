import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { StorageDriver, StorageReadResult, StorageSaveOptions, StorageSaveResult } from './types.js';
import { buildStorageKey, sanitizeExt } from './util.js';
import { AppError } from '../../middleware/errorHandler.js';

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  async save(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, options: StorageSaveOptions): Promise<StorageSaveResult> {
    const ext = sanitizeExt(options.ext ?? path.extname(file.originalname));
    const key = options.keyOverride ?? buildStorageKey(options.towerId, options.category, ext || undefined);
    const abs = path.resolve(this.root, key);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, file.buffer);
    return { storagePath: key, bytesWritten: file.size, contentType: options.contentType ?? file.mimetype };
  }

  async read(storagePath: string): Promise<StorageReadResult> {
    const abs = path.resolve(this.root, storagePath);
    if (!fs.existsSync(abs)) throw new AppError('Datei nicht gefunden', 404);
    const stat = await fsp.stat(abs);
    const stream = fs.createReadStream(abs);
    return { stream: stream as unknown as Readable, contentLength: stat.size };
  }

  async delete(storagePath: string): Promise<void> {
    const abs = path.resolve(this.root, storagePath);
    try { await fsp.unlink(abs); } catch { /* idempotent */ }
  }

  async exists(storagePath: string): Promise<boolean> {
    const abs = path.resolve(this.root, storagePath);
    try { await fsp.access(abs); return true; } catch { return false; }
  }
}
