/**
 * @module ToastContext
 *
 * @description
 * Globaler Toast-Notification-Context für die gesamte Anwendung.
 * Stellt eine `showToast()`-Funktion bereit, mit der von überall her
 * kurze Benachrichtigungen (Success, Error, Info) angezeigt werden können.
 *
 * @rolle_im_system
 * Wird als Provider in der App-Wurzel eingebunden. Komponenten und Hooks
 * (z. B. nach API-Calls via `useApi`) nutzen `useToast()`, um dem Nutzer
 * Feedback über Erfolg oder Fehler einer Aktion zu geben. Die Toasts
 * erscheinen als überlagernde Benachrichtigungen oben rechts im Viewport.
 *
 * @abhaengigkeiten
 * - Keine externen Abhängigkeiten außer React.
 * - Tailwind-CSS-Klassen für Styling und Positionierung.
 * - Die CSS-Animation `animate-slide-in` muss in der Tailwind-Config
 *   oder in einer globalen CSS-Datei definiert sein.
 *
 * @wichtige_annahmen
 * - Toasts verschwinden automatisch nach 4 Sekunden (setTimeout).
 * - Es gibt keinen manuellen Dismiss-Button – Toasts sind rein zeitgesteuert.
 * - Die `nextId`-Variable ist modulweit (außerhalb der Komponente), damit
 *   IDs über die gesamte Lebensdauer der App eindeutig bleiben.
 * - Toast-Typen: 'success' (grün), 'error' (rot), 'info' (blau).
 *   Der Typ 'warning' ist aktuell in der Typdefinition nicht enthalten.
 *
 * @aenderungshinweise
 * - Um einen 'warning'-Typ hinzuzufügen, muss `ToastType` erweitert und
 *   die Farbzuordnung im JSX ergänzt werden.
 * - Falls Toasts manuell schließbar sein sollen, muss ein Dismiss-Handler
 *   und ein Close-Button pro Toast ergänzt werden.
 * - Die Auto-Dismiss-Zeit (4000ms) kann bei Bedarf konfigurierbar gemacht werden.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** Unterstützte Toast-Varianten mit jeweiliger Farbcodierung. */
type ToastType = 'success' | 'error' | 'info';

/** Datenstruktur eines einzelnen Toast-Elements. */
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/** Öffentliche Schnittstelle des Toast-Contexts für Consumer. */
interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Modulweiter ID-Zähler für Toasts. Liegt außerhalb der Komponente,
 * damit die IDs über Re-Renders und sogar über Provider-Remounts hinweg
 * streng monoton steigen und somit eindeutig bleiben.
 */
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Erzeugt einen neuen Toast und fügt ihn zur Liste hinzu.
   * Nach 4 Sekunden wird der Toast automatisch per setTimeout entfernt.
   * useCallback stellt sicher, dass die Referenz stabil bleibt und
   * abhängige Komponenten nicht unnötig neu rendern.
   */
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    /** Automatisches Entfernen nach 4 Sekunden via ID-Filter. */
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast-Container: Fixiert oben rechts, über allem anderen (z-50). */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white min-w-[280px] animate-slide-in ${
              toast.type === 'success' ? 'bg-green-600' :
              toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Convenience-Hook für den Zugriff auf den Toast-Context.
 * Wirft einen Fehler, falls außerhalb des ToastProviders verwendet –
 * so werden fehlende Provider frühzeitig erkannt.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
