import { api } from './api';
import type { ServiceTicket, TicketStats, TicketStatus, TicketType, TicketPriority, PaginatedResponse } from '../types';

export const ticketService = {
  getAll: (p: { page?: number; limit?: number; status?: TicketStatus; type?: TicketType; priority?: TicketPriority; towerId?: string; assignedTo?: string } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<ServiceTicket>>(`/tickets?${q}`);
  },
  getById: (id: string) => api.get<ServiceTicket>(`/tickets/${id}`),
  create: (d: { towerId: string; title: string; description?: string; ticketType?: TicketType; priority?: TicketPriority; assignedTo?: string; dueDate?: string }) =>
    api.post<ServiceTicket>('/tickets', d),
  update: (id: string, d: Record<string, unknown>) => api.put<ServiceTicket>(`/tickets/${id}`, d),
  assign: (id: string, assignedTo: string) => api.patch<ServiceTicket>(`/tickets/${id}/assign`, { assignedTo }),
  getStats: () => api.get<TicketStats>('/tickets/stats'),
};
