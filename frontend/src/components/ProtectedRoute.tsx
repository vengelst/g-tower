/**
 * ProtectedRoute – Rollenbasierter Zugangsschutz (RBAC) im Frontend.
 *
 * Zweck:
 *   Schützt Routen vor unauthentifizierten oder nicht ausreichend berechtigten
 *   Benutzern. Prüft zunächst, ob ein Benutzer eingeloggt ist, und optional,
 *   ob er die erforderliche Mindest­rolle besitzt.
 *
 * Rolle im Gesamtsystem:
 *   Wird als Wrapper um geschützte Routen in der React-Router-Konfiguration
 *   eingesetzt. Jede Route, die Authentifizierung oder eine bestimmte Rolle
 *   voraussetzt, wird mit dieser Komponente umschlossen.
 *
 * Abhängigkeiten:
 *   - react-router-dom (Navigate) für die Weiterleitung zur Login-Seite.
 *   - AuthContext (useAuth) für Benutzer­daten, Ladezustand und Rollen-Check.
 *   - Typ RoleName aus ../types.
 *
 * Wichtige Annahmen:
 *   - Die Rollen-Hierarchie ist: admin (4) > operator (3) > service (2) > viewer (1).
 *     hasMinRole() gibt true zurück, wenn die Benutzerrolle >= minRole ist.
 *   - Dies ist ein reiner Frontend-Schutz zur UX-Verbesserung. Die eigentliche
 *     Autorisierung MUSS zusätzlich im Backend erfolgen (API-Middleware).
 *   - Während der Auth-Zustand geladen wird (isLoading), wird ein Spinner angezeigt,
 *     um ein kurzzeitiges Aufblitzen der Login-Seite zu vermeiden.
 *
 * Änderungshinweise:
 *   - Falls neue Rollen hinzukommen, muss die Hierarchie im AuthContext und
 *     im Backend-Middleware synchron angepasst werden.
 *   - Für feinere Berechtigungen (z. B. Feature-Flags) könnte ein zusätzlicher
 *     `permission`-Prop ergänzt werden.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types';

export default function ProtectedRoute({ children, minRole }: { children: React.ReactNode; minRole?: RoleName }) {
  const { user, isLoading, hasMinRole } = useAuth();
  /* Ladezustand: Spinner anzeigen, bis der Auth-Status feststeht. */
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  /* Nicht eingeloggt: Weiterleitung zur Login-Seite (replace verhindert Back-Navigation). */
  if (!user) return <Navigate to="/login" replace />;
  /* Rolle nicht ausreichend: Fehlermeldung statt Weiterleitung, da der Benutzer eingeloggt ist. */
  if (minRole && !hasMinRole(minRole)) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Zugriff verweigert</h1><p className="text-gray-600">Keine Berechtigung.</p></div></div>;
  /* Alle Prüfungen bestanden: Geschützte Kinder-Komponenten rendern. */
  return <>{children}</>;
}
