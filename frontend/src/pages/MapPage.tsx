/**
 * @module MapPage
 *
 * @description
 * Kartenansicht aller Towers auf einer interaktiven Leaflet-Karte.
 * Jeder Tower wird als farbiger Marker angezeigt, dessen Farbe dem
 * operativen Status entspricht. Ein Klick auf einen Marker oeffnet
 * ein Popup mit Basisinformationen und einem Link zur Detailseite.
 *
 * @role
 * Geographische Visualisierung der Tower-Standorte. Ermoeglicht dem
 * Benutzer, auf einen Blick zu sehen, wo sich welche Towers befinden
 * und in welchem operativen Zustand sie sind.
 *
 * @dependencies
 * - react-leaflet (MapContainer, TileLayer, Marker, Popup, useMap)
 * - leaflet (Icon) – fuer benutzerdefinierte SVG-Marker-Icons
 * - towerService.getAll({ mode: 'map' }) – laedt alle Towers im Map-Modus
 * - StatusBadge – farbige Status-Anzeige im Popup
 * - OpenStreetMap Tile-Server – Kartenkacheln
 *
 * @assumptions
 * - Towers ohne Koordinaten (latitude/longitude === null) werden herausgefiltert
 *   und erscheinen nicht auf der Karte.
 * - Der Map-Modus im towerService liefert ALLE Towers ohne Paginierung.
 * - Das Kartenzentrum wird als Durchschnitt aller Tower-Koordinaten berechnet.
 *   Fallback: Geografischer Mittelpunkt Deutschlands (51.1657, 10.4515).
 * - Leaflet CSS muss global eingebunden sein (z.B. in index.html oder main.tsx).
 *
 * @changelog
 * - Neue operative Status-Werte erfordern Ergaenzung in statusColors und in der Legende.
 * - Bei Aenderung des Marker-Designs die createIcon-Funktion anpassen.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { towerService } from '../services/towerService';
import type { Tower, TowerStatus } from '../types';
import StatusBadge from '../components/StatusBadge';

/** Zuordnung von operativem Status zu Hex-Farbe fuer die Marker-SVGs */
const statusColors: Record<TowerStatus, string> = {
  active: '#10b981',
  maintenance: '#f59e0b',
  offline: '#ef4444',
  decommissioned: '#6b7280',
  warning: '#f97316',
  critical: '#b91c1c',
};

/**
 * Erzeugt ein Leaflet-Icon als Base64-kodiertes SVG.
 * Die Farbe des Markers wird durch den operativen Tower-Status bestimmt.
 * Das SVG ist ein Pin-Marker mit weissem Kreis in der Mitte.
 */
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

/**
 * Workaround-Komponente fuer ein bekanntes Leaflet-Problem:
 * Wenn die Karte in einem Container gerendert wird, dessen Groesse sich
 * nach dem initialen Rendern aendert (z.B. durch CSS-Transitionen oder
 * Flexbox-Layout), werden die Kacheln nicht korrekt geladen.
 * invalidateSize() im naechsten Tick behebt dieses Problem.
 */
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
        /**
         * Filtern: Nur Towers mit gesetzten Koordinaten anzeigen.
         * Typsichere Konvertierung zu Number, da die API-Werte
         * als String oder Number zurueckkommen koennen.
         */
        .filter(t => t.latitude != null && t.longitude != null)
        .map(t => ({ ...t, latitude: Number(t.latitude), longitude: Number(t.longitude) }))))
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="text-center py-12"><p className="text-red-600">{error}</p></div>;

  /**
   * Kartenmittelpunkt: Durchschnitt aller Tower-Koordinaten.
   * Fallback auf den geografischen Mittelpunkt Deutschlands,
   * wenn keine Towers mit Koordinaten vorhanden sind.
   */
  const center: [number, number] = towers.length > 0
    ? [towers.reduce((s, t) => s + t.latitude!, 0) / towers.length, towers.reduce((s, t) => s + t.longitude!, 0) / towers.length]
    : [51.1657, 10.4515];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tower-Karte</h1>
        {/* Legende: Farbzuordnung der Marker zu den operativen Status-Werten */}
        <div className="flex items-center gap-4 text-sm">
          <Legend color="bg-green-500" label="Aktiv" />
          <Legend color="bg-yellow-500" label="Wartung" />
          <Legend color="bg-red-500" label="Offline" />
          <Legend color="bg-gray-500" label="Stillgelegt" />
          <Legend color="bg-orange-500" label="Warnung" />
          <Legend color="bg-red-700" label="Kritisch" />
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
                {/* Popup mit Tower-Basisinformationen und Link zur Detailseite */}
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

/** Legenden-Element: Farbiger Punkt mit Beschriftung */
function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-full ${color}`} /><span>{label}</span></div>;
}
