# ── Dev target ───────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ── Build target ─────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npx tsc

# ── Prod target ──────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
