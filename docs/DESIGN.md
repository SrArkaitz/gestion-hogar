# Gestión del Hogar: documento de diseño

Referencia del proyecto a largo plazo. Recoge qué es la aplicación, cómo está construida y en qué orden se desarrolla. Se actualiza cuando se toman decisiones nuevas; los módulos de fases futuras se detallan al llegar a ellas.

## 1. Objetivo

Una aplicación web para organizar la casa en un solo sitio: tareas, ideas, compra, comidas, gastos, fechas importantes y mantenimiento.

- **Usuarios:** al principio Arkaitz y, más adelante, su pareja. Cada persona tiene su cuenta y puede estar en varias *casas* a la vez (por ejemplo, la suya y la de sus padres).
- **Dispositivos:** PC y móvil. En el móvil se instala como app (PWA) y recibe notificaciones.
- **Acceso:** desde casa y desde fuera, en `https://hogar.kaitzlab.com`.

## 2. Módulos

### Base común

- **Usuarios y casas:** registro abierto y login. Quien crea una casa es su administrador. Los administradores invitan con un enlace, sacan a miembros y nombran a otros administradores. Una persona puede estar en varias casas y cambiar entre ellas; todo el contenido (tareas, ideas, compra…) pertenece a una casa. Detalle en 3.0.
- **Notificaciones:** avisos push en móvil y PC para recordatorios, tareas que vencen, cumpleaños, etc.

### Módulos de la aplicación

| # | Módulo | Qué hace |
|---|--------|----------|
| 1 | **Tareas** | Tablero con columnas, prioridad (alta, media, baja), fecha límite y persona asignada. Incluye **tareas recurrentes** que se crean solas cada cierto tiempo. |
| 2 | **Ideas** | Espacio aparte para apuntar ideas y valorarlas. Una idea **aceptada** pasa a ser una tarea con un botón. |
| 3 | **Lista de la compra** | Lista compartida para usar en el súper desde el móvil, marcando lo que se va cogiendo. |
| 4 | **Recetas y menús** | Recetario de platos y menú semanal opcional que manda los ingredientes a la lista de la compra. |
| 5 | **Gastos y facturas** | Gastos de casa repartidos entre los miembros y facturas fijas (luz, agua, internet). |
| 6 | **Calendario** | Reúne todo lo que tiene fecha: tareas, menús, facturas, revisiones y **cumpleaños**. |
| 7 | **Inventario** | Qué hay en casa (despensa, limpieza), aviso cuando algo se acaba para pasarlo a la compra, y garantías y manuales de electrodomésticos. |
| 8 | **Mantenimiento** | Revisiones periódicas de la casa y del coche (ITV, caldera, filtros), con historial y próxima fecha. |

### Relaciones entre módulos

- Ideas → Tareas: aceptar una idea crea una tarea con su título, notas y prioridad.
- Recetas y menús → Compra: los ingredientes del menú de la semana se suman y se añaden a la lista.
- Inventario → Compra: un producto que se acaba se añade a la lista.
- Tareas, Menús, Facturas, Mantenimiento y Cumpleaños → Calendario.
- Mantenimiento y Tareas recurrentes → Notificaciones.

## 3. Detalle por módulo

### 3.0 Usuarios y casas

- **Cuenta:** nombre, correo y contraseña (mínimo 8 caracteres). El registro está abierto a cualquiera.
- **Casas:** cualquiera puede crear las que quiera. Al registrarse sin invitación se pide crear la primera.
- **Roles por casa:** *administrador* o *miembro*. Una misma persona puede ser administradora en una casa y miembro en otra.
- **Administradores:** cambian el nombre de la casa, invitan, sacan a miembros y nombran o quitan administradores.
- **Invitaciones:** enlace de un solo uso que caduca en 7 días y se puede anular. Quien lo abre sin cuenta puede registrarse y vuelve a la invitación para aceptarla.
- **Salir de una casa:** cualquiera puede salir. El último administrador no puede salir mientras queden otros miembros; antes tiene que nombrar a otro. Si sale el último miembro, la casa se borra. Al salir o ser expulsado, sus tareas de esa casa quedan sin asignar.
- **Casa activa:** se elige en un selector (barra lateral en PC, barra superior en móvil) y se recuerda en el navegador.

### 3.1 Tareas

- **Columnas:** Por hacer, En curso y Hecho. Se mueven arrastrando, también en el móvil.
- **Campos:** título, notas, prioridad, fecha límite (opcional), persona asignada (opcional) y categoría (por ejemplo Casa, Recados o Papeleo) para filtrar.
- **Orden:** dentro de cada columna, primero por prioridad y luego por antigüedad. Las tareas vencidas se marcan.
- **Tareas recurrentes:** una plantilla (título, prioridad, asignada, categoría) más una frecuencia (cada N días, semanas o meses, o días concretos de la semana). Un proceso en el servidor crea la tarea cuando toca. Si la anterior sigue sin hacer, no se duplica.

### 3.2 Ideas

- **Campos:** título, descripción, categoría (casa, viaje, compra grande, proyecto…), quién la propone y fecha.
- **Estados:** Nueva, En valoración, Aceptada y Descartada.
- **Aceptar:** convierte la idea en tarea y la idea queda enlazada a ella. Las descartadas se archivan, no se borran.

### 3.3 Lista de la compra

*Se detalla al llegar a su fase.* Idea inicial: artículos con cantidad, marcar como comprado, agrupar por sección del súper y una lista de productos habituales para añadir rápido.

### 3.4 Recetas y menús

**Plato / receta**

- **Nombre** y **foto** (opcional).
- **Tipo:** primer plato, segundo plato, plato único o postre.
- **Duración:** rápido, medio o largo, siempre presente. Además, **minutos exactos** opcionales.
- **Raciones** para las que está pensada; las cantidades se escalan al cambiarlas.
- **Ingredientes:** nombre, cantidad y unidad (g, kg, ml, l, unidades) o texto libre ("al gusto").
- **Pasos** ordenados.

**Menú semanal (opcional)**

- Vista de la semana con comida y cena por día para elegir platos.
- No es obligatorio usarlo: el recetario funciona por sí solo.
- Botón "Añadir a la compra": suma los ingredientes de los platos de la semana (una sola línea por ingrediente repetido) y los pasa a la lista.

### 3.5 Gastos y facturas

*Se detalla al llegar a su fase.* Idea inicial: gasto con importe, categoría, quién paga y cómo se reparte; resumen de quién debe a quién; facturas fijas con fecha de vencimiento.

### 3.6 Calendario

- Vista mensual y semanal con lo que llega de los demás módulos.
- **Cumpleaños:** persona, fecha (con o sin año de nacimiento) y aviso unos días antes. Se repiten cada año.
- Eventos sueltos propios del calendario.

### 3.7 Inventario

*Se detalla al llegar a su fase.*

### 3.8 Mantenimiento

*Se detalla al llegar a su fase.*

## 4. Arquitectura

| Parte | Tecnología | Por qué |
|-------|-----------|---------|
| Frontend | **Angular** (componentes standalone, signals) + Angular CDK | Elección del proyecto. CDK para arrastrar y soltar. |
| Backend | **NestJS** (TypeScript) | Mismo lenguaje que el frontend y misma forma de organizarse (módulos, servicios, inyección de dependencias). |
| Base de datos | **SQLite** con **Prisma** | Sobra para dos personas, es un único archivo fácil de copiar. Prisma da migraciones para ir añadiendo módulos y permite pasar a PostgreSQL si algún día hace falta. |
| Tipos comunes | Carpeta `shared/` | Los modelos (tarea, receta, gasto…) se definen una vez y los usan frontend y backend. |
| Tareas programadas | `@nestjs/schedule` | Tareas recurrentes, recordatorios y avisos de cumpleaños. |
| Notificaciones | Web Push (PWA) | Avisos en móvil y PC sin tienda de apps. Requiere HTTPS. |
| Fotos | Archivos en un volumen de Docker | Fotos de platos y documentos de garantías. |

**Estructura del repositorio**

```
gestion-hogar/
├── frontend/     Angular: un módulo de rutas por cada módulo de la app
├── backend/      NestJS: un módulo Nest por cada módulo de la app
├── shared/       tipos y constantes comunes
└── docs/         este documento y otros
```

## 5. Despliegue y seguridad

- **Servidor:** Beelink de casa, con Docker y Portainer. Un único contenedor sirve la web y la API (`/api`).
- **Acceso exterior:** **Cloudflare Tunnel** hacia `hogar.kaitzlab.com`. No se abren puertos en el router y el HTTPS es automático.
- **Login:** contraseñas cifradas (argon2), sesión de 30 días en cookie `HttpOnly` y `Secure` (en la base de datos solo se guarda el hash del token), límite de intentos fallidos por correo e IP y de registros por IP.
- **Acceso a datos:** todas las rutas de un módulo cuelgan de `/api/households/:householdId/…` y un guard comprueba que el usuario es miembro de esa casa. A quien no lo es se le responde como si la casa no existiera.
- **Capa extra opcional:** Cloudflare Access delante de la app.
- **Copias de seguridad:** copia automática diaria de la base de datos y de las fotos, guardando varias versiones.

## 6. Hoja de ruta

Cada fase deja algo que ya se puede usar.

| Fase | Contenido |
|------|-----------|
| 1 | **Base + Tareas + Ideas:** login, hogar, navegación, Prisma y migraciones, tablero de tareas con asignación, módulo de ideas con paso a tarea, despliegue en `hogar.kaitzlab.com`. |
| 2 | **Tareas recurrentes y notificaciones:** frecuencias, proceso programado, PWA instalable y avisos push. |
| 3 | **Lista de la compra.** |
| 4 | **Recetas y menús**, conectados con la compra. |
| 5 | **Gastos y facturas.** |
| 6 | **Calendario**, con cumpleaños. |
| 7 | **Inventario y mantenimiento.** |

## 7. Estado actual

**Fase 1 en curso.**

- Hecho: estructura del repositorio con npm workspaces (`shared/`, `backend/`, `frontend/`), Prisma 7 con SQLite, navegación entre módulos (barra lateral en PC y barra inferior en móvil). El prototipo de tablero inicial se ha eliminado.
- Hecho: usuarios y casas (registro, login, varias casas por persona, administradores, invitaciones y selector de casa activa).
- Siguiente: el tablero de Tareas, el módulo de Ideas y el despliegue en `hogar.kaitzlab.com`.

## 8. Decisiones tomadas

| Fecha | Decisión |
|-------|----------|
| 2026-10-28 | Frontend en Angular, backend en NestJS, base de datos SQLite con Prisma. |
| 2026-10-28 | Acceso desde fuera por `hogar.kaitzlab.com` con Cloudflare. |
| 2026-10-28 | Ideas como módulo separado de Tareas; las ideas aceptadas pasan a tareas. |
| 2026-10-28 | Recetas con tipo de plato, duración por tramos y minutos opcionales; menú semanal opcional. |
| 2026-10-28 | El calendario incluye cumpleaños. |
| 2026-10-29 | Registro abierto. Cada persona puede estar en varias casas, con rol de administrador o miembro en cada una. Sustituye a la decisión inicial de registro cerrado y un único hogar. |
| 2026-10-29 | Repositorio con npm workspaces y un único `package-lock.json`. `shared/` es el paquete `@hogar/shared`. |
| 2026-10-29 | Estados, prioridades y categorías se guardan como texto y se validan con las constantes de `@hogar/shared`. Las categorías son texto libre con sugerencias. |
| 2026-10-29 | Se mantienen Angular 20 y NestJS 11 por ahora. La subida a Angular 22 y NestJS 12 se hará como paso aparte. |
