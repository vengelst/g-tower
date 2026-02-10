/**
 * @module routes/documents
 *
 * @description Dokument-Router (Mount-Punkt: /api/documents)
 *
 * Zweck:
 *   Upload, Download, Versionierung und Loeschung von Dokumenten,
 *   die Tuermen oder Tickets zugeordnet werden koennen
 *   (z. B. Wartungsprotokolle, Lagepläne, Fotos).
 *
 * Rolle im Gesamtsystem:
 *   Stellt die Datei-Verwaltung bereit. Multer parst multipart/form-data
 *   und stellt die Datei im Request bereit; die persistente Speicherung
 *   erfolgt im documentService ueber den konfigurierten Storage-Driver
 *   (local FS oder S3).
 *
 * Abhängigkeiten:
 *   - multer                – Multipart-/File-Upload-Middleware
 *   - crypto                – UUID-Generierung fuer eindeutige Dateinamen
 *   - path                  – Extraktion der Dateiendung
 *   - documentController    – Geschäftslogik fuer Dokumente
 *   - authMiddleware         – Token-Prüfung (global auf Router-Ebene)
 *   - isServiceOrAbove       – RBAC: Rolle >= service (2) fuer Upload
 *   - isOperatorOrAbove      – RBAC: Rolle >= operator (3) fuer Loeschung
 *   - validate               – Zod-basierte Request-Validierung
 *   - Schemas: documentListQuery, uploadDocumentBody, idParams
 *
 * Wichtige Annahmen:
 *   - Maximale Dateigroesse: 50 MB (50 * 1024 * 1024 Bytes).
 *   - Erlaubte MIME-Types: PDF, PNG, JPEG, GIF, Word (.doc/.docx),
 *     Excel (.xls/.xlsx). Dateien mit anderen Typen werden
 *     stillschweigend abgelehnt (multer fileFilter).
 *   - Hochgeladene Dateien werden im Storage unter einem UUID-Key abgelegt,
 *     um Namenskollisionen zu vermeiden (Key-Format siehe README).
 *   - Upload (POST) erfordert Rolle >= service (2),
 *     Loeschung (DELETE) erfordert Rolle >= operator (3).
 *   - Lese-Endpunkte (GET) stehen allen authentifizierten Rollen offen.
 *
 * Änderungshinweise:
 *   - Neue MIME-Types in der ok-Liste im fileFilter ergaenzen.
 *   - Bei Aenderung der max. Dateigroesse den limits-Wert anpassen.
 *   - Soll auf Cloud-Storage (S3 o. Ä.) umgestellt werden,
 *     muss das multer-Storage-Backend ausgetauscht werden.
 */

import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isServiceOrAbove, isOperatorOrAbove } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { documentListQuery, uploadDocumentBody, idParams } from '../schemas.js';

/**
 * Multer-Instanz mit Groessen- und Typ-Beschraenkung.
 * - fileSize: max. 50 MB
 * - fileFilter: Nur bestimmte MIME-Types werden akzeptiert (PDF, Bilder, Office).
 *   Nicht erlaubte Typen werden ohne Fehler abgelehnt (cb(null, false)).
 */
const upload = multer({
  // Storage wird durch StorageService gesteuert (local/S3). Multer hält die Datei nur im RAM.
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/pdf','image/png','image/jpeg','image/gif',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    cb(null, ok.includes(file.mimetype));
  },
});

const router = Router();

/** Alle Endpunkte dieses Routers erfordern ein gueltiges Auth-Token. */
router.use(authMiddleware);

/* ── Lese-Endpunkte (alle authentifizierten Rollen) ────────────── */

/** Paginierte/filtrierbare Liste aller Dokumente. */
router.get('/', validate({ query: documentListQuery }), documentController.getAll);

/** Dokument-Metadaten anhand der ID abrufen. */
router.get('/:id', validate({ params: idParams }), documentController.getById);

/** Datei-Download (liefert den Binaer-Stream der Datei). */
router.get('/:id/download', validate({ params: idParams }), documentController.download);

/* ── Schreib-Endpunkte ──────────────────────────────────────────── */

/**
 * Neues Dokument hochladen (Rolle >= service).
 * Middleware-Kette: isServiceOrAbove → multer (Datei parsen) → validate(body) → controller.
 * Multer muss VOR validate laufen, damit die Body-Felder aus dem Multipart-Request
 * fuer die Validierung verfuegbar sind.
 */
router.post('/', isServiceOrAbove, upload.single('file'), validate({ body: uploadDocumentBody }), documentController.upload);

/**
 * Neue Version eines bestehenden Dokuments hochladen (Rolle >= service).
 * Die Param-ID identifiziert das Eltern-Dokument; die neue Datei wird
 * als Folgeversion verknuepft.
 */
router.post('/:id/version', isServiceOrAbove, validate({ params: idParams }), upload.single('file'), documentController.uploadVersion);

/**
 * Dokument loeschen (Rolle >= operator).
 * Hoehere Rechte-Anforderung als beim Upload, da Loeschungen
 * schwerer rueckgaengig zu machen sind.
 */
router.delete('/:id', isOperatorOrAbove, validate({ params: idParams }), documentController.remove);

export default router;
