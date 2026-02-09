import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { AppError } from '../../middleware/errorHandler.js';
import type { StorageDriver, StorageReadResult, StorageSaveOptions, StorageSaveResult } from './types.js';
import { buildStorageKey, sanitizeExt } from './util.js';

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  private abs(storagePath: string) {
    // Storage-Paths sind immer POSIX-artige Keys (mit '/'); für das lokale FS normalisieren.
    const rel = storagePath.split('/').join(path.sep);
    return path.resolve(this.rootDir, rel);
  }

  async save(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, options: StorageSaveOptions): Promise<StorageSaveResult> {
    const storagePath = options.keyOverride ?? buildStorageKey(options.towerId, options.category, sanitizeExt(options.ext ?? path.extname(options.filenameHint ?? file.originalname)));
    const absPath = this.abs(storagePath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, file.buffer);
    return { storagePath, bytesWritten: file.size, contentType: options.contentType ?? file.mimetype };
  }

  async read(storagePath: string): Promise<StorageReadResult> {
    const absPath = this.abs(storagePath);
    try {
      await fs.access(absPath);
    } catch {
      throw new AppError('Datei nicht gefunden', 404);
    }
    return { stream: createReadStream(absPath) };
  }

  async delete(storagePath: string): Promise<void> {
    const absPath = this.abs(storagePath);
    try {
      await fs.unlink(absPath);
    } catch {
      // idempotent: wenn schon weg, ignorieren
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    const absPath = this.abs(storagePath);
    try {
      await fs.access(absPath);
      return true;
    } catch {
      return false;
    }
  }
}

