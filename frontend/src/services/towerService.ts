/**
 * @module towerService
 *
 * @description
 * Service-Modul fuer alle Tower-bezogenen API-Operationen.
 * Deckt CRUD-Operationen, Status-/Lifecycle-Verwaltung sowie Statistik-Abfragen ab.
 *
 * @role_im_system
 * Zentraler Zugriffspunkt fuer die Tower-Domaene im Frontend.
 * Wird von Tower-Detailseiten, Listen-Views, Dashboards und Status-Dialogen verwendet.
 * Unterscheidet zwischen zwei unabhaengigen Dimensionen:
 *   - TowerStatus (6 Werte): Operativer Zustand (active, offline, maintenance, etc.)
 *   - TowerLifecycleStatus (9 Werte): Wirtschaftlicher Lifecycle (production, rented, scrapped, etc.)
 *
 * @abhaengigkeiten
 * - api.ts: HTTP-Abstraktionsschicht (Authentifizierung, Fehlerbehandlung)
 * - types/index.ts: Tower, TowerWithHistory, TowerStatusHistory, TowerLifecycleHistory, etc.
 *
 * @wichtige_annahmen
 * - Die Lifecycle-Transitions werden serverseitig validiert; getValidLifecycleTransitions
 *   liefert nur die tatsaechlich erlaubten Uebergaenge fuer den aktuellen Status
 * - 'scrapped' ist ein Endzustand im Lifecycle – danach sind keine weiteren Uebergaenge moeglich
 * - Status und Lifecycle sind voneinander UNABHAENGIG und koennen separat geaendert werden
 *
 * @aenderungshinweise
 * - Neue Endpunkte koennen einfach als weitere Methoden im towerService-Objekt ergaenzt werden
 * - Bei Aenderung der Lifecycle-Zustaende muessen auch die Typen in types/index.ts angepasst werden
 * - Die Paginierungs-Parameter (page, limit) werden von allen Listen-Endpunkten unterstuetzt
 */

import { api } from './api';
import type { Tower, TowerWithHistory, TowerStatusHistory, TowerLifecycleHistory, TowerLifecycleStatus, TowerStats, TowerStatus, HistorySource, PaginatedResponse } from '../types';

/** Parameter fuer die Abfrage der Status-Historie mit optionaler Filterung und Paginierung */
export interface StatusHistoryParams {
  page?: number; limit?: number;
  status?: TowerStatus; source?: HistorySource;
  date_from?: string; date_to?: string;
}

export const towerService = {
  /**
   * Alle Towers paginiert abrufen. Unterstuetzt Filterung nach Status, Stadt, Modus
   * sowie Freitextsuche. Leere/undefined-Werte werden automatisch aus den Query-Parametern entfernt.
   */
  getAll: (p: { page?: number; limit?: number; status?: TowerStatus; search?: string; city?: string; mode?: string } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<Tower>>(`/towers?${q}`);
  },

  /** Einzelnen Tower mit vollstaendiger Historie (Status + Lifecycle), Tickets und Dokumenten laden */
  getById: (id: string) => api.get<TowerWithHistory>(`/towers/${id}`),

  /** Paginierte Status-Aenderungshistorie eines Towers, filterbar nach Status, Quelle und Zeitraum */
  getStatusHistory: (id: string, p: StatusHistoryParams = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<TowerStatusHistory>>(`/towers/${id}/status-history?${q}`);
  },

  /** Neuen Tower anlegen. Seriennummer und Name sind Pflichtfelder, Adresse und Koordinaten optional */
  create: (d: { serialNumber: string; name: string; description?: string; address?: { street?: string; city?: string; zip?: string; country?: string }; latitude?: number; longitude?: number }) =>
    api.post<Tower>('/towers', d),

  /** Tower-Stammdaten aktualisieren (vollstaendiges Update via PUT) */
  update: (id: string, d: Record<string, unknown>) => api.put<Tower>(`/towers/${id}`, d),

  /** Operativen Status aendern (z.B. active -> maintenance). Grund ist Pflichtfeld fuer die Historie */
  updateStatus: (id: string, status: TowerStatus, reason: string) => api.patch<Tower>(`/towers/${id}/status`, { status, reason }),

  /** Aggregierte Statistiken aller Towers (Gesamtzahl, Aufschluesselung nach Status) */
  getStats: () => api.get<TowerStats>('/towers/stats'),

  /**
   * Lifecycle-Status aendern (z.B. rented -> return_delivery).
   * PATCH /towers/:id/lifecycle – der Server validiert, ob der Uebergang erlaubt ist.
   * Grund ist Pflichtfeld und wird in der Lifecycle-Historie gespeichert.
   */
  updateLifecycleStatus: (id: string, status: TowerLifecycleStatus, reason: string) =>
    api.patch<Tower>(`/towers/${id}/lifecycle`, { status, reason }),

  /** Paginierte Lifecycle-Aenderungshistorie eines Towers, filterbar nach Quelle und Zeitraum */
  getLifecycleHistory: (id: string, p: { page?: number; limit?: number; source?: HistorySource; date_from?: string; date_to?: string } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<TowerLifecycleHistory>>(`/towers/${id}/lifecycle-history?${q}`);
  },

  /**
   * Gueltige Lifecycle-Uebergaenge fuer einen Tower abfragen.
   * GET /towers/:id/lifecycle-transitions
   * Gibt den aktuellen Status und ein Array der erlaubten Ziel-Zustaende zurueck.
   * Wird verwendet, um im UI nur die tatsaechlich moeglichen Optionen anzuzeigen.
   * Bei 'scrapped' ist das transitions-Array leer (Endzustand).
   */
  getValidLifecycleTransitions: (id: string) => api.get<{ current: TowerLifecycleStatus; transitions: TowerLifecycleStatus[] }>(`/towers/${id}/lifecycle-transitions`),
};
