import crypto from 'node:crypto';
import path from 'node:path';
import type { StorageCategory } from './types.js';

export function sanitizeTowerId(towerId: string) {
  // Storage-Key soll nie Path-Traversal zulassen; towerId ist i.d.R. UUID, aber zur Sicherheit normalisieren.
  return towerId.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

export function sanitizeExt(ext?: string) {
  if (!ext) return '';
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  const cleaned = e.toLowerCase().replace(/[^a-z0-9.]/g, '');
  // verhindert ".." oder leere Extensions
  if (cleaned === '.' || cleaned.includes('..')) return '';
  return cleaned;
}

export function buildStorageKey(towerId: string, category: StorageCategory, ext?: string) {
  const safeTowerId = sanitizeTowerId(towerId || 'unassigned');
  const safeExt = sanitizeExt(ext || '');
  const id = crypto.randomUUID();
  const filename = safeExt ? `${id}${safeExt}` : id;
  // Key-Format: towers/{tower_id}/{images|documents}/{uuid}.{ext}
  return path.posix.join('towers', safeTowerId, category, filename);
}

export function deriveThumbnailKey(originalKey: string) {
  // Thumbnail neben dem Original ablegen, aber mit fixem Suffix + JPG (einfach, breit kompatibel).
  // Beispiel: towers/<id>/images/<uuid>.png -> towers/<id>/images/<uuid>.thumb.jpg
  const dir = path.posix.dirname(originalKey);
  const base = path.posix.basename(originalKey, path.posix.extname(originalKey));
  return path.posix.join(dir, `${base}.thumb.jpg`);
}

