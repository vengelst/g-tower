import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { towerService } from '../services/towerService';
import { ticketService } from '../services/ticketService';
import type { TowerStats, TicketStats } from '../types';

export default function DashboardPage() {
  const [ts, setTs] = useState<TowerStats | null>(null);
  const [ks, setKs] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([towerService.getStats(), ticketService.getStats()])
      .then(([t, k]) => { setTs(t); setKs(k); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Tower-Übersicht</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Gesamt" value={ts?.total || 0} cls="bg-blue-50 text-blue-700 border-blue-200" link="/towers" />
          <Stat label="Aktiv" value={ts?.byStatus?.active || 0} cls="bg-green-50 text-green-700 border-green-200" link="/towers?status=active" />
          <Stat label="Offline" value={ts?.byStatus?.offline || 0} cls="bg-red-50 text-red-700 border-red-200" link="/towers?status=offline" />
          <Stat label="Wartung" value={ts?.byStatus?.maintenance || 0} cls="bg-yellow-50 text-yellow-700 border-yellow-200" link="/towers?status=maintenance" />
          <Stat label="Stillgelegt" value={ts?.byStatus?.decommissioned || 0} cls="bg-gray-50 text-gray-700 border-gray-200" />
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Service-Tickets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Gesamt" value={ks?.total || 0} cls="bg-blue-50 text-blue-700 border-blue-200" link="/tickets" />
          <Stat label="Offen" value={ks?.byStatus?.open || 0} cls="bg-blue-50 text-blue-700 border-blue-200" />
          <Stat label="In Bearbeitung" value={ks?.byStatus?.in_progress || 0} cls="bg-yellow-50 text-yellow-700 border-yellow-200" />
          <Stat label="Gelöst" value={ks?.byStatus?.resolved || 0} cls="bg-green-50 text-green-700 border-green-200" />
          <Stat label="Geschlossen" value={ks?.byStatus?.closed || 0} cls="bg-gray-50 text-gray-700 border-gray-200" />
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Nach Priorität</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Stat label="Kritisch" value={ks?.byPriority?.critical || 0} cls="bg-red-50 text-red-700 border-red-200" />
          <Stat label="Hoch" value={ks?.byPriority?.high || 0} cls="bg-orange-50 text-orange-700 border-orange-200" />
          <Stat label="Mittel" value={ks?.byPriority?.medium || 0} cls="bg-blue-50 text-blue-700 border-blue-200" />
          <Stat label="Niedrig" value={ks?.byPriority?.low || 0} cls="bg-gray-50 text-gray-700 border-gray-200" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls, link }: { label: string; value: number; cls: string; link?: string }) {
  const inner = <div className={`card p-4 border ${cls}`}><p className="text-sm font-medium opacity-75">{label}</p><p className="text-3xl font-bold mt-1">{value}</p></div>;
  return link ? <Link to={link} className="block hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}
