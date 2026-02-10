import type { Readable } from 'node:stream';

export type StorageDriverName = 'local' | 's3';

export type StorageCategory = 'images' | 'documents';

export interface StorageSaveOptions {
  towerId: string;
  category: StorageCategory;
  ext?: string;
  contentType?: string;
  filenameHint?: string;
  keyOverride?: string;
}

export interface StorageSaveResult {
  /**
   * Driver-agnostischer Storage-Key.
   * - local: relativer Pfad unterhalb des Storage-Roots (z.B. towers/<id>/documents/<uuid>.pdf)
   * - s3: Object-Key im Bucket
   */
  storagePath: string;
  bytesWritten: number;
  contentType?: string;
}

export interface StorageReadResult {
  stream: Readable;
  contentLength?: number;
  contentType?: string;
}

export interface StorageDriver {
  save(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, options: StorageSaveOptions): Promise<StorageSaveResult>;
  read(storagePath: string): Promise<StorageReadResult>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
}

