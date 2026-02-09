/**
 * @module DocumentsPage
 *
 * @description
 * Verwaltungsseite fuer Dokumente im G-Tower Management System.
 * Ermoeglicht das Hochladen, Anzeigen, Filtern, Herunterladen und
 * Loeschen von Dokumenten, die optional einem Tower zugeordnet sein koennen.
 *
 * @role
 * Zentrale Dokumentenverwaltung. Dokumente koennen unterschiedlichen Typen
 * zugeordnet werden (Handbuch, Zertifikat, Bericht, Bild, Sonstige) und
 * sind versioniert. Von der TowerDetailPage kann hierher mit voreingestelltem
 * Tower-Filter navigiert werden (?towerId=...).
 *
 * @dependencies
 * - documentService      – Upload, Download, Loeschen und Listing von Dokumenten
 * - towerService         – Laedt Tower-Liste fuer Filter- und Upload-Dropdown
 * - AuthContext           – Rollenbasierte Sichtbarkeit (hasMinRole)
 * - ToastContext          – Erfolgs-/Fehlermeldungen
 * - DataTable-Komponente  – Generische Tabelle mit Pagination
 * - Modal-Komponente      – Wiederverwendbarer Dialog
 *
 * @assumptions
 * - URL-Parameter "towerId" kann vorbelegt sein (z.B. von TowerDetailPage).
 * - Nur Benutzer mit mindestens der Rolle "service" duerfen Dokumente hochladen.
 * - Nur Benutzer mit mindestens der Rolle "operator" duerfen Dokumente loeschen.
 * - Datei-Upload akzeptiert: PDF, PNG, JPG, DOC(X), XLS(X).
 * - Dokumente ohne Tower-Zuordnung sind "globale" Dokumente.
 * - Die Dateigrösse wird als menschenlesbarer String formatiert (B, KB, MB).
 *
 * @changelog
 * - Neue Dokument-Typen muessen im UploadModal ergaenzt werden.
 * - Aenderungen an den akzeptierten Dateitypen: accept-Attribut im File-Input anpassen.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { documentService } from '../services/documentService';
import { towerService } from '../services/towerService';
import type { Document, Tower, PaginatedResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

/**
 * Formatiert eine Dateigroesse in Bytes in eine menschenlesbare Einheit.
 * B (< 1 KB), KB (< 1 MB), MB (>= 1 MB).
 */
const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

export default function DocumentsPage() {
  const [data, setData] = useState<PaginatedResponse<Document> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [searchParams] = useSearchParams();
  /** Tower-Filter kann via URL-Query vorbelegt sein (z.B. ?towerId=xxx) */
  const [towerFilter, setTowerFilter] = useState(searchParams.get('towerId') || '');
  /** Tower-Liste fuer das Filter-Dropdown (wird einmalig beim Mounten geladen) */
  const [towers, setTowers] = useState<Tower[]>([]);
  const [page, setPage] = useState(1);
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  /** Einmaliges Laden aller Towers fuer die Filter- und Upload-Dropdowns */
  useEffect(() => { towerService.getAll({ limit: 200 }).then(r => setTowers(r.data)).catch(console.error); }, []);

  const load = () => {
    setLoading(true);
    setError('');
    documentService.getAll({ page, limit: 20, towerId: towerFilter || undefined })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, towerFilter]);

  /** Loescht ein Dokument nach Bestaetigung durch den Benutzer */
  const del = async (id: string) => {
    if (!confirm('Dokument löschen?')) return;
    try { await documentService.delete(id); showToast('Dokument gelöscht'); load(); }
    catch { showToast('Löschen fehlgeschlagen', 'error'); }
  };

  /** Spaltendefinition fuer die DataTable */
  const columns = [
    { key: 'title', header: 'Titel', render: (d: Document) => d.title || d.original_filename },
    { key: 'tower_name', header: 'Tower', render: (d: Document) => d.tower_name || '-' },
    { key: 'document_type', header: 'Typ', render: (d: Document) => d.document_type || '-' },
    { key: 'file_size', header: 'Größe', render: (d: Document) => fmtSize(d.file_size) },
    { key: 'version', header: 'V.', render: (d: Document) => `v${d.version}` },
    { key: 'created_at', header: 'Datum', render: (d: Document) => new Date(d.created_at).toLocaleDateString('de-DE') },
    { key: 'actions', header: '', render: (d: Document) => (
      /* stopPropagation verhindert, dass der Zeilen-Klick-Handler ausgeloest wird */
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={() => documentService.download(d.id)} className="text-blue-600 hover:underline text-sm">Download</button>
        {hasMinRole('operator') && <button onClick={() => del(d.id)} className="text-red-600 hover:underline text-sm">Löschen</button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dokumente</h1>
        {/* Nur Service-Mitarbeiter und hoeher duerfen Dokumente hochladen */}
        {hasMinRole('service') && <button onClick={() => setShowUpload(true)} className="btn btn-primary">+ Hochladen</button>}
      </div>

      {/* === Filterleiste: Nur Tower-Filter === */}
      <div className="card p-4 flex gap-3 items-end flex-wrap">
        <div className="w-64"><label className="label">Tower</label><select value={towerFilter} onChange={e => { setTowerFilter(e.target.value); setPage(1); }} className="input"><option value="">Alle Towers</option>{towers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.serial_number})</option>)}</select></div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
      <DataTable columns={columns} data={data?.data || []} isLoading={loading} emptyMessage="Keine Dokumente vorhanden" pagination={data?.pagination} onPageChange={setPage} />

      {/* Upload-Modal */}
      {showUpload && <UploadModal towers={towers} onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); showToast('Dokument hochgeladen'); load(); }} />}
    </div>
  );
}

/**
 * Modal-Formular zum Hochladen eines neuen Dokuments.
 * Pflichtfeld: Datei-Auswahl.
 * Optionale Felder: Tower-Zuordnung, Titel, Dokumenttyp.
 * Akzeptierte Dateitypen: PDF, Bilder (PNG/JPG), Office-Dokumente (DOC/DOCX, XLS/XLSX).
 * Der Dokumenttyp-Standard ist "Sonstige" (other).
 */
function UploadModal({ towers, onClose, onDone }: { towers: Tower[]; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ towerId: '', title: '', description: '', documentType: 'other' });
  const [error, setError] = useState('');
  const [sub, setSub] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file) { setError('Datei auswählen'); return; }
    setSub(true); setError('');
    try { await documentService.upload(file, { towerId: f.towerId || undefined, title: f.title || undefined, description: f.description || undefined, documentType: f.documentType as 'other' }); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Dokument hochladen" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div><label className="label">Datei *</label><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="input" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" /></div>
        <div><label className="label">Tower</label><select value={f.towerId} onChange={e => setF({ ...f, towerId: e.target.value })} className="input"><option value="">Kein Tower</option>{towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label">Titel</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input" /></div>
        <div><label className="label">Typ</label><select value={f.documentType} onChange={e => setF({ ...f, documentType: e.target.value })} className="input"><option value="manual">Handbuch</option><option value="certificate">Zertifikat</option><option value="report">Bericht</option><option value="image">Bild</option><option value="other">Sonstige</option></select></div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Lade hoch...' : 'Hochladen'}</button></div>
      </form>
    </Modal>
  );
}
