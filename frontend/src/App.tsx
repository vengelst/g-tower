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
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/towers" element={<TowersPage />} />
        <Route path="/towers/:id" element={<TowerDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/users" element={<ProtectedRoute minRole="admin"><UsersPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
