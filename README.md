# gestion-hogar

Aplicación para gestionar el hogar: tareas, ideas, compra, recetas, gastos, calendario, inventario y mantenimiento. El diseño completo y la hoja de ruta están en [`docs/DESIGN.md`](docs/DESIGN.md).

Ahora mismo está en marcha la **fase 1**. Ya está montada la estructura (navegación, base de datos con Prisma y tipos compartidos), pero las páginas de Tareas e Ideas todavía no guardan nada.

- **Frontend:** Angular 20 (componentes standalone, signals, router con un módulo de rutas por sección)
- **Backend:** NestJS 11 + Prisma 7 sobre SQLite
- **Tipos comunes:** paquete `@hogar/shared`, usado por las dos partes
- **Despliegue:** un único contenedor Docker que sirve la API en `/api` y la web compilada

```
gestion-hogar/
├── shared/            @hogar/shared: tipos y constantes (estados, prioridades…)
├── backend/           NestJS
│   ├── prisma/        schema.prisma y migraciones
│   └── src/           un módulo Nest por cada módulo de la app
├── frontend/          Angular
│   └── src/app/       un módulo de rutas por cada módulo de la app (tasks/, ideas/…)
├── docs/              documento de diseño
├── Dockerfile
└── docker-compose.yml
```

El repositorio usa **npm workspaces**: todo se instala desde la raíz y hay un único `package-lock.json`.

## Desarrollo en local

Necesitas Node.js 22 o superior.

```bash
# Una sola vez
npm install
cp backend/.env.example backend/.env
npm run db:migrate              # crea backend/data/hogar.db con las tablas

# Terminal 1: API en http://localhost:3000
npm run dev:api

# Terminal 2: web en http://localhost:4200
npm run dev:web
```

El frontend redirige las llamadas a `/api` hacia el backend (ver `frontend/proxy.conf.json`). El frontend lee `shared/` directamente del código fuente. El backend usa la versión compilada (`shared/dist`), así que, si cambias algo en `shared/`, reinicia `npm run dev:api`.

### Cambios en la base de datos

1. Edita `backend/prisma/schema.prisma`.
2. Crea y aplica la migración: `npm run db:migrate -- --name descripcion-corta`.
3. Sube a git la carpeta nueva de `backend/prisma/migrations/`.

El cliente de Prisma se genera en `backend/src/generated/` al compilar o arrancar el backend. Esa carpeta no se sube a git.

## Despliegue en el servidor (Docker)

El contenedor aplica las migraciones pendientes cada vez que arranca, así que basta con reconstruirlo para actualizar.

### Opción A: por terminal

```bash
git clone https://github.com/SrArkaitz/gestion-hogar.git
cd gestion-hogar
docker compose up -d --build
```

La web queda en `http://IP-DEL-SERVIDOR:8085`. Para actualizar:

```bash
git pull
docker compose up -d --build
```

### Opción B: desde Portainer

1. **Stacks → Add stack → Repository**.
2. Repository URL: `https://github.com/SrArkaitz/gestion-hogar`, reference `refs/heads/main`, compose path `docker-compose.yml`.
3. Como el repositorio es privado, activa **Authentication** y usa tu usuario de GitHub con un *personal access token* (GitHub → Settings → Developer settings → Fine-grained tokens, con permiso de lectura de contenidos sobre este repositorio).
4. **Deploy the stack**. Para actualizar después, entra en el stack y pulsa **Pull and redeploy**.

### Acceso desde fuera

El plan es publicarla en `https://hogar.kaitzlab.com` con Cloudflare Tunnel (ver el documento de diseño). La app **todavía no tiene inicio de sesión**, así que no la expongas a internet hasta que esté hecho, o protégela antes con Cloudflare Access.

### Datos y copias de seguridad

La base de datos vive en el volumen de Docker `gestion-hogar-data` (archivo `/app/data/hogar.db` dentro del contenedor). Para hacer una copia:

```bash
docker cp gestion-hogar:/app/data/hogar.db ./hogar-backup.db
```

El puerto se cambia en `docker-compose.yml` (`"8085:3000"`).

## API

| Método | Ruta          | Qué hace                                      |
|--------|---------------|-----------------------------------------------|
| GET    | `/api/health` | Comprueba que la API y la base de datos responden |
