import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { towerService } from '../services/towerService';
import type { Tower, TowerStatus } from '../types';
import StatusBadge from '../components/StatusBadge';

const statusColors: Record<TowerStatus, string> = {
  active: '#10b981',
  maintenance: '#f59e0b',
  offline: '#ef4444',
  decommissioned: '#6b7280',
};

function createIcon(status: TowerStatus): Icon {
  const color = statusColors[status];
  const svg = `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>`;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

function FixLeafletResize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => { map.invalidateSize(); }, 0);
  }, [map]);
  return null;
}

export default function MapPage() {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    towerService.getAll({ mode: 'map' })
      .then(r => setTowers(r.data
        .filter(t => t.latitude != null && t.longitude != null)
        .map(t => ({ ...t, latitude: Number(t.latitude), longitude: Number(t.longitude) }))))
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="text-center py-12"><p className="text-red-600">{error}</p></div>;

  const center: [number, number] = towers.length > 0
    ? [towers.reduce((s, t) => s + t.latitude!, 0) / towers.length, towers.reduce((s, t) => s + t.longitude!, 0) / towers.length]
    : [51.1657, 10.4515];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tower-Karte</h1>
        <div className="flex items-center gap-4 text-sm">
          <Legend color="bg-green-500" label="Aktiv" />
          <Legend color="bg-yellow-500" label="Wartung" />
          <Legend color="bg-red-500" label="Offline" />
          <Legend color="bg-gray-500" label="Stillgelegt" />
        </div>
      </div>

      {towers.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">Keine Towers mit Koordinaten vorhanden</div>
      ) : (
        <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}>
          <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <FixLeafletResize />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {towers.map(t => (
              <Marker key={t.id} position={[t.latitude!, t.longitude!]} icon={createIcon(t.status)}>
                <Popup>
                  <div className="p-1">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{t.serial_number}</p>
                    <StatusBadge type="tower" value={t.status} />
                    <div className="mt-2">
                      <Link to={`/towers/${t.id}`} className="text-sm text-blue-600 hover:underline">Details &rarr;</Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-full ${color}`} /><span>{label}</span></div>;
}
