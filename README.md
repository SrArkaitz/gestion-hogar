# gestion-hogar

Aplicación para gestionar el hogar: tareas, ideas, compra, recetas, gastos, calendario, inventario y mantenimiento. El diseño completo y la hoja de ruta están en [`docs/DESIGN.md`](docs/DESIGN.md).

Está publicada en `https://hogar.kaitzlab.com`. Ya funcionan las cuentas y las casas (registro, login, varias casas por persona con administradores, invitaciones por enlace y selector de casa), el tablero de Tareas con tareas recurrentes, el módulo de Ideas, la lista de la compra, las recetas con menú semanal, la app instalable (PWA) y los avisos push.

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

La base de datos vive en el volumen de Docker `gestion-hogar-data` (`/app/data/hogar.db` dentro del contenedor), las fotos de las recetas en `/app/data/photos` y las copias diarias (base de datos y fotos) en `/app/data/backups`. El puerto se cambia en `docker-compose.yml` (`"8085:3000"`).

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
| PATCH  | `/api/households/:householdId/members/:userId/color` | Cambia el color de un miembro (`{ "color": "verde" }`): el propio, o cualquiera si eres admin |
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
| GET    | `/api/households/:householdId/recurring` | Tareas recurrentes de la casa |
| POST   | `/api/households/:householdId/recurring` | Crea una; si empieza hoy, crea ya su tarea |
| PATCH  | `/api/households/:householdId/recurring/:id` | Edita, pausa (`{ "active": false }`) o reactiva |
| DELETE | `/api/households/:householdId/recurring/:id` | Borra la plantilla; las tareas que creó se quedan |
| GET    | `/api/households/:householdId/shopping/items` | Lista de la compra |
| POST   | `/api/households/:householdId/shopping/items` | Añade (`name`, `quantity`, `section` opcionales); si ya está, no lo repite |
| PATCH  | `/api/households/:householdId/shopping/items/:id` | Cambia nombre, cantidad, sección o `done` (en el carro) |
| DELETE | `/api/households/:householdId/shopping/items/:id` | Quita un artículo |
| POST   | `/api/households/:householdId/shopping/items/clear-done` | Quita todo lo que está en el carro |
| GET    | `/api/households/:householdId/shopping/products` | Productos ya comprados, de los más habituales a los menos |
| DELETE | `/api/households/:householdId/shopping/products/:key` | Olvida un producto para que no se sugiera |
| POST   | `/api/households/:householdId/shopping/items/bulk` | Añade varios (`{ "items": [{ "name", "quantity" }] }`); suma cantidades con lo que ya hubiera |
| GET    | `/api/households/:householdId/recipes` | Recetario de la casa |
| GET    | `/api/households/:householdId/recipes/:id` | Una receta |
| POST   | `/api/households/:householdId/recipes` | Crea una receta |
| PATCH  | `/api/households/:householdId/recipes/:id` | Edita; ingredientes y pasos se sustituyen enteros |
| DELETE | `/api/households/:householdId/recipes/:id` | Borra la receta, su foto y sus platos del menú |
| PUT    | `/api/households/:householdId/recipes/:id/photo` | Sube la foto: el cuerpo es la imagen (`image/jpeg`, `image/png` o `image/webp`, hasta 8 MB) |
| GET    | `/api/households/:householdId/recipes/:id/photo` | Descarga la foto |
| DELETE | `/api/households/:householdId/recipes/:id/photo` | Quita la foto |
| GET    | `/api/households/:householdId/menu?from=AAAA-MM-DD&to=AAAA-MM-DD` | Platos del menú entre dos fechas |
| POST   | `/api/households/:householdId/menu` | Pone un plato (`date`, `meal`: `comida` o `cena`, `recipeId`, `servings`) |
| PATCH  | `/api/households/:householdId/menu/:id` | Cambia raciones, día o comida |
| DELETE | `/api/households/:householdId/menu/:id` | Quita un plato |
| GET    | `/api/push/config` | Clave pública VAPID para suscribirse a los avisos |
| POST   | `/api/push/subscriptions` | Guarda la suscripción push de este navegador (`PushSubscription.toJSON()`) |
| DELETE | `/api/push/subscriptions` | Quita la suscripción (`{ "endpoint": "…" }`) |
| POST   | `/api/push/test` | Manda un aviso de prueba a todos tus dispositivos |
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
  "assigneeIds": ["<id de un miembro de la casa>", "<id de otro>"]
}
```

- `status`: `por_hacer`, `en_curso` o `hecho`
- `priority`: `alta`, `media` o `baja`
- `due` y `category` admiten `null` para quitarlos
- `assigneeIds`: lista de miembros de la casa; `[]` deja la tarea sin asignar. Al editar, sustituye a la lista anterior
- Las tareas creadas por una recurrente llevan `recurringId`
- Colores de los miembros: `azul`, `verde`, `naranja`, `morado`, `rojo`, `celeste`, `rosa`, `lima`, `amarillo` o `gris`

Cuerpo de una tarea recurrente:

```json
{
  "title": "Sacar la basura",
  "priority": "media",
  "assigneeIds": ["<id de un miembro>"],
  "frequency": "dias_semana",
  "weekdays": [1, 4],
  "startDate": "2026-11-02"
}
```

Cuerpo de una receta:

```json
{
  "name": "Tortilla de patatas",
  "kind": "unico",
  "duration": "medio",
  "minutes": 40,
  "servings": 4,
  "ingredients": [
    { "name": "Patatas", "amount": 1, "unit": "kg" },
    { "name": "Huevos", "amount": 6, "unit": "ud" },
    { "name": "Sal", "text": "al gusto" }
  ],
  "steps": ["Pelar y cortar las patatas", "Freír a fuego lento", "Batir los huevos y cuajar"],
  "notes": ""
}
```

- `kind`: `primero`, `segundo`, `unico` o `postre`; `duration`: `rapido`, `medio` o `largo`
- `unit`: `g`, `kg`, `ml`, `l`, `ud` o `null` (número sin unidad); sin `amount`, `text` es lo que se muestra

Tareas recurrentes:

- `frequency`: `dias`, `semanas` o `meses` (con `interval`, cada cuántos) o `dias_semana` (con `weekdays`, de 1 = lunes a 7 = domingo)
- En `semanas` y `meses`, `startDate` marca el día de la semana o del mes; en `meses`, si el mes no tiene ese día se usa el último
- Cada noche, a las 00:01, se crean las tareas que tocan ese día, con ese día como fecha límite. Si la anterior de la misma plantilla sigue sin hacer, no se crea otra
