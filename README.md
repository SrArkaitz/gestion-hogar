# gestion-hogar

Aplicación para gestionar el hogar: tareas, ideas, compra, recetas, gastos, calendario, inventario y mantenimiento. El diseño completo y la hoja de ruta están en [`docs/DESIGN.md`](docs/DESIGN.md).

Ahora mismo está en marcha la **fase 1**. Ya funcionan las cuentas y las casas (registro, login, varias casas por persona con administradores, invitaciones por enlace y selector de casa) el tablero de Tareas y el módulo de Ideas. Falta publicarla en `hogar.kaitzlab.com` para cerrar la fase.

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

La guía paso a paso para publicarla en `https://hogar.kaitzlab.com` está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md): Portainer, Cloudflare Tunnel, cookie segura, acceso con Google, copias de seguridad y Cloudflare Access.

En resumen:

- El contenedor aplica las migraciones pendientes cada vez que arranca, así que basta con reconstruirlo para actualizar.
- Hace una copia de la base de datos cada día a las 03:30 y guarda las últimas 14.
- La configuración (`COOKIE_SECURE`, `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`…) se pone en las *Environment variables* del stack de Portainer, no en el repositorio.
- `COOKIE_SECURE` es `false` si no se define, para poder iniciar sesión por `http://IP:8085`. Ponlo a `true` cuando solo entres por `https://hogar.kaitzlab.com`.

### Por terminal

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

La base de datos vive en el volumen de Docker `gestion-hogar-data` (`/app/data/hogar.db` dentro del contenedor) y las copias diarias en `/app/data/backups`. El puerto se cambia en `docker-compose.yml` (`"8085:3000"`).

## API

Todas las rutas piden sesión salvo las marcadas como públicas. La sesión va en la cookie `hogar_sesion`. Las rutas con `:householdId` solo responden a miembros de esa casa; las marcadas *admin*, solo a sus administradores.

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET    | `/api/health` | Comprueba que la API y la base de datos responden (pública) |
| POST   | `/api/auth/register` | Crea una cuenta e inicia sesión (pública) |
| POST   | `/api/auth/login` | Inicia sesión (pública) |
| POST   | `/api/auth/logout` | Cierra la sesión (pública) |
| GET    | `/api/auth/me` | Usuario actual, sus casas con su rol y sus formas de entrar |
| GET    | `/api/auth/providers` | Si el acceso con Google está configurado (pública) |
| GET    | `/api/auth/google` | Redirige a Google para entrar o registrarse; `?modo=conectar` lo conecta a la cuenta con sesión; `?volver=/ruta` (pública) |
| GET    | `/api/auth/google/callback` | Vuelta desde Google; redirige a la app, con `?error=…` si algo falla (pública) |
| DELETE | `/api/auth/google` | Desconecta Google (solo si la cuenta tiene contraseña) |
| POST   | `/api/households` | Crea una casa; quien la crea es administrador |
| GET    | `/api/households/:householdId` | Casa con sus miembros |
| PATCH  | `/api/households/:householdId` | Cambia el nombre (admin) |
| PATCH  | `/api/households/:householdId/members/:userId` | Cambia el rol de un miembro (admin) |
| DELETE | `/api/households/:householdId/members/:userId` | Salir de la casa, o sacar a alguien (admin) |
| GET    | `/api/households/:householdId/invitations` | Invitaciones pendientes (admin) |
| POST   | `/api/households/:householdId/invitations` | Crea un enlace de invitación (admin) |
| DELETE | `/api/households/:householdId/invitations/:id` | Anula una invitación (admin) |
| GET    | `/api/invitations/:token` | A qué casa invita un enlace (pública) |
| POST   | `/api/invitations/:token/accept` | Acepta la invitación |
| GET    | `/api/households/:householdId/tasks` | Tareas de la casa |
| POST   | `/api/households/:householdId/tasks` | Crea una tarea |
| PATCH  | `/api/households/:householdId/tasks/:id` | Cambia campos de una tarea (también moverla de columna) |
| DELETE | `/api/households/:householdId/tasks/:id` | Borra una tarea |
| GET    | `/api/households/:householdId/ideas` | Ideas de la casa, de la más reciente a la más antigua |
| POST   | `/api/households/:householdId/ideas` | Propone una idea (`title`, `description`, `category`) |
| PATCH  | `/api/households/:householdId/ideas/:id` | Edita una idea o cambia su `status` a `nueva`, `en_valoracion` o `descartada` |
| DELETE | `/api/households/:householdId/ideas/:id` | Borra una idea (quien la propuso o un administrador) |
| POST   | `/api/households/:householdId/ideas/:id/accept` | Acepta la idea y crea su tarea (`{ "priority": "alta" }`) |

Cuerpo de una tarea (solo `title` y `priority` son obligatorios al crearla):

```json
{
  "title": "Purgar los radiadores",
  "notes": "Antes de que apriete el frío",
  "status": "por_hacer",
  "priority": "alta",
  "due": "2026-11-15",
  "category": "Casa",
  "assigneeId": "<id de un miembro de la casa>"
}
```

- `status`: `por_hacer`, `en_curso` o `hecho`
- `priority`: `alta`, `media` o `baja`
- `due`, `category` y `assigneeId` admiten `null` para quitarlos
