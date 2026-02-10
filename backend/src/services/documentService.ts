/**
 * @module documentService
 *
 * Zweck:
 *   Verwaltung von Dokumenten (Dateien), die an Tower angehaengt werden koennen.
 *   Unterstuetzt Upload, Versionierung, Download und Loeschung.
 *
 * Rolle im Gesamtsystem:
 *   Wird vom DocumentController aufgerufen (Route → Controller → Service).
 *   Dokumente werden physisch im Dateisystem (UPLOAD_DIR) gespeichert,
 *   Metadaten in der Datenbank (documents-Tabelle).
 *
 * Abhängigkeiten:
 *   - fs/promises: Dateisystem-Operationen (Loeschen, Zugriffspruefung)
 *   - path: Pfad-Aufloesung
 *   - database.query: SQL-Abfragen
 *   - AppError: Einheitliche Fehlerklasse fuer HTTP-Fehlercodes
 *   - Express.Multer.File: Typ fuer hochgeladene Dateien (via Multer-Middleware)
 *
 * Wichtige Annahmen:
 *   - UPLOAD_DIR ist per Umgebungsvariable konfigurierbar (Default: ./uploads).
 *   - Multer uebernimmt die physische Speicherung der Datei – der Service
 *     speichert nur die Metadaten in der DB.
 *   - PUBLIC_COLS schliesst bewusst sensible Felder (filename, file_path) aus,
 *     damit interne Dateipfade nicht an den Client gelangen.
 *   - Versionierung: createVersion() erzeugt ein neues Dokument mit erhoehteter
 *     Versionsnummer und Referenz auf das Eltern-Dokument (parent_document_id).
 *   - Beim Loeschen wird sowohl die physische Datei als auch der DB-Eintrag entfernt.
 *     Fehlt die Datei bereits auf dem Dateisystem, wird der Fehler ignoriert.
 *
 * Änderungshinweise:
 *   - Bei neuen Dokument-Feldern: PUBLIC_COLS, create() und ggf. createVersion() anpassen.
 *   - UPLOAD_DIR muss vom Betriebssystem beschreibbar sein und sollte
 *     ausserhalb des Projekt-Roots liegen (Sicherheit).
 */
import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { createStorageDriver } from './storage/storageService.js';
import { deriveThumbnailKey } from './storage/util.js';
import Jimp from 'jimp';

/** Upload-Verzeichnis – konfigurierbar ueber Umgebungsvariable UPLOAD_DIR */
const storage = createStorageDriver();

/**
 * Oeffentliche Spalten fuer Dokument-Abfragen.
 * Schliesst filename und file_path bewusst aus, damit interne Pfade
 * nicht in API-Responses auftauchen.
 */
const PUBLIC_COLS = `d.id, d.tower_id, d.original_filename, d.mime_type, d.file_size,
  d.title, d.description, d.document_type, d.version, d.parent_document_id,
  d.uploaded_by, d.created_at, d.updated_at`;

function isImageMime(mime: string) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

export const documentService = {
  /**
   * Listet alle Dokumente mit Pagination und optionalen Filtern
   * (Tower-Zuordnung, Dokumenttyp).
   */
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

  /** Laedt ein einzelnes Dokument anhand seiner ID (mit Tower-Name). */
  async getById(id: string) {
    const res = await query(`SELECT ${PUBLIC_COLS}, t.name as tower_name FROM documents d LEFT JOIN towers t ON d.tower_id=t.id WHERE d.id=$1`, [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    return res.rows[0];
  },

  /**
   * Speichert ein hochgeladenes Dokument im Storage (local/S3) und
   * persistiert nur die Metadaten in der DB (keine BLOBs).
   */
  async create(file: Express.Multer.File, data: { towerId?: string; title?: string; description?: string; documentType?: string }, uploadedBy: string) {
    /* Falls eine Tower-Zuordnung angegeben ist, deren Existenz pruefen */
    if (data.towerId) {
      const ok = (await query('SELECT id FROM towers WHERE id=$1', [data.towerId])).rows.length;
      if (!ok) throw new AppError('Tower nicht gefunden', 404);
    }

    if (!file.buffer) throw new AppError('Keine Datei', 400);

    const towerIdForPath = data.towerId || 'unassigned';
    const category = isImageMime(file.mimetype) ? 'images' : 'documents';

    const saved = await storage.save(
      { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size },
      { towerId: towerIdForPath, category, contentType: file.mimetype, filenameHint: file.originalname },
    );

    // Thumbnails: Best-Effort, nur für Images, 300px Breite, als JPG.
    if (category === 'images') {
      try {
        const img = await Jimp.read(file.buffer);
        img.resize(300, Jimp.AUTO);
        const thumbBuf = await img.quality(75).getBufferAsync(Jimp.MIME_JPEG);
        await storage.save(
          { buffer: thumbBuf, originalname: 'thumb.jpg', mimetype: 'image/jpeg', size: thumbBuf.length },
          { towerId: towerIdForPath, category, contentType: 'image/jpeg', keyOverride: deriveThumbnailKey(saved.storagePath), filenameHint: 'thumb.jpg' },
        );
      } catch {
        // Upload soll nicht fehlschlagen, falls Thumbnail nicht erzeugt werden kann.
      }
    }

    /* Tabellen-Alias "d." aus PUBLIC_COLS entfernen, da INSERT kein Alias verwendet */
    const row = (await query(
      `INSERT INTO documents (tower_id,filename,original_filename,mime_type,file_size,file_path,title,description,document_type,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${PUBLIC_COLS.replace(/d\./g, '')}`,
      [
        data.towerId || null,
        saved.storagePath.split('/').pop() || 'file',
        file.originalname,
        file.mimetype,
        file.size,
        saved.storagePath,
        data.title || file.originalname,
        data.description || null,
        data.documentType || 'other',
        uploadedBy,
      ]
    )).rows[0];
    return row;
  },

  /**
   * Erstellt eine neue Version eines bestehenden Dokuments.
   * Uebernimmt Metadaten (Titel, Beschreibung, Typ, Tower) vom Eltern-Dokument,
   * erhoeht die Versionsnummer um 1 und setzt die parent_document_id.
   */
  async createVersion(parentId: string, file: Express.Multer.File, uploadedBy: string) {
    const parent = await this.getById(parentId);
    if (!file.buffer) throw new AppError('Keine Datei', 400);

    const towerIdForPath = parent.tower_id || 'unassigned';
    const category = isImageMime(file.mimetype) ? 'images' : 'documents';

    const saved = await storage.save(
      { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size },
      { towerId: towerIdForPath, category, contentType: file.mimetype, filenameHint: file.originalname },
    );

    if (category === 'images') {
      try {
        const img = await Jimp.read(file.buffer);
        img.resize(300, Jimp.AUTO);
        const thumbBuf = await img.quality(75).getBufferAsync(Jimp.MIME_JPEG);
        await storage.save(
          { buffer: thumbBuf, originalname: 'thumb.jpg', mimetype: 'image/jpeg', size: thumbBuf.length },
          { towerId: towerIdForPath, category, contentType: 'image/jpeg', keyOverride: deriveThumbnailKey(saved.storagePath), filenameHint: 'thumb.jpg' },
        );
      } catch {
        // best-effort
      }
    }

    const row = (await query(
      `INSERT INTO documents (tower_id,filename,original_filename,mime_type,file_size,file_path,title,description,document_type,version,parent_document_id,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${PUBLIC_COLS.replace(/d\./g, '')}`,
      [
        parent.tower_id,
        saved.storagePath.split('/').pop() || 'file',
        file.originalname,
        file.mimetype,
        file.size,
        saved.storagePath,
        parent.title,
        parent.description,
        parent.document_type,
        parent.version + 1,
        parentId,
        uploadedBy,
      ]
    )).rows[0];
    return row;
  },

  /**
   * Loescht ein Dokument: Zuerst die physische Datei, dann den DB-Eintrag.
   * Falls die Datei bereits fehlt, wird der Fehler stillschweigend ignoriert.
   */
  async delete(id: string) {
    const res = await query('SELECT file_path, mime_type FROM documents WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    const { file_path, mime_type } = res.rows[0] as { file_path: string; mime_type: string };
    await storage.delete(file_path);
    if (mime_type && isImageMime(mime_type)) await storage.delete(deriveThumbnailKey(file_path));
    await query('DELETE FROM documents WHERE id=$1', [id]);
  },

  /**
   * Gibt den physischen Dateipfad, Original-Dateinamen und MIME-Typ zurueck.
   * Wird vom Controller fuer den Datei-Download verwendet.
   * Prueft zusaetzlich, ob die Datei tatsaechlich auf dem Dateisystem existiert.
   */
  async getDownload(id: string) {
    const res = await query('SELECT file_path, original_filename, mime_type FROM documents WHERE id=$1', [id]);
    if (!res.rows.length) throw new AppError('Dokument nicht gefunden', 404);
    const doc = res.rows[0];
    const streamRes = await storage.read(doc.file_path as string);
    /* Existenzpruefung auf dem Dateisystem – wirft bei fehlender Datei einen 404 */
    // Existenzprüfung erfolgt im jeweiligen Storage-Driver (local: fs.access, s3: GetObject).
    return { stream: streamRes.stream, filename: doc.original_filename as string, mimeType: doc.mime_type as string };
  },
};
