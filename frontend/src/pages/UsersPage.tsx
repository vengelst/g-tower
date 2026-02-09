/**
 * @module UsersPage
 *
 * @description
 * Benutzerverwaltungsseite des G-Tower Management Systems.
 * Ermoeglicht das Anzeigen, Erstellen, Bearbeiten und Deaktivieren von Benutzerkonten.
 *
 * @role
 * Admin-Bereich: Diese Seite ist nur fuer Benutzer mit der Rolle "admin" zugaenglich
 * (Zugriffskontrolle erfolgt ueber das Routing/AuthContext).
 * Verwaltet Benutzerkonten mit Rollen (admin, operator, service, viewer),
 * Aktivierungsstatus und persoenlichen Daten.
 *
 * @dependencies
 * - userService          – CRUD-Operationen fuer Benutzer (getAll, create, update, delete)
 * - ToastContext          – Erfolgs-/Fehlermeldungen
 * - DataTable-Komponente  – Generische Tabelle mit Pagination
 * - Modal-Komponente      – Wiederverwendbarer Dialog
 *
 * @assumptions
 * - Nur Admins erreichen diese Seite (Routing-Guard in der App-Konfiguration).
 * - "Deaktivieren" setzt den Benutzer auf is_active=false, loescht ihn aber
 *   nicht physisch aus der Datenbank (Soft-Delete ueber userService.delete).
 * - Jeder Benutzer hat genau EINE Rolle (obwohl das Array-Format mehrere erlaubt).
 *   Daher wird nur roles[0] im Formular angezeigt/bearbeitet.
 * - Passwort-Mindestlaenge: 8 Zeichen (wird im Frontend validiert).
 * - Beim Bearbeiten kann das Passwort NICHT geaendert werden (nur Name, E-Mail, Rolle, Status).
 *
 * @changelog
 * - Neue Rollen erfordern Ergaenzung in den Rollen-Dropdowns beider Modals.
 * - Bei Einfuehrung von Multi-Rollen muss die Formularlogik angepasst werden.
 */
import { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import type { User, RoleName, PaginatedResponse } from '../types';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function UsersPage() {
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  /** Benutzer, der aktuell im Bearbeitungs-Modal geoeffnet ist */
  const [editUser, setEditUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    setError('');
    userService.getAll({ page, limit: 20 })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]);

  /**
   * Deaktiviert einen Benutzer nach Bestaetigung.
   * Verwendet userService.delete(), was im Backend ein Soft-Delete
   * durchfuehrt (is_active = false), keinen physischen Loeschvorgang.
   */
  const deactivate = async (id: string) => {
    if (!confirm('Benutzer deaktivieren?')) return;
    try { await userService.delete(id); showToast('Benutzer deaktiviert'); load(); }
    catch { showToast('Deaktivierung fehlgeschlagen', 'error'); }
  };

  /** Spaltendefinition fuer die DataTable */
  const columns = [
    { key: 'email', header: 'E-Mail' },
    { key: 'name', header: 'Name', render: (u: User) => `${u.first_name} ${u.last_name}` },
    { key: 'roles', header: 'Rollen', render: (u: User) => <div className="flex gap-1">{u.roles.map(r => <span key={r} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{r}</span>)}</div> },
    { key: 'is_active', header: 'Status', render: (u: User) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{u.is_active ? 'Aktiv' : 'Inaktiv'}</span> },
    { key: 'last_login', header: 'Letzter Login', render: (u: User) => u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : 'Noch nie' },
    { key: 'actions', header: '', render: (u: User) => (
      /* stopPropagation verhindert, dass ein ggf. vorhandener Zeilen-Klick-Handler ausgeloest wird */
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => setEditUser(u)} className="text-blue-600 hover:underline text-sm">Bearbeiten</button>
        {/* Nur aktive Benutzer koennen deaktiviert werden */}
        {u.is_active && <button onClick={() => deactivate(u.id)} className="text-red-600 hover:underline text-sm">Deaktivieren</button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Benutzerverwaltung</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Neuer Benutzer</button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
      <DataTable columns={columns} data={data?.data || []} isLoading={loading} emptyMessage="Keine Benutzer vorhanden" pagination={data?.pagination} onPageChange={setPage} />
      {showCreate && <CreateUser onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); showToast('Benutzer erstellt'); load(); }} />}
      {editUser && <EditUser user={editUser} onClose={() => setEditUser(null)} onUpdated={() => { setEditUser(null); showToast('Benutzer aktualisiert'); load(); }} />}
    </div>
  );
}

/**
 * Modal-Formular zum Erstellen eines neuen Benutzers.
 * Pflichtfelder: Vorname, Nachname, E-Mail, Passwort (min. 8 Zeichen).
 * Die Rolle wird als einzelner Wert ausgewaehlt, aber als Array an das
 * Backend gesendet (kompatibel mit dem Multi-Rollen-Datenmodell).
 * Standard-Rolle: "viewer" (niedrigste Berechtigungsstufe).
 */
function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' as RoleName });
  const [error, setError] = useState('');
  const [sub, setSub] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSub(true); setError('');
    try { await userService.create({ email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName, roles: [f.role] }); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Neuer Benutzer">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4"><div><label className="label">Vorname *</label><input required value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} className="input" /></div><div><label className="label">Nachname *</label><input required value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} className="input" /></div></div>
        <div><label className="label">E-Mail *</label><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className="input" /></div>
        <div><label className="label">Passwort * (min. 8)</label><input type="password" required minLength={8} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} className="input" /></div>
        <div><label className="label">Rolle</label><select value={f.role} onChange={e => setF({ ...f, role: e.target.value as RoleName })} className="input"><option value="admin">Admin</option><option value="operator">Operator</option><option value="service">Service</option><option value="viewer">Viewer</option></select></div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Erstelle...' : 'Erstellen'}</button></div>
      </form>
    </Modal>
  );
}

/**
 * Modal-Formular zum Bearbeiten eines bestehenden Benutzers.
 * Aenderbar: Vorname, Nachname, E-Mail, Rolle und Aktivierungsstatus.
 * Das Passwort kann hier NICHT geaendert werden.
 * Der Aktivierungsstatus wird ueber eine Checkbox gesteuert.
 */
function EditUser({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: () => void }) {
  /** Initialisiert das Formular mit den aktuellen Benutzerdaten; roles[0] fuer Einzelrollen-Anzeige */
  const [f, setF] = useState({ email: user.email, firstName: user.first_name, lastName: user.last_name, isActive: user.is_active, role: user.roles[0] as RoleName });
  const [error, setError] = useState('');
  const [sub, setSub] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSub(true); setError('');
    try { await userService.update(user.id, { email: f.email, firstName: f.firstName, lastName: f.lastName, isActive: f.isActive, roles: [f.role] }); onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Benutzer bearbeiten">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4"><div><label className="label">Vorname</label><input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} className="input" /></div><div><label className="label">Nachname</label><input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} className="input" /></div></div>
        <div><label className="label">E-Mail</label><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className="input" /></div>
        <div><label className="label">Rolle</label><select value={f.role} onChange={e => setF({ ...f, role: e.target.value as RoleName })} className="input"><option value="admin">Admin</option><option value="operator">Operator</option><option value="service">Service</option><option value="viewer">Viewer</option></select></div>
        <div className="flex items-center gap-2"><input type="checkbox" id="active" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} className="rounded border-gray-300" /><label htmlFor="active" className="text-sm text-gray-700">Aktiv</label></div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Speichere...' : 'Speichern'}</button></div>
      </form>
    </Modal>
  );
}
