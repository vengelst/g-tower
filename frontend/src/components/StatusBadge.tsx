const colors: Record<string, Record<string, string>> = {
  tower: { active: 'bg-green-100 text-green-800', offline: 'bg-red-100 text-red-800', maintenance: 'bg-yellow-100 text-yellow-800', decommissioned: 'bg-gray-100 text-gray-800' },
  ticket: { open: 'bg-blue-100 text-blue-800', in_progress: 'bg-yellow-100 text-yellow-800', pending: 'bg-orange-100 text-orange-800', resolved: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800' },
  priority: { low: 'bg-gray-100 text-gray-800', medium: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' },
};

const labels: Record<string, Record<string, string>> = {
  tower: { active: 'Aktiv', offline: 'Offline', maintenance: 'Wartung', decommissioned: 'Stillgelegt' },
  ticket: { open: 'Offen', in_progress: 'In Bearbeitung', pending: 'Wartend', resolved: 'Gelöst', closed: 'Geschlossen' },
  priority: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' },
};

export default function StatusBadge({ type, value }: { type: 'tower' | 'ticket' | 'priority'; value: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]?.[value] || 'bg-gray-100 text-gray-800'}`}>{labels[type]?.[value] || value}</span>;
}
