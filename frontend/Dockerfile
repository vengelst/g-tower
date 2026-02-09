# =============================================================================
# Dockerfile – Multi-Stage Build für das G-Tower Frontend
# =============================================================================
# Zweck:         Erzeugt Docker-Images für Entwicklung (dev) und Produktion (prod).
#                In Prod wird eine statische SPA via nginx ausgeliefert.
# Rolle:         Wird von docker-compose.yml referenziert. Je nach Target
#                (dev/prod) wird ein anderer Stage gebaut.
# Abhängigkeiten: package.json, package-lock.json, vite.config.ts, nginx.conf
# Wichtige Annahmen:
#   - Dev-Target nutzt Vite Dev Server mit HMR (Port 5173)
#   - Prod-Target baut die SPA und liefert sie via nginx aus (Port 8080)
#   - nginx.conf muss im Frontend-Verzeichnis liegen (SPA-Routing: try_files)
#   - VITE_API_URL wird zur Build-Zeit eingebettet (nicht zur Laufzeit änderbar)
#   - Prod-Container läuft als Non-root User (nginx) aus Sicherheitsgründen
# Änderungshinweise:
#   - Bei neuen Umgebungsvariablen: VITE_* Präfix für Vite-Zugriff erforderlich
#   - nginx.conf anpassen bei API-Proxy-Änderungen oder neuen Routen
# =============================================================================

# ── Dev target ───────────────────────────────────────────
# Wird über docker-compose.override.yml aktiviert (target: dev).
# Vite Dev Server mit Hot Module Replacement für sofortige UI-Updates.
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# Vite Dev Server: --host macht ihn im Docker-Netzwerk erreichbar
CMD ["npx", "vite", "--host"]

# ── Build target ─────────────────────────────────────────
# Zwischenstufe: Vite-Build erzeugt optimierte statische Dateien in dist/.
# Wird nur intern vom Prod-Target genutzt (COPY --from=build).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite-Build: TypeScript-Kompilierung + Bundling + Minification → dist/
RUN npm run build

# ── Prod target ──────────────────────────────────────────
# Minimales nginx-Image: Liefert die gebaute SPA als statische Dateien aus.
# nginx.conf konfiguriert SPA-Routing (alle Pfade → index.html).
FROM nginx:alpine AS prod
# Gebaute SPA-Dateien aus dem Build-Stage übernehmen
COPY --from=build /app/dist /usr/share/nginx/html
# Eigene nginx-Konfiguration für SPA-Routing und API-Proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Berechtigungen für Non-root User setzen
RUN chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx \
 && chown -R nginx:nginx /var/log/nginx \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
