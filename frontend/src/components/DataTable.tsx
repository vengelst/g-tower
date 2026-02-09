/**
 * DataTable – Generische, wiederverwendbare Tabellenkomponente mit Pagination.
 *
 * Zweck:
 *   Stellt beliebige Datensätze als HTML-Tabelle dar. Spalten werden deklarativ
 *   über ein Column-Array konfiguriert; optional können eigene Render-Funktionen
 *   pro Spalte übergeben werden.
 *
 * Rolle im Gesamtsystem:
 *   Wird überall dort eingesetzt, wo listenförmige Daten angezeigt werden
 *   (Tower-Liste, Ticket-Liste, Benutzer-Verwaltung, Dokumente usw.).
 *   Die Komponente kennt keine fachliche Logik – sie ist rein präsentational.
 *
 * Abhängigkeiten:
 *   - Keine externen Bibliotheken; nutzt ausschließlich React und Tailwind-CSS-Klassen.
 *
 * Wichtige Annahmen:
 *   - Die Pagination-Daten (total, page, limit, totalPages) kommen fertig vom
 *     Backend; die Komponente berechnet keine Seitenanzahl selbst.
 *   - Jedes Daten­objekt sollte eine eindeutige `id`-Eigenschaft besitzen, damit
 *     React stabile Keys erzeugen kann. Fehlt `id`, wird der Array-Index genutzt.
 *   - onRowClick ist optional; ist es gesetzt, erhalten Zeilen einen Pointer-Cursor.
 *
 * Änderungshinweise:
 *   - Sortierung ist aktuell nicht implementiert; bei Bedarf Column<T> um
 *     `sortable`-Flag erweitern und onSort-Callback ergänzen.
 *   - Für serverseitige Suche/Filter zusätzliche Props hinzufügen.
 */

/** Definition einer einzelnen Tabellenspalte. `render` erlaubt benutzerdefiniertes Rendering. */
interface Column<T> { key: string; header: string; render?: (item: T) => React.ReactNode; }

/** Props der DataTable. Generisch typisiert über den Daten­typ T. */
interface Props<T> {
  columns: Column<T>[]; data: T[]; isLoading?: boolean; emptyMessage?: string;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
  onPageChange?: (p: number) => void; onRowClick?: (item: T) => void;
}

export default function DataTable<T extends Record<string, any>>({ columns, data, isLoading, pagination, onPageChange, onRowClick, emptyMessage = 'Keine Daten' }: Props<T>) {
  /* Ladezustand: Spinner anzeigen, solange Daten vom Backend geladen werden. */
  if (isLoading) return <div className="card p-8 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /><span className="ml-3 text-gray-600">Laden...</span></div>;

  return (
    <div className="card overflow-hidden">
      {/* Horizontales Scrollen für schmale Viewports. */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{columns.map(c => <th key={c.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{c.header}</th>)}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0
              /* Leerzustand: Hinweistext über die gesamte Tabellenbreite. */
              ? <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">{emptyMessage}</td></tr>
              : data.map((item, i) => (
                /**
                 * Zeilen-Key: Bevorzugt item.id; Fallback auf den Array-Index.
                 * onRowClick wird per optionalem Chaining aufgerufen.
                 */
                <tr key={(item.id as string) || i} className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} onClick={() => onRowClick?.(item)}>
                  {columns.map(c => <td key={c.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>)}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {/* Pagination-Leiste: Wird nur angezeigt, wenn mehr als eine Seite existiert. */}
      {pagination && pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <span className="text-sm text-gray-700">Seite {pagination.page} von {pagination.totalPages} ({pagination.total} Einträge)</span>
          <div className="flex gap-2">
            {/* Zurück-Button deaktiviert auf Seite 1; Weiter-Button deaktiviert auf letzter Seite. */}
            <button onClick={() => onPageChange?.(pagination.page - 1)} disabled={pagination.page <= 1} className="btn btn-secondary text-sm">Zurück</button>
            <button onClick={() => onPageChange?.(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn btn-secondary text-sm">Weiter</button>
          </div>
        </div>
      )}
    </div>
  );
}
