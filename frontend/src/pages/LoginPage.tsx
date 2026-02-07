import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); nav('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center"><h1 className="text-4xl font-bold text-white">G-Tower</h1><p className="mt-2 text-gray-400">Management System</p></div>
        <form className="card p-8 space-y-6" onSubmit={submit}>
          <h2 className="text-xl font-semibold text-gray-900">Anmelden</h2>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <div><label htmlFor="email" className="label">E-Mail</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="admin@gtower.local" /></div>
          <div><label htmlFor="pw" className="label">Passwort</label><input id="pw" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Passwort" /></div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Anmelden...' : 'Anmelden'}</button>
        </form>
      </div>
    </div>
  );
}
