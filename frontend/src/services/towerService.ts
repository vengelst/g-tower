import { api } from './api';
import type { Tower, TowerWithHistory, TowerStats, TowerStatus, PaginatedResponse } from '../types';

export const towerService = {
  getAll: (p: { page?: number; limit?: number; status?: TowerStatus; search?: string; city?: string; mode?: string } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<Tower>>(`/towers?${q}`);
  },
  getById: (id: string) => api.get<TowerWithHistory>(`/towers/${id}`),
  create: (d: { serialNumber: string; name: string; description?: string; address?: { street?: string; city?: string; zip?: string; country?: string }; latitude?: number; longitude?: number }) =>
    api.post<Tower>('/towers', d),
  update: (id: string, d: Record<string, unknown>) => api.put<Tower>(`/towers/${id}`, d),
  updateStatus: (id: string, status: TowerStatus, reason: string) => api.patch<Tower>(`/towers/${id}/status`, { status, reason }),
  getStats: () => api.get<TowerStats>('/towers/stats'),
};
