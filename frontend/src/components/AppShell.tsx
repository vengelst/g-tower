/**
 * AppShell – Haupt-Layout-Komponente der Anwendung.
 *
 * Zweck:
 *   Stellt das grundlegende Seitenlayout bereit: Sidebar (Navigation), Header
 *   (Benutzerinfo) und einen <Outlet /> für die jeweilige Unterseite.
 *
 * Rolle im Gesamtsystem:
 *   Wird als umschließende Route in React-Router eingebunden. Jede authentifizierte
 *   Seite rendert innerhalb dieses Shells. Die Sidebar-Navigation ist rollenbasiert
 *   gefiltert – Einträge erscheinen nur, wenn der Benutzer die Mindest­rolle erfüllt.
 *
 * Abhängigkeiten:
 *   - react-router-dom (Link, useLocation, Outlet)
 *   - AuthContext (useAuth) für Benutzer, Logout und Rollen-Check
 *   - Typ RoleName aus ../types
 *
 * Wichtige Annahmen:
 *   - Der Benutzer ist bereits authentifiziert (ProtectedRoute umschließt AppShell).
 *   - Die Rollen-Hierarchie (admin > operator > service > viewer) wird durch
 *     hasMinRole() im AuthContext abgebildet.
 *   - Auf Desktop (lg+) wird die Sidebar dauerhaft angezeigt; auf Mobile wird sie
 *     als Overlay per Hamburger-Button ein-/ausgeblendet.
 *
 * Änderungshinweise:
 *   - Neue Navigationseinträge in das `nav`-Array einfügen; `min` bestimmt die
 *     erforderliche Mindest­rolle.
 *   - Für eine Bottom-Navigation auf Mobile müsste eine zusätzliche Leiste ergänzt
 *     werden; aktuell wird ein Slide-Over-Menü genutzt.
 */

import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types';

/**
 * Navigations­definition: Jeder Eintrag hat einen Anzeigenamen, eine Ziel-Route
 * und die Mindest­rolle, die zum Sehen des Eintrags erforderlich ist.
 */
const nav = [
  { name: 'Dashboard', href: '/', min: 'viewer' as RoleName },
  { name: 'Towers', href: '/towers', min: 'viewer' as RoleName },
  { name: 'Karte', href: '/map', min: 'viewer' as RoleName },
  { name: 'Service', href: '/tickets', min: 'viewer' as RoleName },
  { name: 'Dokumente', href: '/documents', min: 'viewer' as RoleName },
  { name: 'Benutzer', href: '/users', min: 'admin' as RoleName },
];

export default function AppShell() {
  const { user, logout, hasMinRole } = useAuth();
  const loc = useLocation();
  /** Steuert die Sichtbarkeit der mobilen Sidebar (Overlay). */
  const [open, setOpen] = useState(false);
  /** Nur die Nav-Einträge anzeigen, für die der Benutzer die Mindest­rolle besitzt. */
  const items = nav.filter(n => hasMinRole(n.min));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Sidebar: Overlay mit halbtransparentem Backdrop; Klick auf Backdrop schließt das Menü. */}
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="fixed inset-0 bg-gray-600/75" onClick={() => setOpen(false)} /><div className="fixed inset-y-0 left-0 w-64 bg-gray-900"><Sidebar items={items} path={loc.pathname} user={user} logout={logout} /></div></div>}
      {/* Desktop Sidebar: Permanent sichtbar ab Breakpoint lg (1024 px). */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-gray-900"><Sidebar items={items} path={loc.pathname} user={user} logout={logout} /></div>
      {/* Hauptbereich: Links-Padding gleicht die feste Desktop-Sidebar aus. */}
      <div className="lg:pl-64">
        {/* Header-Leiste: Hamburger-Button (nur Mobile) und Benutzerinformationen rechts. */}
        <div className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
          <button className="lg:hidden -m-2.5 p-2.5 text-gray-700 text-xl" onClick={() => setOpen(true)}>&#9776;</button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-sm text-gray-700">{user?.first_name} {user?.last_name}</span>
            {/* Rollen-Badge: Zeigt die erste (primäre) Rolle des Benutzers an. */}
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{user?.roles[0]}</span>
          </div>
        </div>
        {/* Outlet rendert die jeweils aktive Unter-Route (z. B. Dashboard, Towers …). */}
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

/**
 * Sidebar – Interne Hilfskomponente für die vertikale Navigation.
 *
 * Wird sowohl in der Desktop- als auch in der Mobile-Variante wiederverwendet.
 * Markiert den aktiven Navigations­eintrag farblich (weiß auf dunklem Hintergrund).
 */
function Sidebar({ items, path, user, logout }: { items: typeof nav; path: string; user: { first_name: string; last_name: string; email: string } | null; logout: () => void }) {
  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex h-16 items-center px-6 border-b border-gray-800"><h1 className="text-xl font-bold text-white">G-Tower</h1><span className="ml-2 text-xs text-gray-400">Management</span></div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(n => {
          /**
           * Aktiv-Erkennung: Dashboard (href === '/') wird nur bei exaktem Pfad
           * hervorgehoben; alle anderen Einträge bei startsWith-Match, damit
           * Unterseiten (z. B. /towers/123) den Eltern-Eintrag aktiv halten.
           */
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          return <Link key={n.href} to={n.href} className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>{n.name}</Link>;
        })}
      </nav>
      {/* Fußbereich der Sidebar: Benutzer­name, E-Mail und Logout-Button. */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{user?.first_name} {user?.last_name}</p><p className="text-xs text-gray-400 truncate">{user?.email}</p></div>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm" title="Abmelden">Logout</button>
        </div>
      </div>
    </div>
  );
}
