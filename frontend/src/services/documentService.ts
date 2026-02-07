import { api } from './api';
import type { Document, DocumentType, PaginatedResponse } from '../types';

export const documentService = {
  getAll: (p: { page?: number; limit?: number; towerId?: string; type?: DocumentType } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<Document>>(`/documents?${q}`);
  },
  getById: (id: string) => api.get<Document>(`/documents/${id}`),
  upload: (file: File, d: { towerId?: string; title?: string; description?: string; documentType?: DocumentType }) => {
    const fd = new FormData(); fd.append('file', file);
    if (d.towerId) fd.append('towerId', d.towerId); if (d.title) fd.append('title', d.title);
    if (d.description) fd.append('description', d.description); if (d.documentType) fd.append('documentType', d.documentType);
    return api.post<Document>('/documents', fd);
  },
  download: (id: string) => api.downloadBlob(`/documents/${id}/download`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};
