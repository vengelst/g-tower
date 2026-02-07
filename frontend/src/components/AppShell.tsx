import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types';

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
  const [open, setOpen] = useState(false);
  const items = nav.filter(n => hasMinRole(n.min));

  return (
    <div className="min-h-screen bg-gray-50">
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="fixed inset-0 bg-gray-600/75" onClick={() => setOpen(false)} /><div className="fixed inset-y-0 left-0 w-64 bg-gray-900"><Sidebar items={items} path={loc.pathname} user={user} logout={logout} /></div></div>}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-gray-900"><Sidebar items={items} path={loc.pathname} user={user} logout={logout} /></div>
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
          <button className="lg:hidden -m-2.5 p-2.5 text-gray-700 text-xl" onClick={() => setOpen(true)}>&#9776;</button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-sm text-gray-700">{user?.first_name} {user?.last_name}</span>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{user?.roles[0]}</span>
          </div>
        </div>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

function Sidebar({ items, path, user, logout }: { items: typeof nav; path: string; user: { first_name: string; last_name: string; email: string } | null; logout: () => void }) {
  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex h-16 items-center px-6 border-b border-gray-800"><h1 className="text-xl font-bold text-white">G-Tower</h1><span className="ml-2 text-xs text-gray-400">Management</span></div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(n => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          return <Link key={n.href} to={n.href} className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>{n.name}</Link>;
        })}
      </nav>
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{user?.first_name} {user?.last_name}</p><p className="text-xs text-gray-400 truncate">{user?.email}</p></div>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm" title="Abmelden">Logout</button>
        </div>
      </div>
    </div>
  );
}
