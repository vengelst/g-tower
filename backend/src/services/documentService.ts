import fs from 'fs/promises';
import path from 'path';
import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const PUBLIC_COLS = `d.id, d.tower_id, d.original_filename, d.mime_type, d.file_size,
  d.title, d.description, d.document_type, d.version, d.parent_document_id,
  d.uploaded_by, d.created_at, d.updated_at`;

export const documentService = {
  async getAll(page = 1, limit = 20, filters: { towerId?: string; type?: string } = {}) {
    const offset = (page - 1) * limit;
    const conds: string[] = []; const vals: unknown[] = []; let i = 1;
    if (filters.towerId) { conds.push(`d.tower_id=$${i++}`); vals.push(filters.towerId); }
    if (filters.type) { conds.push(`d.document_type=$${i++}`); vals.push(filters.type); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = +(await query(`SELECT count(*) FROM documents d ${where}`, vals)).rows[0].count;
    const data = (await query(
      `SELECT ${PUBLIC_COLS}, t.name as tower_name FROM documents d LEFT JOIN towers t ON d.tower_id=t.id
       ${where} ORDER BY d.created_at DESC LIMIT $${i++} OFFSET $${i}`, [...vals, limit, offset]
    )).rows;
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  async getById(id: string) {
    const res = await query(`SELECT ${PUBLIC_COLS}, t.name as tower_name FROM documents d LEFT JOIN towers t ON d.tower_id=t.id WHERE d.id=$1`, [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    return res.rows[0];
  },

  async create(file: Express.Multer.File, data: { towerId?: string; title?: string; description?: string; documentType?: string }, uploadedBy: string) {
    if (data.towerId) {
      const ok = (await query('SELECT id FROM towers WHERE id=$1', [data.towerId])).rows.length;
      if (!ok) throw new AppError('Tower nicht gefunden', 404);
    }
    const row = (await query(
      `INSERT INTO documents (tower_id,filename,original_filename,mime_type,file_size,file_path,title,description,document_type,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${PUBLIC_COLS.replace(/d\./g, '')}`,
      [data.towerId || null, file.filename, file.originalname, file.mimetype, file.size, file.path, data.title || file.originalname, data.description || null, data.documentType || 'other', uploadedBy]
    )).rows[0];
    return row;
  },

  async createVersion(parentId: string, file: Express.Multer.File, uploadedBy: string) {
    const parent = await this.getById(parentId);
    const row = (await query(
      `INSERT INTO documents (tower_id,filename,original_filename,mime_type,file_size,file_path,title,description,document_type,version,parent_document_id,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${PUBLIC_COLS.replace(/d\./g, '')}`,
      [parent.tower_id, file.filename, file.originalname, file.mimetype, file.size, file.path, parent.title, parent.description, parent.document_type, parent.version + 1, parentId, uploadedBy]
    )).rows[0];
    return row;
  },

  async delete(id: string) {
    const res = await query('SELECT filename FROM documents WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    try { await fs.unlink(path.join(UPLOAD_DIR, res.rows[0].filename)); } catch { /* file may not exist */ }
    await query('DELETE FROM documents WHERE id=$1', [id]);
  },

  async getFilePath(id: string) {
    const res = await query('SELECT filename, original_filename, mime_type FROM documents WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    const doc = res.rows[0];
    const fp = path.resolve(UPLOAD_DIR, doc.filename);
    try { await fs.access(fp); } catch { throw new AppError('Datei nicht gefunden', 404); }
    return { path: fp, filename: doc.original_filename, mimeType: doc.mime_type };
  },
};
