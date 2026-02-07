import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { towerService } from '../services/towerService';
import type { Tower, TowerStatus, PaginatedResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function TowersPage() {
  const [data, setData] = useState<PaginatedResponse<Tower> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    setError('');
    towerService.getAll({ page, limit: 20, status: (statusFilter || undefined) as TowerStatus, search: search || undefined })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, statusFilter]);

  const columns = [
    { key: 'serial_number', header: 'Seriennummer' },
    { key: 'name', header: 'Name' },
    { key: 'address_city', header: 'Stadt' },
    { key: 'status', header: 'Status', render: (t: Tower) => <StatusBadge type="tower" value={t.status} /> },
    { key: 'created_at', header: 'Erstellt', render: (t: Tower) => new Date(t.created_at).toLocaleDateString('de-DE') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Towers</h1>
        {hasMinRole('operator') && <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Neuer Tower</button>}
      </div>
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]"><label className="label">Suche</label><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} className="input" placeholder="Name oder Seriennummer..." /></div>
        <div className="w-48"><label className="label">Status</label><select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input"><option value="">Alle</option><option value="active">Aktiv</option><option value="offline">Offline</option><option value="maintenance">Wartung</option><option value="decommissioned">Stillgelegt</option></select></div>
        <button onClick={() => { setPage(1); load(); }} className="btn btn-secondary">Suchen</button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
      <DataTable columns={columns} data={data?.data || []} isLoading={loading} emptyMessage="Keine Türme gefunden" pagination={data?.pagination} onPageChange={setPage} onRowClick={t => nav(`/towers/${t.id}`)} />
      {showCreate && <CreateTowerModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); showToast('Tower erstellt'); load(); }} />}
    </div>
  );
}

function CreateTowerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ serialNumber: '', name: '', description: '', street: '', city: '', zip: '', lat: '', lng: '' });
  const [error, setError] = useState('');
  const [sub, setSub] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSub(true); setError('');
    try {
      await towerService.create({ serialNumber: f.serialNumber, name: f.name, description: f.description || undefined, address: { street: f.street || undefined, city: f.city || undefined, zip: f.zip || undefined }, latitude: f.lat ? +f.lat : undefined, longitude: f.lng ? +f.lng : undefined });
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="Neuen Tower erstellen" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Seriennummer *</label><input required value={f.serialNumber} onChange={e => setF({ ...f, serialNumber: e.target.value })} className="input" placeholder="GT-2024-XXX" /></div>
          <div><label className="label">Name *</label><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="input" /></div>
        </div>
        <div><label className="label">Beschreibung</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className="input" rows={2} /></div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="label">Straße</label><input value={f.street} onChange={e => setF({ ...f, street: e.target.value })} className="input" /></div>
          <div><label className="label">Stadt</label><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} className="input" /></div>
          <div><label className="label">PLZ</label><input value={f.zip} onChange={e => setF({ ...f, zip: e.target.value })} className="input" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Breitengrad</label><input type="number" step="any" value={f.lat} onChange={e => setF({ ...f, lat: e.target.value })} className="input" /></div>
          <div><label className="label">Längengrad</label><input type="number" step="any" value={f.lng} onChange={e => setF({ ...f, lng: e.target.value })} className="input" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Erstelle...' : 'Erstellen'}</button></div>
      </form>
    </Modal>
  );
}
