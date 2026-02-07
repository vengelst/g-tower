import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { towerService } from '../services/towerService';
import { documentService } from '../services/documentService';
import type { TowerWithHistory, TowerStatus, ServiceTicket, Document as DocType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

type Tab = 'details' | 'tickets' | 'documents';

export default function TowerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tower, setTower] = useState<TowerWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    towerService.getById(id)
      .then(setTower)
      .catch(err => { setError(err instanceof Error ? err.message : 'Fehler beim Laden'); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="text-center py-12"><p className="text-red-600">{error}</p><Link to="/towers" className="text-sm text-blue-600 hover:underline mt-2 inline-block">&larr; Zurück zur Liste</Link></div>;
  if (!tower) return <div className="text-center text-gray-500 py-12">Tower nicht gefunden</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><Link to="/towers" className="text-sm text-blue-600 hover:underline">&larr; Zurück</Link><h1 className="text-2xl font-bold text-gray-900 mt-1">{tower.name}</h1><p className="text-gray-500">{tower.serial_number}</p></div>
        <div className="flex items-center gap-3"><StatusBadge type="tower" value={tower.status} />{hasMinRole('operator') && <button onClick={() => setShowStatus(true)} className="btn btn-secondary text-sm">Status ändern</button>}</div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabBtn active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</TabBtn>
          <TabBtn active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')}>Tickets ({tower.tickets?.length ?? 0})</TabBtn>
          <TabBtn active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Dokumente ({tower.documents?.length ?? 0})</TabBtn>
        </nav>
      </div>

      {activeTab === 'details' && <DetailsTab tower={tower} />}
      {activeTab === 'tickets' && <TicketsTab tickets={tower.tickets ?? []} towerId={tower.id} reload={load} />}
      {activeTab === 'documents' && <DocumentsTab documents={tower.documents ?? []} towerId={tower.id} reload={load} />}

      {showStatus && <StatusModal current={tower.status} towerId={tower.id} onClose={() => setShowStatus(false)} onDone={() => { setShowStatus(false); showToast('Status geändert'); load(); }} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`py-4 px-1 border-b-2 font-medium text-sm ${active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
      {children}
    </button>
  );
}

function DetailsTab({ tower }: { tower: TowerWithHistory }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6"><h2 className="text-lg font-semibold mb-4">Standort</h2>
          <dl className="space-y-2">
            <D label="Straße" value={tower.address_street} /><D label="Stadt" value={tower.address_city} /><D label="PLZ" value={tower.address_zip} /><D label="Land" value={tower.address_country} />
            <D label="Koordinaten" value={tower.latitude && tower.longitude ? `${tower.latitude}, ${tower.longitude}` : null} />
          </dl>
        </div>
        <div className="card p-6"><h2 className="text-lg font-semibold mb-4">Informationen</h2>
          <dl className="space-y-2">
            <D label="Beschreibung" value={tower.description} />
            <D label="Inbetriebnahme" value={tower.commissioned_at ? new Date(tower.commissioned_at).toLocaleDateString('de-DE') : null} />
            <D label="Erstellt" value={new Date(tower.created_at).toLocaleDateString('de-DE')} />
          </dl>
        </div>
      </div>
      <div className="card p-6"><h2 className="text-lg font-semibold mb-4">Statusverlauf</h2>
        {tower.statusHistory.length === 0 ? <p className="text-gray-500">Keine Einträge</p> :
          <div className="space-y-3">{tower.statusHistory.map(e => (
            <div key={e.id} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
              <div className="text-sm text-gray-500 w-32 shrink-0">{new Date(e.changed_at).toLocaleString('de-DE')}</div>
              <div className="flex items-center gap-2">{e.old_status && <><StatusBadge type="tower" value={e.old_status} /><span className="text-gray-400">&rarr;</span></>}<StatusBadge type="tower" value={e.new_status} /></div>
              <div className="text-sm text-gray-600 flex-1">{e.reason}</div>
              <div className="text-sm text-gray-400">{e.first_name} {e.last_name}</div>
            </div>
          ))}</div>}
      </div>
    </>
  );
}

function TicketsTab({ tickets, towerId, reload }: { tickets: ServiceTicket[]; towerId: string; reload: () => void }) {
  const { hasMinRole } = useAuth();
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tickets</h2>
        {hasMinRole('service') && <Link to={`/tickets?towerId=${towerId}`} className="btn btn-primary text-sm">Alle Tickets</Link>}
      </div>
      {tickets.length === 0 ? <p className="text-gray-500 py-8 text-center">Keine Tickets vorhanden</p> :
        <div className="space-y-3">
          {tickets.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{t.ticket_number}</span>
                  <StatusBadge type="ticket" value={t.status} />
                  <StatusBadge type="priority" value={t.priority} />
                </div>
                <p className="text-sm text-gray-600 mt-1">{t.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Erstellt: {new Date(t.created_at).toLocaleDateString('de-DE')}
                  {t.assigned_to_name && ` · Zugewiesen: ${t.assigned_to_name}`}
                </p>
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}

function DocumentsTab({ documents, towerId, reload }: { documents: DocType[]; towerId: string; reload: () => void }) {
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  const download = async (docId: string) => {
    try { await documentService.download(docId); } catch { showToast('Download fehlgeschlagen', 'error'); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dokumente</h2>
        {hasMinRole('service') && <Link to={`/documents?towerId=${towerId}`} className="btn btn-primary text-sm">Alle Dokumente</Link>}
      </div>
      {documents.length === 0 ? <p className="text-gray-500 py-8 text-center">Keine Dokumente vorhanden</p> :
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{doc.title || doc.original_filename}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {doc.document_type || 'Sonstige'} · v{doc.version} · {new Date(doc.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => download(doc.id)} className="text-blue-600 hover:underline text-sm">Download</button>
            </div>
          ))}
        </div>}
    </div>
  );
}

function D({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex"><dt className="w-36 text-sm text-gray-500 shrink-0">{label}</dt><dd className="text-sm text-gray-900">{value || '-'}</dd></div>;
}

function StatusModal({ current, towerId, onClose, onDone }: { current: TowerStatus; towerId: string; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<TowerStatus>(current);
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (status === current) { onClose(); return; }
    setSub(true); setError('');
    try { await towerService.updateStatus(towerId, status, reason); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Status ändern">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div><label className="label">Neuer Status</label><select value={status} onChange={e => setStatus(e.target.value as TowerStatus)} className="input"><option value="active">Aktiv</option><option value="offline">Offline</option><option value="maintenance">Wartung</option><option value="decommissioned">Stillgelegt</option></select></div>
        <div><label className="label">Grund</label><textarea value={reason} onChange={e => setReason(e.target.value)} className="input" rows={3} /></div>
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Speichere...' : 'Speichern'}</button></div>
      </form>
    </Modal>
  );
}
