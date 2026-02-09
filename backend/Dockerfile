# =============================================================================
# Dockerfile – Multi-Stage Build für das G-Tower Backend
# =============================================================================
# Zweck:         Erzeugt Docker-Images für Entwicklung (dev) und Produktion (prod).
#                Der Build-Stage kompiliert TypeScript → JavaScript.
# Rolle:         Wird von docker-compose.yml referenziert. Je nach Target
#                (dev/prod) wird ein anderer Stage gebaut.
# Abhängigkeiten: package.json, package-lock.json, tsconfig.json, src/
# Wichtige Annahmen:
#   - Dev-Target nutzt tsx watch für Hot-Reload (kein Kompilieren nötig)
#   - Prod-Target erzeugt ein minimales Image ohne Dev-Dependencies
#   - Prod läuft als Non-root User (appuser) aus Sicherheitsgründen
#   - uploads/-Verzeichnis wird im Container angelegt, in Prod als
#     Docker-Volume persistiert (siehe docker-compose.yml)
# Änderungshinweise:
#   - Bei neuen System-Dependencies (z.B. sharp für Bildverarbeitung)
#     muss ggf. `apk add` ergänzt werden
#   - Node-Version hier und in package.json konsistent halten
# =============================================================================

# ── Dev target ───────────────────────────────────────────
# Wird über docker-compose.override.yml aktiviert (target: dev).
# Installiert ALLE Dependencies (inkl. devDependencies) und startet
# tsx watch für automatischen Neustart bei TypeScript-Änderungen.
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Upload-Verzeichnis anlegen (wird in Dev nicht als Volume gemountet)
RUN mkdir -p /app/uploads /data/uploads
EXPOSE 3000
# tsx watch: Überwacht src/ und startet bei Änderungen automatisch neu
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ── Build target ─────────────────────────────────────────
# Zwischenstufe: Kompiliert TypeScript → JavaScript nach dist/.
# Wird nur intern vom Prod-Target genutzt (COPY --from=build).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ src/
# TypeScript-Kompilierung – Ausgabe landet in dist/ (siehe tsconfig.json)
RUN npx tsc

# ── Prod target ──────────────────────────────────────────
# Minimales Produktions-Image: nur kompilierter JS-Code + Prod-Dependencies.
# Läuft als Non-root User für erhöhte Sicherheit.
FROM node:20-alpine AS prod
WORKDIR /app
# Non-root User anlegen (Sicherheit: Container läuft nicht als root)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
# Nur Produktions-Dependencies installieren (kein tsx, typescript etc.)
RUN npm ci --omit=dev && npm cache clean --force
# Kompilierte JS-Dateien aus dem Build-Stage übernehmen
COPY --from=build /app/dist ./dist
# Upload-Verzeichnis anlegen und Berechtigungen setzen
RUN mkdir -p /app/uploads /data/uploads && chown -R appuser:appgroup /app /data
USER appuser
EXPOSE 3000
# Produktionsstart: direkt Node mit kompiliertem JavaScript
CMD ["node", "dist/index.js"]
