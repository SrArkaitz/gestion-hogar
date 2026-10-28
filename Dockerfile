# Repositorio con npm workspaces: shared, backend y frontend comparten un único package-lock.json.

# --- 1. Compilar todo (shared, backend con Prisma y frontend Angular) ---
FROM node:22-bookworm-slim AS build
# Herramientas por si better-sqlite3 tiene que compilarse desde el código fuente
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY shared/ shared/
COPY backend/ backend/
COPY frontend/ frontend/
# prisma.config.ts necesita la variable aunque generate no abra la base de datos
ENV DATABASE_URL=file:/app/data/hogar.db
RUN npm run build

# --- 2. Dependencias de producción (solo backend y shared) ---
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend -w shared

# --- 3. Imagen final ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/app/data/hogar.db
WORKDIR /app
COPY --from=deps /src/node_modules ./node_modules
COPY --from=build /src/shared/package.json ./shared/
COPY --from=build /src/shared/dist ./shared/dist
COPY --from=build /src/backend/package.json /src/backend/prisma.config.ts ./backend/
COPY --from=build /src/backend/prisma ./backend/prisma
COPY --from=build /src/backend/dist ./backend/dist
COPY --from=build /src/frontend/dist/frontend/browser ./backend/public
WORKDIR /app/backend
VOLUME ["/app/data"]
EXPOSE 3000
# Aplica las migraciones pendientes y arranca la API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
