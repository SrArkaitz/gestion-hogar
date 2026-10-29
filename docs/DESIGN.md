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
| 1 | **Tareas** | Tablero con columnas, prioridad (alta, media, baja), fecha límite y personas asignadas. Incluye **tareas recurrentes** que se crean solas cada cierto tiempo. |
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

- **Cuenta:** nombre, correo y contraseña (mínimo 8 caracteres), o con Google. El registro está abierto a cualquiera.
- **Con Google:** entrar con Google crea la cuenta si no existe (sin contraseña). Si ya hay una cuenta con contraseña y el mismo correo, no se une sola, porque el registro no verifica correos y otra persona podría haberla creado. Se conecta desde *Casa → Cuenta* con la sesión iniciada. Se puede desconectar si la cuenta tiene contraseña.
- **Casas:** cualquiera puede crear las que quiera. Al registrarse sin invitación se pide crear la primera.
- **Color de cada persona:** cada miembro tiene un color en cada casa, de una paleta de 10 (la de las etiquetas de Trello). Al entrar recibe el primero libre. Cada uno cambia el suyo desde *Casa → Miembros*; los administradores, el de cualquiera.
- **Roles por casa:** *administrador* o *miembro*. Una misma persona puede ser administradora en una casa y miembro en otra.
- **Administradores:** cambian el nombre de la casa, invitan, sacan a miembros y nombran o quitan administradores.
- **Invitaciones:** enlace de un solo uso que caduca en 7 días y se puede anular. Quien lo abre sin cuenta puede registrarse y vuelve a la invitación para aceptarla.
- **Salir de una casa:** cualquiera puede salir. El último administrador no puede salir mientras queden otros miembros; antes tiene que nombrar a otro. Si sale el último miembro, la casa se borra. Al salir o ser expulsado, deja de estar asignado a las tareas de esa casa.
- **Tema:** claro, oscuro o el del sistema, desde *Casa → Cuenta*. Se guarda en cada dispositivo (no en la cuenta), así el móvil y el PC pueden tener uno distinto.
- **Casa activa:** se elige en un selector (barra lateral en PC, barra superior en móvil) y se recuerda en el navegador.

### 3.1 Tareas

- **Columnas:** Por hacer, En curso y Hecho. Se mueven arrastrando, también en el móvil.
- **Campos:** título, notas, prioridad, fecha límite (opcional), personas asignadas (ninguna, una o varias) y categoría (por ejemplo Casa, Recados o Papeleo) para filtrar.
- **Tarjetas:** el lateral lleva el color de la persona asignada; si hay varias, se reparte a partes iguales entre sus colores (con dos, mitad y mitad). Sin nadie asignado, el lateral es gris. La prioridad se ve en su etiqueta.
- **Orden:** dentro de cada columna, primero por prioridad y luego por antigüedad. Las tareas vencidas se marcan.
- **Tareas recurrentes:** una plantilla (título, notas, prioridad, personas, categoría) más una frecuencia: cada N días, semanas o meses, o ciertos días de la semana. Se gestionan en *Tareas → Recurrentes*.
  - **Fecha de inicio:** en semanas y meses marca el ritmo (el mismo día de la semana o del mes; si el mes no tiene ese día, el último).
  - **Cuándo se crean:** cada noche a las 00:01 (y al arrancar el servidor) se crean las que tocan ese día, con ese día como fecha límite. Si se crea una que empieza hoy, su tarea aparece ya.
  - **Sin duplicados:** si la tarea anterior de la misma plantilla sigue sin hacer, ese día se salta. Si el servidor estuvo apagado varios días, se crea una sola tarea, no una por día perdido.
  - **Pausar:** una plantilla en pausa no crea tareas; al reactivarla sigue desde hoy, sin recuperar lo perdido.
  - Las tareas creadas llevan el icono ↻ en el tablero. Borrar la plantilla no borra las tareas que ya creó.

### 3.1b Avisos y app instalable

- **App instalable (PWA):** manifiesto, iconos y un service worker. Se instala desde el menú del navegador o desde *Casa → Este dispositivo*; en iPhone, con Compartir → Añadir a pantalla de inicio. El service worker no guarda nada en caché: la app necesita conexión y así nunca se queda una versión vieja.
- **Avisos push:** cada persona los activa en cada dispositivo desde *Casa → Este dispositivo*, donde también puede mandarse uno de prueba. En iPhone y iPad solo funcionan con la app instalada (iOS 16.4 o posterior).
  - **Recordatorio diario a las 9:00:** un aviso por casa con las tareas sin hacer que vencen ese día o ya han vencido. Las asignadas le llegan a quien las tiene; las sin asignar, a toda la casa.
  - **Al asignar una tarea:** aviso a quien acaba de entrar en ella, salvo a quien la asigna.
  - Tocar un aviso abre la página en la casa que corresponde (`?casa=`), aunque la activa fuera otra.
- **Claves VAPID:** el servidor las genera la primera vez y las guarda en la base de datos; no hay nada que configurar. Al cerrar sesión se quitan los avisos de ese dispositivo.

### 3.2 Ideas

- **Campos:** título, descripción, categoría (casa, viaje, compra grande, proyecto…), quién la propone y fecha.
- **Estados:** Nueva, En valoración, Aceptada y Descartada.
- **Aceptar:** se elige la prioridad y se crea una tarea en «Por hacer» con el título, la descripción (como notas) y la categoría de la idea, que queda enlazada a ella. Una idea aceptada ya no cambia de estado; si su tarea se borra, la idea sigue como aceptada.
- **Descartar:** las descartadas se archivan en su pestaña y se pueden recuperar. Borrar una idea solo pueden hacerlo quien la propuso o un administrador.

### 3.3 Lista de la compra

- **Una lista por casa**, compartida. Mientras está abierta se actualiza sola cada pocos segundos, para que dos personas puedan comprar a la vez cada una con su móvil.
- **Artículo:** nombre, cantidad en texto libre ("2", "1 kg", "una caja grande") y sección. Añadir algo que ya está en la lista no lo repite: si estaba en el carro vuelve a pendiente y, si se indica cantidad, se cambia.
- **Secciones fijas**, en el orden en que se muestran: Fruta y verdura, Carne y pescado, Lácteos y huevos, Panadería, Despensa, Congelados, Bebidas, Limpieza, Higiene y Otros. La primera vez se adivina por el nombre (leche → Lácteos y huevos); si se cambia a mano, se recuerda para la próxima.
- **Comprado:** se marca con un toque y pasa, tachado, a *En el carro*. Se puede desmarcar. *Quitar comprados* los quita todos al terminar.
- **Habituales:** cada producto añadido se guarda con su sección y su última cantidad. Los más comprados aparecen como botones para añadirlos con un toque y, al escribir, se sugieren los que coinciden (salvo los que ya están en la lista). Un producto mal escrito se puede olvidar desde las sugerencias.

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

**Cómo funciona**

- **Varios platos por comida:** cada hueco (día y comida o cena) admite varios platos, cada uno con sus raciones.
- **Cantidades:** número con unidad (g, kg, ml, l, ud.) o un texto ("al gusto"). Al cambiar las raciones se multiplican; en la ficha se ven con decimales (1,5 ud.) y en la compra las unidades se redondean hacia arriba.
- **Añadir a la compra** (desde una receta o desde la semana): se ve antes la lista de ingredientes para desmarcar lo que ya hay en casa; los que no llevan cantidad ("sal al gusto") salen desmarcados. Las cantidades de la misma magnitud se suman (500 g + 1 kg = 1,5 kg), también con lo que ya estuviera pendiente en la lista; si no se pueden sumar, se juntan ("6 bricks + 1 l").
- **Fotos:** el navegador las reduce a 1600 px de lado antes de subirlas. Se guardan como archivos en `PHOTOS_DIR` (por defecto, junto a la base de datos) y entran en la copia diaria.
- Borrar una receta la quita también del menú.

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

**Fases 1 a 4 hechas.** La app está publicada en `https://hogar.kaitzlab.com`.

- Hecho: estructura del repositorio con npm workspaces (`shared/`, `backend/`, `frontend/`), Prisma 7 con SQLite, navegación entre módulos (barra lateral en PC y barra inferior en móvil). El prototipo de tablero inicial se ha eliminado.
- Hecho: usuarios y casas (registro, login, varias casas por persona, administradores, invitaciones y selector de casa activa).
- Hecho: tablero de Tareas (columnas con arrastrar y soltar, prioridad, fecha límite con marca de vencida, asignación a miembros, categoría con sugerencias, filtros por persona, categoría y prioridad).
- Hecho: módulo de Ideas (pestañas Abiertas, Aceptadas y Descartadas; valorar, aceptar con prioridad creando la tarea enlazada, descartar y recuperar).
- Hecho: copia de seguridad diaria de la base de datos (VACUUM INTO a las 03:30, últimas 14) y guía de despliegue en [`DESPLIEGUE.md`](DESPLIEGUE.md).
- Hecho: acceso con Google (OpenID Connect con PKCE), opcional según la configuración del servidor.
- Hecho: publicada en `hogar.kaitzlab.com` (cierra la fase 1). El acceso con Google aún no está configurado en producción.
- Hecho: colores por persona, varias personas por tarea, tema claro u oscuro y paleta inspirada en Trello.
- Hecho (fase 2): tareas recurrentes, app instalable y avisos push (recordatorio diario y al asignar).
- Hecho (fase 3): lista de la compra compartida, con secciones, habituales y sincronización entre móviles.
- Hecho (fase 4): recetario con fotos, raciones escalables y menú semanal, conectados con la compra. Las fotos entran en la copia diaria.
- Siguiente: fase 5, gastos y facturas.

## 8. Decisiones tomadas

| Fecha | Decisión |
|-------|----------|
| 2026-10-28 | Frontend en Angular, backend en NestJS, base de datos SQLite con Prisma. |
| 2026-10-28 | Acceso desde fuera por `hogar.kaitzlab.com` con Cloudflare. |
| 2026-10-28 | Ideas como módulo separado de Tareas; las ideas aceptadas pasan a tareas. |
| 2026-10-28 | Recetas con tipo de plato, duración por tramos y minutos opcionales; menú semanal opcional. |
| 2026-10-28 | El calendario incluye cumpleaños. |
| 2026-10-29 | Registro abierto. Cada persona puede estar en varias casas, con rol de administrador o miembro en cada una. Sustituye a la decisión inicial de registro cerrado y un único hogar. |
| 2026-10-29 | Acceso con Google además de correo y contraseña. Una cuenta con contraseña no se une sola a Google por coincidir el correo: se conecta desde la cuenta. |
| 2026-10-29 | Repositorio con npm workspaces y un único `package-lock.json`. `shared/` es el paquete `@hogar/shared`. |
| 2026-10-29 | Estados, prioridades y categorías se guardan como texto y se validan con las constantes de `@hogar/shared`. Las categorías son texto libre con sugerencias. |
| 2026-10-29 | Se mantienen Angular 20 y NestJS 11 por ahora. La subida a Angular 22 y NestJS 12 se hará como paso aparte. |
| 2026-10-29 | Una tarea puede tener varias personas asignadas; cada miembro tiene un color por casa. |
| 2026-10-29 | Tareas recurrentes: la tarea se crea el día que toca y vence ese día; si la anterior sigue sin hacer, no se duplica. |
| 2026-10-29 | Avisos: recordatorio diario a las 9:00 y aviso al asignar. Claves VAPID generadas por el servidor y guardadas en la base de datos. |
| 2026-10-29 | El service worker no usa caché: la app solo funciona con conexión. |
| 2026-10-29 | Recetas: ingredientes y pasos se guardan como JSON dentro de la receta. Las fotos se reducen en el navegador y se suben tal cual (sin multipart). Antes de pasar ingredientes a la compra se pueden desmarcar. |
| 2026-10-29 | Compra: una lista por casa, secciones fijas (adivinadas y luego recordadas por producto), lo comprado se queda en el carro hasta quitarlo y los habituales salen solos de lo ya comprado. Se sincroniza consultando al servidor cada pocos segundos. |
