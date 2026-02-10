/**
 * @module documentService
 *
 * @description
 * Service-Modul fuer alle Dokument-bezogenen API-Operationen.
 * Unterstuetzt Auflisten, Hochladen, Herunterladen und Loeschen von Dokumenten.
 *
 * @role_im_system
 * Verwaltet die Dokumente (Handbuecher, Zertifikate, Berichte, Bilder etc.),
 * die optional einem Tower zugeordnet sein koennen.
 * Wird von Dokument-Listen, Tower-Detailseiten und Upload-Dialogen verwendet.
 *
 * @abhaengigkeiten
 * - api.ts: HTTP-Abstraktionsschicht (Authentifizierung, Fehlerbehandlung, Blob-Download)
 * - types/index.ts: Document, DocumentType, PaginatedResponse
 *
 * @wichtige_annahmen
 * - Der Upload erfolgt als multipart/form-data (FormData), wobei die api.ts automatisch
 *   keinen Content-Type-Header setzt, damit der Browser die Boundary korrekt erzeugt
 * - tower_id ist optional – Dokumente koennen auch ohne Tower-Zuordnung existieren
 * - Der Download nutzt die downloadBlob-Methode aus api.ts, die den Dateinamen aus dem
 *   Content-Disposition-Header extrahiert
 *
 * @aenderungshinweise
 * - Bei Erweiterung um Versionierung muesste eine update-Methode ergaenzt werden
 * - Dokumenttypen werden durch den DocumentType-Union-Typ eingeschraenkt
 */

import { api } from './api';
import type { Document, DocumentType, PaginatedResponse } from '../types';

export const documentService = {
  /** Alle Dokumente paginiert abrufen, optional gefiltert nach Tower-Zuordnung und Dokumenttyp */
  getAll: (p: { page?: number; limit?: number; towerId?: string; type?: DocumentType } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<Document>>(`/documents?${q}`);
  },

  /** Einzelnes Dokument mit Metadaten laden (ohne Dateiinhalt) */
  getById: (id: string) => api.get<Document>(`/documents/${id}`),

  /**
   * Dokument hochladen. Die Datei wird zusammen mit optionalen Metadaten
   * als FormData an den Server gesendet. Optionale Felder werden nur angehaengt,
   * wenn sie einen Wert haben (truthy-Pruefung).
   */
  upload: (file: File, d: { towerId?: string; title?: string; description?: string; documentType?: DocumentType }) => {
    const fd = new FormData(); fd.append('file', file);
    if (d.towerId) fd.append('towerId', d.towerId); if (d.title) fd.append('title', d.title);
    if (d.description) fd.append('description', d.description); if (d.documentType) fd.append('documentType', d.documentType);
    return api.post<Document>('/documents', fd);
  },

  /** Dokument als Datei herunterladen (loest Browser-Download ueber downloadBlob aus) */
  download: (id: string) => api.downloadBlob(`/documents/${id}/download`),

  /** Dokument dauerhaft loeschen (inkl. gespeicherter Datei auf dem Server) */
  delete: (id: string) => api.delete(`/documents/${id}`),
};
