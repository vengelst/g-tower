/**
 * postcss.config.js – PostCSS-Konfiguration für G-Tower Frontend
 * =============================================================================
 * Zweck:         Aktiviert Tailwind CSS und Autoprefixer als PostCSS-Plugins.
 * Rolle:         Wird von Vite automatisch geladen. Verarbeitet alle CSS-Dateien
 *                durch die Plugin-Pipeline: Tailwind → Autoprefixer.
 * Abhängigkeiten: tailwindcss, autoprefixer (beide in devDependencies)
 * Wichtige Annahmen:
 *   - Tailwind generiert Utility-Klassen basierend auf tailwind.config.js
 *   - Autoprefixer fügt Browser-Präfixe hinzu (für Cross-Browser-Kompatibilität)
 * Änderungshinweise:
 *   - Neue PostCSS-Plugins hier ergänzen (z.B. cssnano für Minification)
 */

export default {
  plugins: {
    tailwindcss: {},   // Tailwind CSS: Utility-Klassen generieren
    autoprefixer: {},  // Autoprefixer: Browser-Präfixe hinzufügen
  },
}
