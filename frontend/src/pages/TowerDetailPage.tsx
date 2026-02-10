/**
 * @module TowerDetailPage
 *
 * @description
 * Detailansicht eines einzelnen Towers mit Tab-basierter Navigation.
 * Zeigt Details, Status-Historie, zugehoerige Tickets, Dokumente und
 * die Lifecycle-Historie an. Ermoeglicht Aenderungen am operativen Status
 * und am Lifecycle-Status ueber jeweils eigene Modals.
 *
 * @role
 * Zentrale Informationsseite fuer einen einzelnen Tower. Wird ueber die
 * TowersPage oder die MapPage per Klick auf einen Tower erreicht.
 * Enthaelt die vollstaendige Verwaltung beider Status-Dimensionen:
 *
 *   1. **Operativer Status** (active/warning/critical/offline/maintenance/decommissioned)
 *      - Beschreibt den aktuellen Betriebszustand des Towers.
 *      - Kann frei zwischen allen Werten gewechselt werden (StatusModal).
 *
 *   2. **Lifecycle-Status** (production/delivery/storage/rented/return_delivery/
 *      repair/reconditioning/end_of_life/scrapped)
 *      - Beschreibt die aktuelle Phase im Lebenszyklus des Towers.
 *      - Uebergaenge sind durch eine State Machine im Backend eingeschraenkt.
 *      - "scrapped" ist der ENDZUSTAND – danach sind keine Aenderungen mehr moeglich.
 *      - Das LifecycleModal laedt die gueltigen Uebergaenge dynamisch vom Backend.
 *
 *   Beide Dimensionen sind UNABHAENGIG voneinander.
 *
 * @dependencies
 * - towerService       – Tower-Daten, Status-Aenderungen, Lifecycle-Transitions
 * - documentService    – Dokument-Downloads
 * - api                – Direkter API-Zugriff fuer Blob-Downloads (Status-Export)
 * - AuthContext         – Rollenbasierte Sichtbarkeit (hasMinRole)
 * - ToastContext        – Erfolgs-/Fehlermeldungen
 * - StatusBadge         – Farbige Badges fuer alle Status-Typen
 * - Modal               – Wiederverwendbarer Dialog
 *
 * @assumptions
 * - Die Tower-ID wird als URL-Parameter (:id) uebergeben.
 * - towerService.getById() liefert ein TowerWithHistory-Objekt inkl.
 *   Tickets, Dokumente und Lifecycle-Historie.
 * - Der Backend-Endpunkt fuer gueltige Lifecycle-Uebergaenge liefert ein
 *   Array mit erlaubten Zielzustaenden (leeres Array = Endzustand erreicht).
 * - Status-Historie kann als CSV/JSON exportiert werden (Blob-Download).
 *
 * @changelog
 * - Neue Tabs erfordern Erweiterung des Tab-Typs und der Tab-Navigation.
 * - Aenderungen an der Lifecycle-State-Machine im Backend wirken sich
 *   automatisch auf das LifecycleModal aus (dynamisches Laden).
 * - Neue operative Status-Werte muessen in StatusModal und statusDotColors ergaenzt werden.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { towerService } from '../services/towerService';
import { documentService } from '../services/documentService';
import { api } from '../services/api';
import type { TowerWithHistory, TowerStatus, TowerLifecycleStatus, TowerLifecycleHistory, TowerStatusHistory, HistorySource, ServiceTicket, Document as DocType, PaginatedResponse } from '../types';
import type { StatusHistoryParams } from '../services/towerService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

/** Verfuegbare Tabs in der Detailansicht */
type Tab = 'details' | 'history' | 'tickets' | 'documents' | 'lifecycle';

export default function TowerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tower, setTower] = useState<TowerWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Sichtbarkeit des Modals fuer operative Statusaenderung */
  const [showStatus, setShowStatus] = useState(false);
  /** Sichtbarkeit des Modals fuer Lifecycle-Statusaenderung */
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const { hasMinRole } = useAuth();
  const { showToast } = useToast();

  /** Laedt die vollstaendigen Tower-Daten inkl. History, Tickets und Dokumenten */
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
      {/* === Header: Name, Seriennummer, beide Status-Badges und Aktions-Buttons === */}
      <div className="flex items-center justify-between">
        <div><Link to="/towers" className="text-sm text-blue-600 hover:underline">&larr; Zurück</Link><h1 className="text-2xl font-bold text-gray-900 mt-1">{tower.name}</h1><p className="text-gray-500">{tower.serial_number}</p></div>
        <div className="flex items-center gap-3">
          {/* Beide Status-Dimensionen werden nebeneinander angezeigt */}
          <StatusBadge type="tower" value={tower.status} />
          <StatusBadge type="lifecycle" value={tower.lifecycle_status} />
          {/* Nur Operatoren und hoeher duerfen Status aendern */}
          {hasMinRole('operator') && <button type="button" onClick={() => setShowStatus(true)} className="btn btn-secondary text-sm">Status ändern</button>}
          {hasMinRole('operator') && <button type="button" onClick={() => setShowLifecycle(true)} className="btn btn-secondary text-sm">Lifecycle ändern</button>}
        </div>
      </div>

      {/* === Tab-Navigation === */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabBtn active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Details</TabBtn>
          <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>Status-Historie</TabBtn>
          <TabBtn active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')}>Tickets ({tower.tickets?.length ?? 0})</TabBtn>
          <TabBtn active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Dokumente ({tower.documents?.length ?? 0})</TabBtn>
          <TabBtn active={activeTab === 'lifecycle'} onClick={() => setActiveTab('lifecycle')}>Lifecycle</TabBtn>
        </nav>
      </div>

      {/* === Tab-Inhalte – nur der aktive Tab wird gerendert === */}
      {activeTab === 'details' && <DetailsTab tower={tower} />}
      {activeTab === 'history' && <StatusHistoryTab towerId={tower.id} towerSerial={tower.serial_number} />}
      {activeTab === 'tickets' && <TicketsTab tickets={tower.tickets ?? []} towerId={tower.id} reload={load} />}
      {activeTab === 'documents' && <DocumentsTab documents={tower.documents ?? []} towerId={tower.id} reload={load} />}
      {activeTab === 'lifecycle' && <LifecycleTab towerId={tower.id} initialHistory={tower.lifecycleHistory ?? []} />}

      {/* === Modale Dialoge fuer Statusaenderungen === */}
      {showStatus && <StatusModal current={tower.status} towerId={tower.id} onClose={() => setShowStatus(false)} onDone={() => { setShowStatus(false); showToast('Status geändert'); load(); }} />}
      {showLifecycle && <LifecycleModal currentStatus={tower.lifecycle_status} towerId={tower.id} onClose={() => setShowLifecycle(false)} onDone={() => { setShowLifecycle(false); showToast('Lifecycle-Status geändert'); load(); }} />}
    </div>
  );
}

/**
 * Hilfskomponente fuer die Tab-Navigation.
 * Markiert den aktiven Tab visuell mit einer blauen Unterstreichung.
 */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`py-4 px-1 border-b-2 font-medium text-sm ${active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
      {children}
    </button>
  );
}

/**
 * Details-Tab: Zeigt Standort-Informationen (Adresse, Koordinaten)
 * und allgemeine Tower-Informationen (Beschreibung, Inbetriebnahme, Erstelldatum).
 */
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
    </>
  );
}

/** Farbzuordnung fuer die Punkte in der operativen Status-Timeline */
const statusDotColors: Record<string, string> = {
  active: 'bg-green-500', maintenance: 'bg-yellow-500', offline: 'bg-red-500', decommissioned: 'bg-gray-500', warning: 'bg-orange-500', critical: 'bg-red-700',
};

/**
 * Status-Historie-Tab: Zeigt eine chronologische Timeline aller operativen
 * Statusaenderungen mit Filter-, Paginierungs- und Exportfunktion.
 *
 * Quick-Filter erlauben schnelles Ein-/Ausblenden nach Quelle (manuell/system)
 * und nach spezifischem Status. Datumsfilter grenzen den Zeitraum ein.
 * Export in CSV oder JSON laedt die Daten als Blob-Download herunter.
 */
function StatusHistoryTab({ towerId, towerSerial }: { towerId: string; towerSerial?: string }) {
  const [entries, setEntries] = useState<TowerStatusHistory[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Filter nach Aenderungsquelle: 'manual' | 'system' | '' (alle) */
  const [source, setSource] = useState<HistorySource | ''>('');
  /** Filter nach Ziel-Status */
  const [status, setStatus] = useState<TowerStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  /** Ausgewaehlter Eintrag fuer das Detail-Drawer (Audit-Detail) */
  const [selectedEntry, setSelectedEntry] = useState<TowerStatusHistory | null>(null);
  const limit = 50;

  /**
   * Laedt die Status-Historie mit den aktuellen Filterparametern.
   * Das "dateTo" bekommt T23:59:59 angehaengt, damit der gesamte Endtag
   * eingeschlossen wird (nicht nur bis 00:00:00 Uhr).
   */
  useEffect(() => {
    setLoading(true);
    setError('');
    const params: StatusHistoryParams = { page, limit };
    if (source) params.source = source;
    if (status) params.status = status;
    if (dateFrom) params.date_from = new Date(dateFrom).toISOString();
    if (dateTo) params.date_to = new Date(dateTo + 'T23:59:59').toISOString();

    towerService.getStatusHistory(towerId, params)
      .then(r => { setEntries(r.data); setPagination(r.pagination); })
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, [towerId, source, status, dateFrom, dateTo, page]);

  const resetFilters = () => { setSource(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const hasFilters = source || status || dateFrom || dateTo;

  /**
   * Startet einen Blob-Download der Status-Historie im gewuenschten Format.
   * Uebergibt die aktuellen Filterwerte als Query-Parameter, damit der
   * Export nur die gefilterten Daten enthaelt.
   */
  const downloadExport = (format: 'csv' | 'json') => {
    const q = new URLSearchParams({ format });
    if (source) q.set('source', source);
    if (status) q.set('status', status);
    if (dateFrom) q.set('date_from', new Date(dateFrom).toISOString());
    if (dateTo) q.set('date_to', new Date(dateTo + 'T23:59:59').toISOString());
    api.downloadBlob(`/towers/${towerId}/status-history/export?${q}`);
  };

  return (
    <div className="space-y-4">
      {/* === Quick-Filter und Datumsbereich === */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Quick-Filter:</span>
          {/* Toggle-Verhalten: erneuter Klick auf aktiven Filter setzt ihn zurueck */}
          <QuickFilter label="Nur manuell" active={source === 'manual'} onClick={() => { setSource(source === 'manual' ? '' : 'manual'); setPage(1); }} />
          <QuickFilter label="Nur System" active={source === 'system'} onClick={() => { setSource(source === 'system' ? '' : 'system'); setPage(1); }} />
          <QuickFilter label="Nur Offline" active={status === 'offline'} onClick={() => { setStatus(status === 'offline' ? '' : 'offline'); setPage(1); }} />
          <QuickFilter label="Nur Wartung" active={status === 'maintenance'} onClick={() => { setStatus(status === 'maintenance' ? '' : 'maintenance'); setPage(1); }} />
          <QuickFilter label="Nur Warnung" active={status === 'warning'} onClick={() => { setStatus(status === 'warning' ? '' : 'warning'); setPage(1); }} />
          <QuickFilter label="Nur Kritisch" active={status === 'critical'} onClick={() => { setStatus(status === 'critical' ? '' : 'critical'); setPage(1); }} />
          {/* Datumsbereichs-Filter */}
          <div className="ml-auto flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="input text-xs py-1 px-2 w-auto" />
            <span className="text-gray-400 text-xs">bis</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="input text-xs py-1 px-2 w-auto" />
          </div>
          {hasFilters && <button type="button" onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Zurücksetzen</button>}
          {/* Export-Buttons fuer CSV und JSON */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3 ml-1">
            <button type="button" onClick={() => downloadExport('csv')} className="btn btn-secondary text-xs px-2 py-1">CSV</button>
            <button type="button" onClick={() => downloadExport('json')} className="btn btn-secondary text-xs px-2 py-1">JSON</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : error ? (
        <div className="card p-6 text-center"><p className="text-red-600">{error}</p></div>
      ) : entries.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">{hasFilters ? 'Keine Einträge für diesen Filter' : 'Keine Statusänderungen vorhanden'}</div>
      ) : (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Status-Historie</h2>
            <span className="text-sm text-gray-500">{pagination.total} Einträge</span>
          </div>
          {/* Timeline-Darstellung mit vertikaler Linie und farbigen Status-Punkten */}
          <div className="relative">
            {/* Vertikale Timeline-Linie */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-2">
              {entries.map(e => (
                <button type="button" key={e.id} onClick={() => setSelectedEntry(e)} className="relative flex gap-4 pl-10 w-full text-left rounded-lg p-2 -ml-2 hover:bg-gray-50 transition-colors cursor-pointer">
                  {/* Farbiger Punkt auf der Timeline, Farbe entspricht dem neuen Status */}
                  <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ring-2 ring-white ${statusDotColors[e.new_status] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Pfeil von altem zu neuem Status; bei erstem Eintrag kein alter Status */}
                      {e.old_status && <><StatusBadge type="tower" value={e.old_status} /><span className="text-gray-400">&rarr;</span></>}
                      <StatusBadge type="tower" value={e.new_status} />
                      <span className="text-xs text-gray-400 ml-auto shrink-0" title={e.source === 'system' ? 'Systemänderung' : 'Manuelle Änderung'}>
                        {e.source === 'system' ? '\u2699\uFE0F System' : '\uD83D\uDC64 Manuell'}
                      </span>
                    </div>
                    {e.reason && <p className="text-sm text-gray-600 mt-1">{e.reason}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{new Date(e.changed_at).toLocaleString('de-DE')}</span>
                      {e.first_name && <span>{e.first_name} {e.last_name}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* Paginierung fuer die Status-Historie */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50">Zurück</button>
              <span className="text-sm text-gray-500">Seite {pagination.page} von {pagination.totalPages}</span>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50">Weiter</button>
            </div>
          )}
        </div>
      )}

      {/* Audit-Detail-Drawer: Zeigt alle Details eines ausgewaehlten Historie-Eintrags */}
      {selectedEntry && <HistoryDetailDrawer entry={selectedEntry} towerSerial={towerSerial} onClose={() => setSelectedEntry(null)} />}
    </div>
  );
}

/**
 * Slide-Over-Drawer fuer die Detailansicht eines einzelnen Status-Historie-Eintrags.
 * Zeigt Statusaenderung, Quelle, Benutzer und Zeitstempel im Audit-Format an.
 * Auf Desktop: Slide-Over von rechts. Auf Mobile: Bottom-Sheet.
 * Alle relevanten Werte koennen in die Zwischenablage kopiert werden.
 */
function HistoryDetailDrawer({ entry, towerSerial, onClose }: { entry: TowerStatusHistory; towerSerial?: string; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Kopiert einen Text in die Zwischenablage und zeigt fuer 2 Sekunden
   * ein visuelles Feedback (Haekchen-Icon statt Kopier-Icon).
   */
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(''), 2000);
    });
  }, []);

  /**
   * Event-Listener fuer Escape-Taste und Scroll-Sperre.
   * Der body-Overflow wird beim Oeffnen gesperrt und beim
   * Schliessen wiederhergestellt, um Hintergrund-Scrollen zu verhindern.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(copyTimeoutRef.current);
    };
  }, [onClose]);

  const dt = new Date(entry.changed_at);
  /** Lokale deutsche Zeitdarstellung */
  const localTime = dt.toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'medium' });
  /** UTC/ISO-8601-Format fuer technische Referenz */
  const utcTime = dt.toISOString();
  const userName = entry.first_name && entry.last_name ? `${entry.first_name} ${entry.last_name}` : null;

  /** Kleine Kopier-Schaltflaeche mit visuellem Feedback (Haekchen nach Kopieren) */
  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); copyToClipboard(text, label); }}
      className="ml-2 text-gray-400 hover:text-blue-600 transition-colors"
      title="Kopieren"
    >
      {copied === label ? (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* Halbtransparenter Overlay – Klick schliesst den Drawer */}
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

      {/* Desktop: slide-over from right. Mobile: sheet from bottom */}
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-white shadow-xl flex flex-col
                      max-sm:inset-y-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-h-[85vh] max-sm:rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Audit-Detail</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center py-2"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Sektion: Statusaenderung – alter Status -> neuer Status */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statusänderung</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {entry.old_status ? (
                  <>
                    <StatusBadge type="tower" value={entry.old_status} />
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    <StatusBadge type="tower" value={entry.new_status} />
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-400">Erstellt als</span>
                    <StatusBadge type="tower" value={entry.new_status} />
                  </>
                )}
              </div>
              <div>
                <dt className="text-xs text-gray-500">Grund</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{entry.reason || '\u2013'}</dd>
              </div>
              {towerSerial && (
                <div>
                  <dt className="text-xs text-gray-500">Tower-Seriennummer</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{towerSerial}</dd>
                </div>
              )}
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Sektion: Quelle (manuell/system) und Benutzerinformationen */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quelle & Benutzer</h4>
            <div className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Quelle</dt>
                <dd className="text-sm text-gray-900 mt-0.5 flex items-center gap-1.5">
                  {entry.source === 'system' ? (
                    <><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">System</span></>
                  ) : (
                    <><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Manuell</span></>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Benutzer</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{userName || '\u2013'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">E-Mail</dt>
                <dd className="text-sm text-gray-900 mt-0.5 flex items-center">
                  {entry.changed_by_email ? (
                    <>
                      <span>{entry.changed_by_email}</span>
                      <CopyBtn text={entry.changed_by_email} label="email" />
                    </>
                  ) : '\u2013'}
                </dd>
              </div>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Sektion: Zeitstempel in lokaler und UTC-Darstellung */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Zeit</h4>
            <div className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Lokal (de-DE)</dt>
                <dd className="text-sm text-gray-900 mt-0.5 flex items-center">
                  <span>{localTime}</span>
                  <CopyBtn text={localTime} label="local" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">UTC / ISO 8601</dt>
                <dd className="text-sm text-gray-900 mt-0.5 flex items-center">
                  <span className="font-mono text-xs">{utcTime}</span>
                  <CopyBtn text={utcTime} label="utc" />
                </dd>
              </div>
            </div>
          </section>

          {/* Eindeutige Eintrags-ID fuer Audit-Referenzzwecke */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center text-xs text-gray-400">
              <span>ID: {entry.id}</span>
              <CopyBtn text={entry.id} label="id" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Toggle-Button fuer Quick-Filter in der Status-Historie.
 * Aktiver Zustand wird visuell durch blaue Hintergrundfarbe hervorgehoben.
 */
function QuickFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`text-xs px-3 py-1 rounded-full border transition-colors ${active ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

/**
 * Tickets-Tab: Zeigt die dem Tower zugeordneten Service-Tickets.
 * Jedes Ticket wird mit Ticketnummer, Status-Badge, Prioritaets-Badge,
 * Titel, Erstelldatum und ggf. zugewiesenem Benutzer angezeigt.
 * Link zu allen Tickets des Towers ueber die TicketsPage.
 */
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

/**
 * Dokumente-Tab: Zeigt die dem Tower zugeordneten Dokumente.
 * Jedes Dokument wird mit Titel (oder Dateiname), Typ, Version und
 * Erstelldatum angezeigt. Download-Funktion ueber den documentService.
 */
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
              <button type="button" onClick={() => download(doc.id)} className="text-blue-600 hover:underline text-sm">Download</button>
            </div>
          ))}
        </div>}
    </div>
  );
}

/**
 * Hilfskomponente fuer Definition-List-Eintraege (Label + Wert).
 * Zeigt einen Bindestrich als Fallback, wenn kein Wert vorhanden ist.
 */
function D({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex"><dt className="w-36 text-sm text-gray-500 shrink-0">{label}</dt><dd className="text-sm text-gray-900">{value || '-'}</dd></div>;
}

/**
 * Modal zum Aendern des OPERATIVEN Status eines Towers.
 * Alle sechs operativen Status-Werte stehen zur Auswahl.
 * Ein optionaler Grund kann angegeben werden (wird in der Historie gespeichert).
 * Wenn der gleiche Status wie aktuell gewaehlt wird, schliesst das Modal
 * ohne API-Aufruf (Short-Circuit).
 */
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
        <div><label className="label">Neuer Status</label><select value={status} onChange={e => setStatus(e.target.value as TowerStatus)} className="input"><option value="active">Aktiv</option><option value="offline">Offline</option><option value="maintenance">Wartung</option><option value="decommissioned">Stillgelegt</option><option value="warning">Warnung</option><option value="critical">Kritisch</option></select></div>
        <div><label className="label">Grund</label><textarea value={reason} onChange={e => setReason(e.target.value)} className="input" rows={3} /></div>
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button><button type="submit" disabled={sub} className="btn btn-primary">{sub ? 'Speichere...' : 'Speichern'}</button></div>
      </form>
    </Modal>
  );
}

/** Farbzuordnung fuer die Punkte in der Lifecycle-Timeline */
const lifecycleDotColors: Record<string, string> = {
  production: 'bg-blue-500', delivery: 'bg-indigo-500', storage: 'bg-gray-500', rented: 'bg-green-500',
  return_delivery: 'bg-yellow-500', repair: 'bg-orange-500', reconditioning: 'bg-purple-500',
  end_of_life: 'bg-red-500', scrapped: 'bg-gray-400',
};

/**
 * Lifecycle-Tab: Zeigt eine chronologische Timeline aller Lifecycle-Statusaenderungen.
 * Die Lifecycle-Dimension ist UNABHAENGIG vom operativen Status.
 *
 * Lifecycle-Zustaende: production -> delivery -> storage -> rented ->
 * return_delivery -> repair -> reconditioning -> end_of_life -> scrapped
 *
 * Hinweis: "scrapped" ist der ENDZUSTAND – danach sind keine Aenderungen mehr moeglich.
 * Die gueltigen Uebergaenge werden durch eine State Machine im Backend definiert.
 */
function LifecycleTab({ towerId, initialHistory }: { towerId: string; initialHistory: TowerLifecycleHistory[] }) {
  const [entries, setEntries] = useState<TowerLifecycleHistory[]>(initialHistory);
  const [pagination, setPagination] = useState({ total: initialHistory.length, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  /** Laedt die Lifecycle-Historie paginiert vom Backend */
  useEffect(() => {
    setLoading(true);
    towerService.getLifecycleHistory(towerId, { page, limit })
      .then(r => { setEntries(r.data); setPagination(r.pagination); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [towerId, page]);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (entries.length === 0) return <div className="card p-12 text-center text-gray-500">Keine Lifecycle-Änderungen vorhanden</div>;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Lifecycle-Historie</h2>
        <span className="text-sm text-gray-500">{pagination.total} Einträge</span>
      </div>
      {/* Timeline-Darstellung analog zur Status-Historie, aber mit Lifecycle-Farben */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="relative flex gap-4 pl-10 p-2 -ml-2">
              <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ring-2 ring-white ${lifecycleDotColors[e.new_status] || 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.old_status && <><StatusBadge type="lifecycle" value={e.old_status} /><span className="text-gray-400">&rarr;</span></>}
                  <StatusBadge type="lifecycle" value={e.new_status} />
                  <span className="text-xs text-gray-400 ml-auto shrink-0">
                    {e.source === 'system' ? '\u2699\uFE0F System' : '\uD83D\uDC64 Manuell'}
                  </span>
                </div>
                {e.reason && <p className="text-sm text-gray-600 mt-1">{e.reason}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{new Date(e.changed_at).toLocaleString('de-DE')}</span>
                  {e.first_name && <span>{e.first_name} {e.last_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50">Zurück</button>
          <span className="text-sm text-gray-500">Seite {pagination.page} von {pagination.totalPages}</span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50">Weiter</button>
        </div>
      )}
    </div>
  );
}

/** Deutsche Bezeichnungen fuer die Lifecycle-Status-Werte */
const lifecycleLabels: Record<string, string> = {
  production: 'Produktion', delivery: 'Auslieferung', storage: 'Lager', rented: 'Vermietet',
  return_delivery: 'Rücklieferung', repair: 'Reparatur', reconditioning: 'Aufbereitung',
  end_of_life: 'End of Life', scrapped: 'Verschrottet',
};

/**
 * Modal zum Aendern des LIFECYCLE-Status eines Towers.
 *
 * WICHTIG: Anders als beim operativen Status werden hier NUR GUELTIGE
 * UEBERGAENGE angezeigt. Diese werden dynamisch vom Backend geladen
 * (towerService.getValidLifecycleTransitions), da eine State Machine
 * im Backend die erlaubten Zustandswechsel definiert.
 *
 * Wenn das Backend ein leeres Transitions-Array liefert, ist der
 * ENDZUSTAND erreicht (z.B. "scrapped") und es wird ein entsprechender
 * Hinweis angezeigt. In diesem Fall ist keine Aenderung mehr moeglich.
 */
function LifecycleModal({ currentStatus, towerId, onClose, onDone }: { currentStatus: TowerLifecycleStatus; towerId: string; onClose: () => void; onDone: () => void }) {
  /** Liste der gueltigen Zielzustaende (vom Backend geladen) */
  const [allowed, setAllowed] = useState<TowerLifecycleStatus[]>([]);
  const [status, setStatus] = useState<TowerLifecycleStatus | ''>('');
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState(false);
  const [error, setError] = useState('');
  const [loadingTransitions, setLoadingTransitions] = useState(true);

  /**
   * Laedt die gueltigen Lifecycle-Uebergaenge vom Backend beim Oeffnen des Modals.
   * Der erste gueltige Uebergang wird als Vorauswahl gesetzt.
   */
  useEffect(() => {
    towerService.getValidLifecycleTransitions(towerId)
      .then(r => { setAllowed(r.transitions); if (r.transitions.length) setStatus(r.transitions[0]); })
      .catch(err => setError(err instanceof Error ? err.message : 'Fehler'))
      .finally(() => setLoadingTransitions(false));
  }, [towerId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;
    setSub(true); setError('');
    try { await towerService.updateLifecycleStatus(towerId, status, reason); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); } finally { setSub(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Lifecycle-Status ändern">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label">Aktueller Status</label>
          <div className="mt-1"><StatusBadge type="lifecycle" value={currentStatus} /></div>
        </div>
        {loadingTransitions ? (
          <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
        ) : allowed.length === 0 ? (
          /* Endzustand erreicht (z.B. "scrapped") – keine weiteren Uebergaenge moeglich */
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">Keine weiteren Übergänge möglich (Endstatus erreicht).</div>
        ) : (
          <>
            <div>
              <label className="label">Neuer Status</label>
              {/* Nur die vom Backend als gueltig markierten Uebergaenge werden angeboten */}
              <select value={status} onChange={e => setStatus(e.target.value as TowerLifecycleStatus)} className="input">
                {allowed.map(s => <option key={s} value={s}>{lifecycleLabels[s] || s}</option>)}
              </select>
            </div>
            <div><label className="label">Grund</label><textarea value={reason} onChange={e => setReason(e.target.value)} className="input" rows={3} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
              <button type="submit" disabled={sub || !status} className="btn btn-primary">{sub ? 'Speichere...' : 'Speichern'}</button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
