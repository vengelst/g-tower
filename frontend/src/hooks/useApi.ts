/**
 * @module useApi (useApiAction)
 *
 * @description
 * Generischer Custom Hook für die Ausführung einzelner API-Aktionen
 * mit automatischem Loading- und Error-State-Management.
 * Kapselt das wiederkehrende Muster: Loading setzen -> API aufrufen ->
 * Ergebnis/Fehler verarbeiten -> Loading zurücksetzen.
 *
 * @rolle_im_system
 * Wird in Komponenten und Seiten verwendet, um beliebige API-Calls
 * (POST, PUT, DELETE etc.) auszuführen, ohne den Loading-/Error-Zustand
 * manuell verwalten zu müssen. Typischerweise in Kombination mit dem
 * `api`-Service und dem `useToast()`-Hook für Nutzerfeedback eingesetzt.
 *
 * @abhaengigkeiten
 * - Keine externen Abhängigkeiten außer React (useState, useCallback).
 * - Der übergebene `apiCall` ist eine beliebige async Funktion –
 *   typischerweise ein Aufruf an die zentrale `api`-Instanz aus `../services/api`.
 *
 * @wichtige_annahmen
 * - Der Hook verwaltet nur den Zustand EINER Aktion gleichzeitig.
 *   Bei gleichzeitigem Aufruf mehrerer `execute()`-Calls können sich
 *   Loading- und Error-States überschreiben.
 * - Fehler werden nach dem Setzen des Error-States erneut geworfen (throw err),
 *   damit die aufrufende Komponente sie ggf. individuell behandeln kann
 *   (z. B. für Toast-Benachrichtigungen oder Formular-Validierung).
 * - Die Fehlermeldung fällt auf den generischen String 'Fehler' zurück,
 *   falls der Fehler keine Error-Instanz ist.
 *
 * @aenderungshinweise
 * - Falls parallele API-Calls unterstützt werden sollen, müsste der Hook
 *   erweitert werden (z. B. mit einer Map von Request-IDs).
 * - Bei Bedarf kann ein `reset()`-Methode ergänzt werden, um den
 *   Error-State manuell zurückzusetzen.
 */

import { useState, useCallback } from 'react';

export function useApiAction() {
  /** Gibt an, ob gerade ein API-Call läuft. */
  const [isLoading, setIsLoading] = useState(false);
  /** Enthält die Fehlermeldung des letzten fehlgeschlagenen Calls, oder null. */
  const [error, setError] = useState<string | null>(null);

  /**
   * Führt den übergebenen API-Call aus und verwaltet dabei automatisch
   * Loading- und Error-State. Der Typ-Parameter <T> ermöglicht volle
   * Typsicherheit für den Rückgabewert des API-Calls.
   *
   * Ablauf:
   * 1. Loading aktivieren, vorherigen Fehler zurücksetzen.
   * 2. API-Call ausführen und Ergebnis zurückgeben.
   * 3. Bei Fehler: Fehlermeldung im State speichern UND Fehler erneut werfen,
   *    damit der Aufrufer ihn ggf. in einem try/catch behandeln kann.
   * 4. In jedem Fall: Loading deaktivieren.
   */
  const execute = useCallback(async <T>(apiCall: () => Promise<T>) => {
    setIsLoading(true); setError(null);
    try { const r = await apiCall(); setIsLoading(false); return r; }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); setIsLoading(false); throw err; }
  }, []);

  return { isLoading, error, execute };
}
