/**
 * App.tsx – Haupt-Routing-Komponente der G-Tower SPA
 * =============================================================================
 * Zweck:         Definiert alle Frontend-Routen und deren Zugriffsbeschränkungen.
 * Rolle:         Zentrale Route-Definition. Wird von main.tsx innerhalb des
 *                BrowserRouter gerendert. Nutzt ProtectedRoute für Auth-Schutz.
 * Abhängigkeiten: react-router-dom, AuthContext, ProtectedRoute, AppShell, Pages
 * Wichtige Annahmen:
 *   - Nicht eingeloggte User werden zu /login umgeleitet
 *   - Eingeloggte User auf /login werden zu / umgeleitet
 *   - AppShell (Sidebar + Header) umschließt alle geschützten Routen
 *   - /users ist nur für Admins zugänglich (minRole="admin")
 *   - Alle anderen geschützten Routen sind für jeden eingeloggten User sichtbar
 *   - Unbekannte Pfade (/*) → Redirect auf /
 * Änderungshinweise:
 *   - Neue Seiten: Route hier ergänzen + Komponente importieren
 *   - RBAC: ProtectedRoute mit minRole für rollenbasierte Einschränkungen
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TowersPage from './pages/TowersPage';
import TowerDetailPage from './pages/TowerDetailPage';
import TicketsPage from './pages/TicketsPage';
import DocumentsPage from './pages/DocumentsPage';
import UsersPage from './pages/UsersPage';
import MapPage from './pages/MapPage';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Login-Seite: Nur für nicht-eingeloggte User */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Geschützte Routen: Erfordern gültiges JWT-Token */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/towers" element={<TowersPage />} />
        <Route path="/towers/:id" element={<TowerDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        {/* Benutzerverwaltung: Nur für Admins (RBAC-Hierarchie: admin=4) */}
        <Route path="/users" element={<ProtectedRoute minRole="admin"><UsersPage /></ProtectedRoute>} />
      </Route>

      {/* Fallback: Unbekannte Pfade → Dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
