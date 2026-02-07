interface Column<T> { key: string; header: string; render?: (item: T) => React.ReactNode; }

interface Props<T> {
  columns: Column<T>[]; data: T[]; isLoading?: boolean; emptyMessage?: string;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
  onPageChange?: (p: number) => void; onRowClick?: (item: T) => void;
}

export default function DataTable<T extends Record<string, any>>({ columns, data, isLoading, pagination, onPageChange, onRowClick, emptyMessage = 'Keine Daten' }: Props<T>) {
  if (isLoading) return <div className="card p-8 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /><span className="ml-3 text-gray-600">Laden...</span></div>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{columns.map(c => <th key={c.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{c.header}</th>)}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0
              ? <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">{emptyMessage}</td></tr>
              : data.map((item, i) => (
                <tr key={(item.id as string) || i} className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} onClick={() => onRowClick?.(item)}>
                  {columns.map(c => <td key={c.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>)}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <span className="text-sm text-gray-700">Seite {pagination.page} von {pagination.totalPages} ({pagination.total} Einträge)</span>
          <div className="flex gap-2">
            <button onClick={() => onPageChange?.(pagination.page - 1)} disabled={pagination.page <= 1} className="btn btn-secondary text-sm">Zurück</button>
            <button onClick={() => onPageChange?.(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn btn-secondary text-sm">Weiter</button>
          </div>
        </div>
      )}
    </div>
  );
}
