/**
 * Modal – Generische Dialog-Overlay-Komponente.
 *
 * Zweck:
 *   Zeigt einen zentrierten Dialog über dem restlichen Seiteninhalt an.
 *   Unterstützt drei Größen (sm, md, lg), einen Titel und beliebigen Inhalt
 *   als `children`.
 *
 * Rolle im Gesamtsystem:
 *   Wird für sämtliche Dialoge verwendet: Formulare (Tower anlegen/bearbeiten,
 *   Ticket erstellen), Bestätigungsdialoge, Detail-Ansichten usw.
 *
 * Abhängigkeiten:
 *   - React (useEffect) für Scroll-Lock.
 *
 * Wichtige Annahmen:
 *   - Das Schließen erfolgt über drei Wege: Klick auf den halbtransparenten
 *     Backdrop, Klick auf das ×-Symbol oder programmatisch via `onClose`.
 *   - Solange der Modal geöffnet ist, wird `document.body.style.overflow`
 *     auf 'hidden' gesetzt, um Hintergrund-Scrollen zu verhindern.
 *   - ESC-Close ist hier NICHT implementiert; bei Bedarf wäre ein
 *     keydown-Listener im useEffect zu ergänzen.
 *
 * Änderungshinweise:
 *   - Für ESC-Schließen einen `keydown`-Event-Listener hinzufügen.
 *   - Für Animationen (Fade-In/Out) eine Transition-Library oder
 *     CSS-Transitions ergänzen.
 */

import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  /**
   * Scroll-Lock-Effekt: Verhindert Scrollen des Hintergrunds, solange der
   * Modal geöffnet ist. Die Cleanup-Funktion stellt den Ursprungszustand
   * beim Unmount oder Schließen wieder her.
   */
  useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);
  /* Frühzeitiger Abbruch: Wenn der Modal geschlossen ist, nichts rendern. */
  if (!isOpen) return null;
  /** Größen-Mapping: Übersetzt die size-Prop in eine Tailwind-max-width-Klasse. */
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop: Halbtransparenter Hintergrund; Klick darauf schließt den Modal. */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        {/* Dialog-Container: Positioniert sich relativ über dem Backdrop. */}
        <div className={`relative bg-white rounded-lg shadow-xl sm:my-8 sm:w-full ${w} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {/* Schließen-Button oben rechts (×-Symbol). */}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          {/* children: Beliebiger Inhalt (Formulare, Texte, Bestätigungen …). */}
          {children}
        </div>
      </div>
    </div>
  );
}
