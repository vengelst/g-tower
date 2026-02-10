import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { StorageDriver, StorageReadResult, StorageSaveOptions, StorageSaveResult } from './types.js';
import { buildStorageKey, sanitizeExt } from './util.js';
import { AppError } from '../../middleware/errorHandler.js';

export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    opts: {
      endpoint?: string;
      region?: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle?: boolean;
    },
  ) {
    this.client = new S3Client({
      region: opts.region || 'us-east-1',
      endpoint: opts.endpoint || undefined,
      forcePathStyle: opts.forcePathStyle ?? Boolean(opts.endpoint),
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async save(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, options: StorageSaveOptions): Promise<StorageSaveResult> {
    const ext = sanitizeExt(options.ext ?? '');
    const key = options.keyOverride ?? buildStorageKey(options.towerId, options.category, ext || undefined);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: options.contentType ?? file.mimetype,
    }));
    return { storagePath: key, bytesWritten: file.size, contentType: options.contentType ?? file.mimetype };
  }

  async read(storagePath: string): Promise<StorageReadResult> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }));
      // Body ist im Node-Runtime ein Readable.
      if (!res.Body) throw new AppError('Datei nicht gefunden', 404);
      return { stream: res.Body as any, contentLength: res.ContentLength, contentType: res.ContentType };
    } catch (e: any) {
      const code = e?.name || e?.Code;
      if (code === 'NoSuchKey' || code === 'NotFound') throw new AppError('Datei nicht gefunden', 404);
      throw e;
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }));
    } catch {
      // idempotent
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storagePath }));
      return true;
    } catch (e: any) {
      const code = e?.name || e?.Code;
      if (code === 'NotFound' || code === 'NoSuchKey') return false;
      return false;
    }
  }
}

