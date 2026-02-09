/**
 * @module LoginPage
 *
 * @description
 * Anmeldeseite des G-Tower Management Systems.
 * Zeigt ein Login-Formular mit E-Mail- und Passwort-Eingabe.
 *
 * @role
 * Einzige oeffentlich zugaengliche Seite der Anwendung. Nicht-authentifizierte
 * Benutzer werden hierher umgeleitet. Nach erfolgreicher Anmeldung wird der
 * Benutzer zum Dashboard (/) weitergeleitet.
 *
 * @dependencies
 * - AuthContext (useAuth)  – Stellt die login()-Funktion bereit, die
 *   die Authentifizierung ueber das Backend durchfuehrt und den
 *   Auth-State (Token, Benutzer) im Context speichert.
 * - React Router (useNavigate) – Fuer die Weiterleitung nach erfolgreichem Login.
 *
 * @assumptions
 * - Der AuthContext speichert nach login() automatisch den JWT-Token
 *   und die Benutzerdaten (inkl. Rollen) im lokalen State/Storage.
 * - Die Fehlerbehandlung zeigt generische Fehlermeldungen an
 *   (keine Unterscheidung zwischen "Benutzer nicht gefunden" und
 *   "Falsches Passwort" aus Sicherheitsgruenden).
 * - Das Formular nutzt native HTML-Validierung (required, type="email").
 *
 * @changelog
 * - Bei Einfuehrung von SSO/OAuth muss diese Seite um zusaetzliche
 *   Login-Optionen erweitert werden.
 * - Ein "Passwort vergessen"-Link fehlt derzeit und koennte hier ergaenzt werden.
 */
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

  /**
   * Formular-Submit-Handler: Verhindert Standard-Submit, ruft die
   * login()-Funktion aus dem AuthContext auf und leitet bei Erfolg
   * zum Dashboard weiter. Bei Fehler wird eine Meldung angezeigt.
   */
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); nav('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Anwendungs-Branding */}
        <div className="text-center"><h1 className="text-4xl font-bold text-white">G-Tower</h1><p className="mt-2 text-gray-400">Management System</p></div>
        <form className="card p-8 space-y-6" onSubmit={submit}>
          <h2 className="text-xl font-semibold text-gray-900">Anmelden</h2>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <div><label htmlFor="email" className="label">E-Mail</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="admin@gtower.local" /></div>
          <div><label htmlFor="pw" className="label">Passwort</label><input id="pw" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Passwort" /></div>
          {/* Button-Text aendert sich waehrend des Ladens zur Rueckmeldung */}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? 'Anmelden...' : 'Anmelden'}</button>
        </form>
      </div>
    </div>
  );
}
