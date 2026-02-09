/**
 * @module userService
 *
 * @description
 * Service-Modul fuer alle Benutzerverwaltungs-Operationen.
 * Unterstuetzt vollstaendiges CRUD fuer Benutzerkonten inkl. Rollenverwaltung.
 *
 * @role_im_system
 * Wird primaer von der Admin-Oberflaeche zur Verwaltung von Benutzerkonten verwendet.
 * Benutzer koennen eine oder mehrere Rollen haben (admin, operator, service, viewer),
 * die ihre Berechtigungen im System bestimmen.
 *
 * @abhaengigkeiten
 * - api.ts: HTTP-Abstraktionsschicht (Authentifizierung, Fehlerbehandlung)
 * - types/index.ts: User, RoleName, PaginatedResponse
 *
 * @wichtige_annahmen
 * - Nur Benutzer mit Admin-Rolle haben Zugriff auf diese Endpunkte (wird serverseitig geprueft)
 * - Passwort wird nur beim Erstellen (create) mitgesendet, nicht beim Update
 * - Die Deaktivierung eines Benutzers erfolgt ueber update mit isActive=false
 * - Rollen werden als Array uebergeben und vollstaendig ersetzt (kein Merge)
 *
 * @aenderungshinweise
 * - Bei Erweiterung um Passwort-Reset muesste eine separate Methode ergaenzt werden
 * - Die Rollen-Liste (RoleName) ist in types/index.ts definiert und muss bei Aenderungen dort angepasst werden
 */

import { api } from './api';
import type { User, RoleName, PaginatedResponse } from '../types';

export const userService = {
  /** Alle Benutzer paginiert abrufen (typischerweise nur fuer Admins sichtbar) */
  getAll: (p: { page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return api.get<PaginatedResponse<User>>(`/users?${q}`);
  },

  /** Einzelnen Benutzer mit allen Details laden */
  getById: (id: string) => api.get<User>(`/users/${id}`),

  /** Neuen Benutzer anlegen. Passwort ist hier Pflichtfeld (wird nur bei Erstellung gesetzt) */
  create: (d: { email: string; password: string; firstName: string; lastName: string; roles: RoleName[] }) =>
    api.post<User>('/users', d),

  /** Benutzerdaten aktualisieren (ohne Passwort). Rollen-Array wird vollstaendig ersetzt, nicht gemerged */
  update: (id: string, d: { email?: string; firstName?: string; lastName?: string; isActive?: boolean; roles?: RoleName[] }) =>
    api.put<User>(`/users/${id}`, d),

  /** Benutzer dauerhaft loeschen. Vorsicht: Kann Fremdschluessel-Abhaengigkeiten ausloesen */
  delete: (id: string) => api.delete(`/users/${id}`),
};
