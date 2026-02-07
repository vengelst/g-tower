import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ticketService } from '../services/ticketService';
import { towerService } from '../services/towerService';
import type { ServiceTicket, TicketStatus, TicketPriority, Tower, PaginatedResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function TicketsPage() {
  const [data, setData] = useState<PaginatedResponse<ServiceTicket> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<ServiceTicket | null>(null);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [towerFilter, setTowerFilter] = useState(searchParams.get('towerId') || '');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [page, setPage] = useState(1);
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  useEffect(() => { towerService.getAll({ limit: 200 }).then(r => setTowers(r.data)).catch(console.error); }, []);

  const load = () => {
    setLoading(true);
    setError('');
    ticketService.getAll({
      page,
      limit: 20,
      status: (statusFilter || undefined) as TicketStatus | undefined,
      priority: (priorityFilter || undefined) as TicketPriority | undefined,
      towerId: towerFilter || undefined,
    }).then(setData).catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden')).finally(() => setLoading(false));
  };
  useEffect(load, [page, statusFilter, priorityFilter, towerFilter]);

  const columns = [
    { key: 'ticket_number', header: 'Nummer' },
    { key: 'title', header: 'Titel' },
    { key: 'tower_name', header: 'Tower', render: (t: ServiceTicket) => t.tower_name || '-' },
    { key: 'priority', header: 'Priorität', render: (t: ServiceTicket) => <StatusBadge type="priority" value={t.priority} /> },
    { key: 'status', header: 'Status', render: (t: ServiceTicket) => <StatusBadge type="ticket" value={t.status} /> },
    { key: 'assigned_to_name', header: 'Zugewiesen', render: (t: ServiceTicket) => t.assigned_to_name || '-' },
    { key: 'created_at', header: 'Erstellt', render: (t: ServiceTicket) => new Date(t.created_at).toLocaleDateString('de-DE') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Service-Tickets</h1>
        {hasMinRole('service') && <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Neues Ticket</button>}
      </div>
      <div className="card p-4 flex gap-3 items-end flex-wrap">
        <div className="w-48"><label className="label">Status</label><select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input"><option value="">Alle</option><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="pending">Wartend</option><option value="resolved">Gelöst</option><option value="closed">Geschlossen</option></select></div>
        <div className="w-48"><label className="label">Priorität</label><select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className="input"><option value="">Alle</option><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option><option value="critical">Kritisch</option></select></div>
        <div className="w-64"><label className="label">Tower</label><select value={towerFilter} onChange={e => { setTowerFilter(e.target.value); setPage(1); }} className="input"><option value="">Alle Towers</option>{towers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.serial_number})</option>)}</select></div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
      <DataTable columns={columns} data={data?.data || []} isLoading={loading} emptyMessage="Keine Tickets vorhanden" pagination={data?.pagination} onPageChange={setPage} onRowClick={setSelected} />
      {showCreate && <CreateTicket towers={towers} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); showToast('Ticket erstellt'); load(); }} />}
      {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); showToast('Ticket aktualisiert'); load(); }} />}
    </div>
  );
}

function CreateTicket({ towers, onClose, onCreated }: { towers: Tower[]; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ towerId: '', title: '', description: '', ticketType: 'maintenance', priority: 'medium' });
  const [error, setError] = useState('');
  const [sub, setSub] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSub(true); setError('');
    try { await ticketService.create({ towerId: f.towerId, title: f.title, description: f.description || undefined, ticketType: f.ticketType as 'maintenance', priority: f.priority as 'medium' }); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Neues Ticket" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div><label className="label">Tower *</label><select required value={f.towerId} onChange={e => setF({ ...f, towerId: e.target.value })} className="input"><option value="">Auswählen...</option>{towers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.serial_number})</option>)}</select></div>
        <div><label className="label">Titel *</label><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input" /></div>
        <div><label className="label">Beschreibung</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className="input" rows={3} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Typ</label><select value={f.ticketType} onChange={e => setF({ ...f, ticketType: e.target.value })} className="input"><option value="maintenance">Wartung</option><option value="incident">Störung</option><option value="inspection">Inspektion</option></select></div>
          <div><label className="label">Priorität</label><select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} className="input"><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option><option value="critical">Kritisch</option></select></div>
        </div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Erstelle...' : 'Erstellen'}</button></div>
      </form>
    </Modal>
  );
}

function TicketDetail({ ticket, onClose, onUpdated }: { ticket: ServiceTicket; onClose: () => void; onUpdated: () => void }) {
  const [status, setStatus] = useState(ticket.status);
  const [resolution, setResolution] = useState(ticket.resolution || '');
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');
  const { hasMinRole } = useAuth();
  const update = async () => {
    setSub(true); setError('');
    try { await ticketService.update(ticket.id, { status, resolution: resolution || undefined }); onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title={`Ticket ${ticket.ticket_number}`} size="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Titel:</span> <span className="font-medium">{ticket.title}</span></div>
          <div><span className="text-gray-500">Tower:</span> <span className="font-medium">{ticket.tower_name}</span></div>
          <div><span className="text-gray-500">Typ:</span> {ticket.ticket_type}</div>
          <div><span className="text-gray-500">Priorität:</span> <StatusBadge type="priority" value={ticket.priority} /></div>
          <div><span className="text-gray-500">Zugewiesen:</span> {ticket.assigned_to_name || '-'}</div>
          <div><span className="text-gray-500">Erstellt:</span> {new Date(ticket.created_at).toLocaleString('de-DE')}</div>
        </div>
        {ticket.description && <div><span className="text-sm text-gray-500">Beschreibung:</span><p className="mt-1 text-sm">{ticket.description}</p></div>}
        {hasMinRole('service') && <>
          <hr />
          <div><label className="label">Status</label><select value={status} onChange={e => setStatus(e.target.value as TicketStatus)} className="input"><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="pending">Wartend</option><option value="resolved">Gelöst</option><option value="closed">Geschlossen</option></select></div>
          <div><label className="label">Lösung</label><textarea value={resolution} onChange={e => setResolution(e.target.value)} className="input" rows={3} /></div>
          <div className="flex justify-end gap-3"><button onClick={onClose} className="btn btn-secondary">Schließen</button><button onClick={update} disabled={sub} className="btn btn-primary">{sub ? 'Speichere...' : 'Aktualisieren'}</button></div>
        </>}
      </div>
    </Modal>
  );
}
