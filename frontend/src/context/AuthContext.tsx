/**
 * @module AuthContext
 *
 * @description
 * Zentraler Authentifizierungs-Context für die gesamte Frontend-Anwendung.
 * Verwaltet den Benutzer-Zustand (User-Objekt, JWT-Token, Ladezustand)
 * und stellt Login-, Logout- sowie Rollenprüfungs-Funktionen bereit.
 *
 * @rolle_im_system
 * Wird als oberster Provider in der Komponentenhierarchie eingebunden.
 * Alle geschützten Routen und Komponenten greifen über den `useAuth()`-Hook
 * auf den aktuellen Authentifizierungsstatus zu. Steuert sowohl die
 * Sichtbarkeit von UI-Elementen (über hasRole/hasMinRole) als auch
 * die Weiterleitung nicht-authentifizierter Nutzer.
 *
 * @abhaengigkeiten
 * - `../services/api` – Axios-Instanz mit Base-URL und Interceptors
 *   (setzt automatisch den Authorization-Header aus localStorage).
 * - `../types` – Typdefinitionen für User, RoleName, AuthResponse.
 *
 * @wichtige_annahmen
 * - Das JWT-Token wird im `localStorage` unter dem Schlüssel `"token"` gespeichert.
 * - Die API-Instanz (`api`) liest das Token eigenständig aus dem localStorage
 *   und setzt es als Bearer-Token im Authorization-Header.
 * - Bei einem 401-Response (z. B. abgelaufenes Token) wird das Token entfernt
 *   und der Benutzer automatisch ausgeloggt (via Interceptor oder catch-Block).
 * - Die RBAC-Hierarchie ist numerisch abgestuft:
 *   admin(4) > operator(3) > service(2) > viewer(1).
 * - Ein User kann mehrere Rollen besitzen (`user.roles` ist ein Array).
 *
 * @aenderungshinweise
 * - Bei Änderung der Rollen-Hierarchie muss das `hierarchy`-Objekt angepasst werden.
 * - Falls Token-Refresh eingeführt wird, sollte der useEffect und/oder
 *   die api-Interceptors entsprechend erweitert werden.
 * - Der Logout-Endpoint `/auth/logout` wird fire-and-forget aufgerufen –
 *   ein Fehler dort verhindert nicht den clientseitigen Logout.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { User, RoleName, AuthResponse } from '../types';

/** Typdefinition für den AuthContext-Wert, den alle Consumer erhalten. */
interface AuthCtx {
  user: User | null; token: string | null; isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (r: RoleName) => boolean;
  hasMinRole: (r: RoleName) => boolean;
}

/**
 * Numerische Rollen-Hierarchie für RBAC-Berechtigungsprüfungen.
 * Höherer Wert = höhere Berechtigung. Wird von `hasMinRole()` verwendet,
 * um zu prüfen, ob der Nutzer mindestens die geforderte Stufe besitzt.
 */
const hierarchy: Record<RoleName, number> = { admin: 4, operator: 3, service: 2, viewer: 1 };
const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  /** Token wird beim ersten Render aus dem localStorage initialisiert (Lazy Initializer). */
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Beim Mounten (oder wenn sich das Token ändert): Aktuellen Benutzer vom
   * Backend laden (/auth/me). Schlägt der Request fehl (z. B. 401 bei
   * abgelaufenem Token), wird das Token aus dem localStorage entfernt und
   * der Zustand zurückgesetzt – der Nutzer ist damit ausgeloggt.
   */
  useEffect(() => {
    if (token) {
      api.get<User>('/auth/me').then(setUser).catch(() => { localStorage.removeItem('token'); setToken(null); }).finally(() => setIsLoading(false));
    } else { setIsLoading(false); }
  }, [token]);

  /** Anmeldung: Sendet Credentials an /auth/login, speichert Token + User. */
  const login = async (email: string, password: string) => {
    const r = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('token', r.token); setToken(r.token); setUser(r.user);
  };

  /**
   * Abmeldung: Benachrichtigt das Backend (fire-and-forget, Fehler werden ignoriert)
   * und bereinigt sofort den clientseitigen Zustand (Token + User).
   */
  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token'); setToken(null); setUser(null);
  };

  /** Prüft, ob der Nutzer exakt die angegebene Rolle besitzt. */
  const hasRole = (r: RoleName) => user?.roles.includes(r) || false;

  /**
   * RBAC-Mindestrollenprüfung: Gibt true zurück, wenn der Nutzer mindestens
   * eine Rolle besitzt, deren Hierarchiestufe >= der geforderten Mindestrolle ist.
   * Beispiel: hasMinRole('service') ist true für service, operator und admin.
   */
  const hasMinRole = (min: RoleName) => user?.roles.some(r => hierarchy[r] >= hierarchy[min]) || false;

  return <Ctx.Provider value={{ user, token, isLoading, login, logout, hasRole, hasMinRole }}>{children}</Ctx.Provider>;
}

/**
 * Convenience-Hook für den Zugriff auf den AuthContext.
 * Wirft einen Fehler, falls außerhalb des AuthProviders verwendet –
 * so werden fehlende Provider frühzeitig erkannt.
 */
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; };
