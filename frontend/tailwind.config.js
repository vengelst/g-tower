/**
 * tailwind.config.js – Tailwind CSS Konfiguration für G-Tower Frontend
 * =============================================================================
 * Zweck:         Definiert den Content-Scan-Pfad und erweitert das Farbschema.
 * Rolle:         Wird von PostCSS/Tailwind beim Build und im Dev Server gelesen.
 * Abhängigkeiten: tailwindcss (PostCSS Plugin), index.css (@tailwind Direktiven)
 * Wichtige Annahmen:
 *   - Content-Pfade scannen index.html und alle src/-Dateien nach Tailwind-Klassen
 *   - primary-Farbpalette (Blau-Töne) wird für Buttons, Links, Badges verwendet
 *   - Keine zusätzlichen Plugins (kein @tailwindcss/forms etc.)
 * Änderungshinweise:
 *   - Neue Farbpaletten unter theme.extend.colors ergänzen
 *   - Bei neuen Dateiendungen den content-Array erweitern
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Alle Dateien scannen, die Tailwind-Klassen enthalten können
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primärfarbe: Blau-Palette (50=hell → 900=dunkel)
        // Wird für Buttons, aktive Tabs, Links und Fokus-Ringe verwendet
        primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' }
      }
    }
  },
  plugins: [],
}
