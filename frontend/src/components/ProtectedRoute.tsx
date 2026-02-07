import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types';

export default function ProtectedRoute({ children, minRole }: { children: React.ReactNode; minRole?: RoleName }) {
  const { user, isLoading, hasMinRole } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !hasMinRole(minRole)) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Zugriff verweigert</h1><p className="text-gray-600">Keine Berechtigung.</p></div></div>;
  return <>{children}</>;
}
