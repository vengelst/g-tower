/**
 * StatusBadge – Farbige Status-Anzeige als Pill-Badge.
 *
 * Zweck:
 *   Zeigt einen Status-Wert als farbig hinterlegtes Badge (Pill) an.
 *   Die Farbe und der deutsche Anzeigename werden anhand von Typ und Wert
 *   aus Lookup-Tabellen ermittelt.
 *
 * Rolle im Gesamtsystem:
 *   Wird in Tabellen, Detail-Ansichten und Karten verwendet, um den Status
 *   von Towers, Tickets und Lifecycle-Phasen visuell hervorzuheben.
 *
 * Abhängigkeiten:
 *   - Keine externen Abhängigkeiten; rein präsentational mit Tailwind-CSS.
 *
 * Wichtige Annahmen:
 *   - Es gibt DREI unabhängige Status-Dimensionen (plus Priorität):
 *       1. tower   – Operativer Status: Beschreibt den aktuellen Betriebszustand
 *                    (active=grün, warning=gelb/orange, critical=rot, offline=rot,
 *                     maintenance=gelb, decommissioned=grau).
 *       2. ticket  – Ticket-Status: Fortschritt eines Service-Tickets
 *                    (open, in_progress, pending, resolved, closed).
 *          priority – Ticket-Priorität: Dringlichkeit eines Tickets
 *                    (low, medium, high, critical).
 *       3. lifecycle – Lifecycle-Status: Position im Lebenszyklus eines Towers
 *                    (production=blau, delivery, storage, rented=grün,
 *                     return_delivery, repair=orange, reconditioning,
 *                     end_of_life, scrapped=dunkelgrau).
 *
 *   - WICHTIG: Operativer Status (tower) und Lifecycle-Status (lifecycle) sind
 *     zwei UNABHÄNGIGE Dimensionen. Ein Tower kann z. B. gleichzeitig
 *     operativ „active" und im Lifecycle „rented" sein.
 *
 *   - Unbekannte Typ/Wert-Kombinationen erhalten einen grauen Fallback-Stil
 *     und zeigen den Roh-Wert als Label an.
 *
 * Änderungshinweise:
 *   - Neue Status-Werte werden einfach in die `colors`- und `labels`-Objekte
 *     eingetragen; die Komponente selbst muss nicht angepasst werden.
 *   - Bei neuen Typen (z. B. 'component') den Union-Type in den Props erweitern
 *     und die Lookup-Tabellen ergänzen.
 */

/**
 * Farb-Mapping: Ordnet jedem Typ und Wert die passenden Tailwind-CSS-Klassen
 * für Hintergrund- und Textfarbe zu.
 */
const colors: Record<string, Record<string, string>> = {
  /* Tower – Operativer Status (Betriebszustand) */
  tower: { active: 'bg-green-100 text-green-800', offline: 'bg-red-100 text-red-800', maintenance: 'bg-yellow-100 text-yellow-800', decommissioned: 'bg-gray-100 text-gray-800', warning: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-900' },
  /* Ticket – Bearbeitungsstatus */
  ticket: { open: 'bg-blue-100 text-blue-800', in_progress: 'bg-yellow-100 text-yellow-800', pending: 'bg-orange-100 text-orange-800', resolved: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800' },
  /* Priorität – Dringlichkeitsstufe eines Tickets */
  priority: { low: 'bg-gray-100 text-gray-800', medium: 'bg-blue-100 text-blue-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' },
  /* Lifecycle – Lebenszyklusphase eines Towers (unabhängig vom operativen Status) */
  lifecycle: { production: 'bg-blue-100 text-blue-800', delivery: 'bg-indigo-100 text-indigo-800', storage: 'bg-gray-100 text-gray-800', rented: 'bg-green-100 text-green-800', return_delivery: 'bg-yellow-100 text-yellow-800', repair: 'bg-orange-100 text-orange-800', reconditioning: 'bg-purple-100 text-purple-800', end_of_life: 'bg-red-100 text-red-800', scrapped: 'bg-gray-200 text-gray-600' },
};

/**
 * Label-Mapping: Deutsche Anzeigenamen für jeden Typ und Wert.
 * Werden im Badge als lesbarer Text dargestellt.
 */
const labels: Record<string, Record<string, string>> = {
  tower: { active: 'Aktiv', offline: 'Offline', maintenance: 'Wartung', decommissioned: 'Stillgelegt', warning: 'Warnung', critical: 'Kritisch' },
  ticket: { open: 'Offen', in_progress: 'In Bearbeitung', pending: 'Wartend', resolved: 'Gelöst', closed: 'Geschlossen' },
  priority: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' },
  lifecycle: { production: 'Produktion', delivery: 'Auslieferung', storage: 'Lager', rented: 'Vermietet', return_delivery: 'Rücklieferung', repair: 'Reparatur', reconditioning: 'Aufbereitung', end_of_life: 'End of Life', scrapped: 'Verschrottet' },
};

/**
 * StatusBadge-Komponente.
 *
 * @param type  – Art des Status ('tower' | 'ticket' | 'priority' | 'lifecycle').
 * @param value – Konkreter Status-Wert (z. B. 'active', 'open', 'rented').
 *
 * Fallback: Unbekannte Kombinationen erhalten graue Standardfarben und den
 *           Roh-String als Anzeigename.
 */
export default function StatusBadge({ type, value }: { type: 'tower' | 'ticket' | 'priority' | 'lifecycle'; value: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]?.[value] || 'bg-gray-100 text-gray-800'}`}>{labels[type]?.[value] || value}</span>;
}
