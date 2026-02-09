/**
 * vite-env.d.ts – TypeScript-Typdefinitionen für Vite-Umgebungsvariablen
 * =============================================================================
 * Zweck:         Macht VITE_*-Umgebungsvariablen in TypeScript typensicher
 *                verfügbar (import.meta.env.VITE_API_URL).
 * Rolle:         Wird von TypeScript automatisch eingebunden (in tsconfig.json
 *                über "include": ["src"] erfasst).
 * Abhängigkeiten: vite/client (liefert Basis-Typen für import.meta)
 * Wichtige Annahmen:
 *   - Nur VITE_*-Variablen sind im Browser verfügbar (Vite-Konvention)
 *   - VITE_API_URL ist optional (wird nur in Dev via docker-compose.override gesetzt)
 * Änderungshinweise:
 *   - Neue VITE_*-Variablen hier als readonly-Property ergänzen
 */

/// <reference types="vite/client" />

/** Typdefinition für alle VITE_*-Umgebungsvariablen */
interface ImportMetaEnv {
  /** API-Base-URL für den Browser (z.B. http://localhost:3000 in Dev) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
