# --- 1. Compilar el frontend (Angular) ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY frontend/ ./
RUN npm run build

# --- 2. Compilar el backend (NestJS) ---
FROM node:22-bookworm-slim AS backend
# Herramientas por si better-sqlite3 tiene que compilarse desde el código fuente
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /src/backend
COPY backend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# --- 3. Imagen final ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/hogar.db
WORKDIR /app
COPY --from=backend /src/backend/node_modules ./node_modules
COPY --from=backend /src/backend/dist ./dist
COPY --from=backend /src/backend/package.json ./
COPY --from=frontend /src/frontend/dist/frontend/browser ./public
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "dist/main.js"]
