# Despliegue en hogar.kaitzlab.com

Guía para publicar la app en el Beelink con Portainer y abrirla al exterior con Cloudflare Tunnel. Sigue los pasos en orden; cada uno termina con una comprobación.

**Necesitas:**

- El Beelink con Docker y Portainer.
- El dominio `kaitzlab.com` gestionado en Cloudflare.
- Un *personal access token* de GitHub con permiso de lectura sobre este repositorio (es privado).

## 1. Desplegar el contenedor en Portainer

1. En Portainer: **Stacks → Add stack**. Nombre: `gestion-hogar`.
2. **Build method: Repository**.
   - Repository URL: `https://github.com/SrArkaitz/gestion-hogar`
   - Repository reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
   - Activa **Authentication**: tu usuario de GitHub y el token como contraseña.
3. **Deploy the stack**. La primera vez tarda unos minutos, porque compila el frontend y el backend dentro de la imagen.

**Comprobación:** desde un navegador de casa abre `http://IP-DEL-BEELINK:8085/api/health`. Debe responder `{"ok":true}`. En los logs del contenedor (Portainer → Containers → `gestion-hogar` → Logs) tienen que aparecer, por este orden:

- "All migrations have been successfully applied".
- "Copia de seguridad hecha".
- "Gestión del hogar escuchando".

> Si ya habías desplegado una versión anterior a la de cuentas y casas (commit `d6365f2`), borra antes el volumen `gestion-hogar-data` (Portainer → Volumes). El esquema de la base de datos cambió y aún no había datos que conservar.

## 2. Publicar hogar.kaitzlab.com con Cloudflare Tunnel

El túnel conecta el Beelink con Cloudflare desde dentro, así que no hay que abrir puertos en el router. Cloudflare pone el HTTPS.

### Si ya tienes un túnel funcionando en el Beelink

1. En el panel de Cloudflare: **Zero Trust → Networks → Tunnels** y entra en tu túnel.
2. En **Public Hostname** (en algunas versiones del panel se llama *Published application routes*), añade uno:
   - Subdomain: `hogar` · Domain: `kaitzlab.com`
   - Service: `HTTP` · URL: `IP-DEL-BEELINK:8085`
3. Guarda. Cloudflare crea solo el registro DNS de `hogar.kaitzlab.com`.

### Si no tienes túnel

1. **Zero Trust → Networks → Tunnels → Create a tunnel** → tipo **Cloudflared**. Nombre: por ejemplo `beelink`.
2. Elige **Docker** como entorno y copia el token que aparece en el comando (lo que va después de `--token`).
3. En Portainer crea otro stack, `cloudflared`, con **Web editor** y este contenido, pegando tu token:

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:latest
       container_name: cloudflared
       restart: unless-stopped
       command: tunnel --no-autoupdate run --token PEGA_AQUI_TU_TOKEN
   ```

4. De vuelta en Cloudflare, el conector debe salir como *Healthy*. Sigue en **Public Hostname** con los mismos datos del apartado anterior (`hogar` · `kaitzlab.com` · `HTTP` · `IP-DEL-BEELINK:8085`).

**Comprobación:** desde el móvil, con los datos móviles (no la wifi de casa), abre `https://hogar.kaitzlab.com/api/health`. Debe responder `{"ok":true}`.

## 3. Activar la cookie segura

Ahora que hay HTTPS, la cookie de sesión debe viajar solo cifrada.

1. Portainer → Stacks → `gestion-hogar` → **Editor**. Cambia `COOKIE_SECURE=false` por `COOKIE_SECURE=true`.
2. **Update the stack**.

Desde este momento, entra siempre por `https://hogar.kaitzlab.com`, también desde casa. Por `http://IP:8085` la web se abre, pero no se puede iniciar sesión.

> El cambio en el editor de Portainer se pierde si después haces *Pull and redeploy*, porque vuelve a leer el `docker-compose.yml` del repositorio. Para que quede fijo, cambia también el valor en el repositorio y haz commit, o define la variable en el apartado **Environment variables** del stack.

**Comprobación:** en `https://hogar.kaitzlab.com` crea tu cuenta y tu casa. Cierra el navegador, vuelve a abrir la web y comprueba que sigues dentro.

## 4. Copias de seguridad

La app hace una copia de la base de datos cada día a las 03:30 (hora de `TZ`), y otra al arrancar si ese día aún no la había. Guarda las últimas 14 (`BACKUP_KEEP`) en `/app/data/backups`, dentro del mismo volumen que la base de datos.

**Recomendado:** guardar las copias en otro disco o en el NAS. Si el disco del volumen falla, así no se pierden también las copias.

1. Crea la carpeta en el Beelink, por ejemplo `/mnt/backup/copias-hogar`.
2. En el `docker-compose.yml`, descomenta las dos líneas de `BACKUP_DIR` y del volumen `/backups`, y pon tu ruta.
3. Redespliega. En los logs, la ruta de "Copia de seguridad hecha" debe empezar por `/backups/`.

**Copia a mano en cualquier momento:**

```bash
docker cp gestion-hogar:/app/data/backups ./copias-hogar
```

**Restaurar una copia:**

1. Para el contenedor: `docker stop gestion-hogar`.
2. Copia la copia elegida encima de la base de datos:
   `docker cp ./hogar-2026-11-03.db gestion-hogar:/app/data/hogar.db`
3. Arranca: `docker start gestion-hogar`. Si la copia es de una versión anterior de la app, las migraciones que falten se aplican solas al arrancar.

## 5. Actualizar

Cuando haya cambios en `main`: Portainer → Stacks → `gestion-hogar` → **Pull and redeploy**. Las migraciones de la base de datos se aplican solas al arrancar. Antes de una actualización grande, haz una copia a mano (apartado 4).

## 6. Opcional: Cloudflare Access

El registro está abierto: cualquiera que llegue a `hogar.kaitzlab.com` puede crearse una cuenta, aunque solo vea sus propias casas. Si prefieres que la web ni siquiera se abra a desconocidos, pon delante Cloudflare Access:

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Dominio: `hogar.kaitzlab.com`.
3. Política **Allow** con **Emails**: tu correo y el de quien quieras dejar entrar. Cloudflare les mandará un código por correo la primera vez.

Con Access activo, quien no esté en la lista no llega ni a la pantalla de entrar.

## Variables de entorno

| Variable | Por defecto | Para qué |
|----------|-------------|----------|
| `TZ` | `Europe/Madrid` | Zona horaria (también la de la copia diaria) |
| `COOKIE_SECURE` | `true` en producción | `false` para poder iniciar sesión por `http://` |
| `BACKUP_KEEP` | `14` | Copias diarias que se guardan |
| `BACKUP_DIR` | `/app/data/backups` | Carpeta de las copias |
| `DATABASE_URL` | `file:/app/data/hogar.db` | Archivo de la base de datos (no hace falta cambiarlo) |
| `PORT` | `3000` | Puerto dentro del contenedor (el de fuera se cambia en `ports`) |
