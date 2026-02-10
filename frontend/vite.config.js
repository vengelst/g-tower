/**
 * vite.config.ts – Vite-Konfiguration für das G-Tower Frontend
 * =============================================================================
 * Zweck:         Konfiguriert den Vite Dev Server und Build-Prozess.
 * Rolle:         Zentrale Build-Tool-Konfiguration. Wird von `vite`, `vite build`
 *                und `vite preview` gelesen.
 * Abhängigkeiten: @vitejs/plugin-react (JSX-Transformation, Fast Refresh)
 * Wichtige Annahmen:
 *   - Dev Server lauscht auf Port 5173 (host: true für Docker-Zugriff)
 *   - /api-Requests werden an das Backend geproxied (vermeidet CORS in Dev)
 *   - VITE_API_PROXY ist konfigurierbar, Default: http://localhost:3000
 *   - In Produktion gibt es keinen Proxy – nginx übernimmt das Routing
 * Änderungshinweise:
 *   - Neue Vite-Plugins hier ergänzen (z.B. SVG-Loader)
 *   - Proxy-Konfiguration nur für Dev relevant
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        host: true, // Auf 0.0.0.0 binden, damit Docker-Container erreichbar ist
        allowedHosts: ['localhost', 'qtower.workteams.eu'],
        proxy: {
            // API-Proxy: Leitet /api-Requests an das Backend weiter (nur Dev)
            '/api': {
                target: process.env.VITE_API_PROXY || 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
});
