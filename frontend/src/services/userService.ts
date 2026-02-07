import { api } from './api';
import type { User, RoleName, PaginatedResponse } from '../types';

export const userService = {
  getAll: (p: { page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<User>>(`/users?${q}`);
  },
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (d: { email: string; password: string; firstName: string; lastName: string; roles: RoleName[] }) =>
    api.post<User>('/users', d),
  update: (id: string, d: { email?: string; firstName?: string; lastName?: string; isActive?: boolean; roles?: RoleName[] }) =>
    api.put<User>(`/users/${id}`, d),
  delete: (id: string) => api.delete(`/users/${id}`),
};
