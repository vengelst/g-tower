/**
 * @module ticketService
 *
 * @description
 * Service-Modul fuer alle Service-Ticket-bezogenen API-Operationen.
 * Unterstuetzt CRUD, Zuweisung von Tickets an Benutzer sowie Statistik-Abfragen.
 *
 * @role_im_system
 * Verwaltet die Wartungs-, Stoerfalls- und Inspektions-Tickets, die mit Towers verknuepft sind.
 * Wird von Ticket-Listen, Ticket-Detailseiten und Dashboard-Widgets verwendet.
 * Jedes Ticket ist immer genau einem Tower zugeordnet (tower_id ist Pflichtfeld).
 *
 * @abhaengigkeiten
 * - api.ts: HTTP-Abstraktionsschicht (Authentifizierung, Fehlerbehandlung)
 * - types/index.ts: ServiceTicket, TicketStats, TicketStatus, TicketType, TicketPriority
 *
 * @wichtige_annahmen
 * - Tickets werden ueber ihren Status-Lebenszyklus verwaltet: open -> in_progress -> pending -> resolved -> closed
 * - Die assign-Methode aendert nur die Zuweisung, nicht den Status des Tickets
 * - Statistiken werden serverseitig aggregiert und enthalten Aufschluesselungen nach Status und Prioritaet
 *
 * @aenderungshinweise
 * - Bei Erweiterung um Kommentare oder Anhaenge muessten neue Methoden ergaenzt werden
 * - Statusuebergaenge werden serverseitig validiert
 */

import { api } from './api';
import type { ServiceTicket, TicketStats, TicketStatus, TicketType, TicketPriority, PaginatedResponse } from '../types';

export const ticketService = {
  /**
   * Alle Tickets paginiert abrufen. Unterstuetzt Filterung nach Status, Typ, Prioritaet,
   * Tower-Zuordnung und zugewiesenem Bearbeiter. Falsy-Werte werden aus den Query-Parametern entfernt.
   */
  getAll: (p: { page?: number; limit?: number; status?: TicketStatus; type?: TicketType; priority?: TicketPriority; towerId?: string; assignedTo?: string } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<ServiceTicket>>(`/tickets?${q}`);
  },

  /** Einzelnes Ticket mit allen Details laden (inkl. Tower-Name, Bearbeiter-Name etc.) */
  getById: (id: string) => api.get<ServiceTicket>(`/tickets/${id}`),

  /** Neues Ticket erstellen. towerId und title sind Pflichtfelder, Rest optional */
  create: (d: { towerId: string; title: string; description?: string; ticketType?: TicketType; priority?: TicketPriority; assignedTo?: string; dueDate?: string }) =>
    api.post<ServiceTicket>('/tickets', d),

  /** Ticket-Daten aktualisieren (vollstaendiges Update via PUT) */
  update: (id: string, d: Record<string, unknown>) => api.put<ServiceTicket>(`/tickets/${id}`, d),

  /** Ticket einem Benutzer zuweisen (PATCH – aendert nur die Zuweisung, nicht den Status) */
  assign: (id: string, assignedTo: string) => api.patch<ServiceTicket>(`/tickets/${id}/assign`, { assignedTo }),

  /** Aggregierte Ticket-Statistiken (Gesamtzahl, nach Status und nach Prioritaet aufgeschluesselt) */
  getStats: () => api.get<TicketStats>('/tickets/stats'),
};
