# gestion-hogar

Aplicación para gestionar el hogar: tareas, ideas, compra, recetas, gastos, calendario, inventario y mantenimiento. El diseño completo y la hoja de ruta están en [`docs/DISENO.md`](docs/DISENO.md).

La versión actual es el primer tablero de tareas, con prioridad **alta**, **media** o **baja**. Las tarjetas se arrastran entre columnas y se guardan en una base de datos SQLite.

- **Frontend:** Angular 20 (componentes standalone, signals, Angular CDK para arrastrar y soltar)
- **Backend:** NestJS 11 + SQLite (`better-sqlite3`)
- **Despliegue:** un único contenedor Docker que sirve la API en `/api` y la web compilada

```
gestion-hogar/
├── frontend/          Angular
│   └── src/app/       app.ts (tablero), card-dialog.ts (formulario), cards.service.ts (API)
├── backend/           NestJS
│   └── src/cards/     controlador, servicio y base de datos
├── Dockerfile         compila las dos partes y crea la imagen final
└── docker-compose.yml
```

## Desarrollo en local

Necesitas Node.js 22 o superior.

```bash
# Terminal 1: API en http://localhost:3000
cd backend
npm install
npm run dev

# Terminal 2: web en http://localhost:4200
cd frontend
npm install
npm start
```

El frontend redirige las llamadas a `/api` hacia el backend (ver `frontend/proxy.conf.json`). La base de datos se crea en `backend/data/hogar.db`. La primera vez se rellena con unas tarjetas de ejemplo que puedes borrar.

Tras el primer `npm install`, sube a git los `package-lock.json` que se generan. Así el Docker instala siempre las mismas versiones.

## Despliegue en el servidor (Docker)

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

- **Tailscale:** entra a `http://<nombre-tailscale-del-servidor>:8085` desde cualquier dispositivo de tu red Tailscale.
- **Dominio con Cloudflare:** apunta un subdominio (por ejemplo `hogar.kaitzlab.com`) a `http://localhost:8085` desde tu túnel o proxy. La app **no tiene inicio de sesión**, así que si la expones a internet protégela con Cloudflare Access o similar.

### Datos y copias de seguridad

Las tarjetas viven en el volumen de Docker `gestion-hogar-data` (archivo `/app/data/hogar.db` dentro del contenedor). Para hacer una copia:

```bash
docker cp gestion-hogar:/app/data/hogar.db ./hogar-backup.db
```

El puerto se cambia en `docker-compose.yml` (`"8085:3000"`).

## API

| Método | Ruta              | Qué hace                                  |
|--------|-------------------|-------------------------------------------|
| GET    | `/api/cards`      | Lista todas las tarjetas                  |
| POST   | `/api/cards`      | Crea una tarjeta                          |
| PATCH  | `/api/cards/:id`  | Cambia campos (también mover de columna)  |
| DELETE | `/api/cards/:id`  | Borra una tarjeta                         |

Cuerpo de una tarjeta:

```json
{
  "title": "Purgar los radiadores",
  "note": "Antes de que apriete el frío",
  "column": "casa",
  "priority": "alta",
  "due": "2026-11-15"
}
```

- `column`: `casa`, `hacer`, `ideas` o `hecho`
- `priority`: `alta`, `media` o `baja`
- `due`: fecha `AAAA-MM-DD` o vacío
