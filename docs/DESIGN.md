# Gestión del Hogar: documento de diseño

Referencia del proyecto a largo plazo. Recoge qué es la aplicación, cómo está construida y en qué orden se desarrolla. Se actualiza cuando se toman decisiones nuevas; los módulos de fases futuras se detallan al llegar a ellas.

## 1. Objetivo

Una aplicación web para organizar la casa en un solo sitio: tareas, ideas, compra, comidas, gastos, fechas importantes y mantenimiento.

- **Usuarios:** las personas que viven en una casa. Cada persona tiene su cuenta y puede estar en varias *casas* a la vez (por ejemplo, la suya y la de sus padres).
- **Dispositivos:** PC y móvil. En el móvil se instala como app (PWA) y recibe notificaciones.
- **Acceso:** desde casa y desde fuera, en un subdominio propio (por ejemplo `https://hogar.tudominio.com`).

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
- **Foto de perfil:** cada uno pone la suya en *Tu cuenta* (y la cambia o la quita). El navegador la recorta en cuadrado y la reduce a 256 px antes de subirla. Sale en el círculo donde estaban sus iniciales: tarjetas, calendario, comentarios, gastos, miembros y el menú. Sin foto siguen las iniciales con su color. Solo la ven las personas con las que comparte casa. Se guarda con las fotos de las recetas, así que entra en la copia diaria.
- **Con Google:** entrar con Google crea la cuenta si no existe (sin contraseña). Si ya hay una cuenta con contraseña y el mismo correo, no se une sola, porque el registro no verifica correos y otra persona podría haberla creado. Se conecta desde *Tu cuenta* con la sesión iniciada. Se puede desconectar si la cuenta tiene contraseña.
- **Casas:** cualquiera puede crear las que quiera. Al registrarse sin invitación se pide crear la primera.
- **Color de cada persona:** cada miembro tiene un color en cada casa, de una paleta de 10 (la de las etiquetas de Trello). Al entrar recibe el primero libre. Cada uno cambia el suyo desde *Casa → Miembros*; los administradores, el de cualquiera.
- **Roles por casa:** *administrador* o *miembro*. Una misma persona puede ser administradora en una casa y miembro en otra.
- **Administradores:** cambian el nombre de la casa, invitan, sacan a miembros y nombran o quitan administradores.
- **Invitaciones:** enlace de un solo uso que caduca en 7 días y se puede anular. Quien lo abre sin cuenta puede registrarse y vuelve a la invitación para aceptarla.
- **Salir de una casa:** cualquiera puede salir. El último administrador no puede salir mientras queden otros miembros; antes tiene que nombrar a otro. Si sale el último miembro, la casa se borra. Al salir o ser expulsado, deja de estar asignado a las tareas de esa casa.
- **Secciones de cada casa:** en *Casa → Secciones* los administradores eligen qué usa la casa (Tareas, Ideas, Compra, Gastos y facturas, Recetas…). Lo que se desmarca se oculta para todos: sale de la navegación, sus rutas de la API responden como si no existieran y se dejan de enviar sus avisos (y, en Tareas, de crear las recurrentes). No se borra nada, por si se vuelve a mostrar. Una casa nueva trae Inventario y Mantenimiento desactivados (se activan aquí cuando se quieran); el resto, activado. *Casa* siempre se ve. Al entrar se va a la primera sección que use la casa. Para no dejar nada a medias, sin Tareas no se puede aceptar una idea y sin Compra las recetas no ofrecen "Añadir a la compra".
- **Tema:** claro, oscuro o el del sistema, desde *Tu cuenta → Este dispositivo*. Se guarda en cada dispositivo (no en la cuenta), así el móvil y el PC pueden tener uno distinto.
- **Moderación de recetas públicas:** los moderadores de la app son los correos de `MODERATOR_EMAILS` en el servidor (separados por comas); nadie se hace moderador desde la app. En las recetas públicas de otras casas ven un panel con la casa de la que es y estas acciones, con un motivo (rápido o escrito) que se avisa a todos los de esa casa (aviso que llega siempre): *quitar de públicas* (pasa a privada de su casa, no se borra), *quitar la foto*, *borrar la receta* e *impedir que esa casa publique* (sus públicas pasan a privadas y ya no puede publicar; se deshace en *Tu cuenta → Moderación*). No ven nada privado de las demás casas. Más adelante: que cualquiera pueda denunciar una receta pública y una página de Moderación con las denuncias y las últimas publicadas.
- **Tu cumpleaños** (*Tu cuenta → Perfil*, solo día y mes): ese día salen globos en tu foto, para ti y para los de tus casas (en *Casa → Miembros*, con «¡Hoy es su cumpleaños!», y en el calendario), y junto al nombre de la app te saluda «¡Feliz cumpleaños!» en vez del adorno de la fiesta. Quien nació un 29 de febrero los tiene el 28 los años no bisiestos. Los globos salen aunque se quiten los adornos de fiestas. Ese cumpleaños sale también en la pestaña *Cumpleaños* (con su foto y «De la casa»; tocándolo se va a *Tu cuenta* si es el tuyo, o a *Casa*), en el aviso de las 9:00 (a quien cumple le llega «¡Feliz cumpleaños!») y cada año en el calendario de sus casas («Cumpleaños de Ana», con su foto; lleva a *Casa*), sin apuntarlo en *Cumpleaños* (si ya está apuntado ahí con el mismo nombre, no sale dos veces).
- **Adornos de fiestas:** unos días antes de cada fiesta y el mismo día sale un dibujo junto al nombre de la app (PC) o de la casa (móvil), que saluda al pasar por encima: calabaza en Halloween (24–31 oct), pavo en Acción de Gracias (de miércoles a domingo), árbol en Navidad (18–30 dic), fuegos en Año nuevo (31 dic–1 ene), corona en Reyes (2–6 ene), corazón en San Valentín (12–14 feb), antifaz en Carnaval (de jueves lardero a martes), trébol en San Patricio (15–17 mar), huevo en Pascua (de Domingo de Ramos a Lunes de Pascua), hoguera en la Noche de San Juan (22–24 jun; la noche es la del 23), pañuelo rojo en San Fermín (6–14 jul, del chupinazo al «Pobre de mí») la concha del Camino en Santiago (24–25 jul), marmota el Día de la Marmota (2 feb), farolillo en el Año Nuevo Chino (del día antes a dos días después; las fechas van en una tabla hasta 2040 y el saludo dice el animal del año), tarta con π el Día de Pi (14 mar), rosa en Sant Jordi (22–23 abr), espadas de luz el Día de Star Wars (4 may, «May the 4th be with you»), jarra de cerveza en Oktoberfest (del sábado de inicio al primer domingo de octubre, o el 3), calavera de azúcar el Día de Muertos (1–2 nov), y el día que empieza cada estación: flor (primavera), sol (verano), hoja (otoño) y copo de nieve (invierno), con el equinoccio o solsticio calculado en la hora del dispositivo. Y días con gracia: monigote de papel el Día de los Inocentes (28 dic), gato naranja el Día del Gato (8 ago), perro el Día del Perro (26 ago), tableta el Día del Chocolate (13 sep), dado de 20 caras el Día del Orgullo Friki (25 may), Poké Ball el Día de Pokémon (27 feb, «¡Hazte con todos!»), seta el Día de Mario (10 mar, MAR10), rana el 29 de febrero (solo los bisiestos) y gato negro cada viernes 13. Si coinciden dos fiestas, sale la más corta (un viernes 13 pierde frente a otro día especial) (el día que empieza el otoño, la hoja aunque sea Oktoberfest). En el calendario se marca el día de la fiesta. Dibujos propios (SVG), iguales en todos los dispositivos. Se quitan en *Tu cuenta → Este dispositivo → Adornos de fiestas* (en cada dispositivo).
- **Formularios:** los campos obligatorios llevan un * rojo junto a su etiqueta; los opcionales no llevan nada. Un campo mal rellenado (obligatorio vacío, un número fuera de rango, un correo sin @…) se pone en rojo, también con el foco, en cuanto se toca o se intenta guardar; al abrir el formulario no sale nada en rojo.
- **Casa activa:** se elige en un selector (barra lateral en PC, barra superior en móvil) y se recuerda en el navegador.
- **Botón de Casa** (los ajustes): no va con las secciones. En el móvil está en la barra de arriba, a la izquierda de la campanita; en el PC, abajo, junto a tu nombre.
- **Tu cuenta** (`/cuenta`): se abre tocando tu nombre abajo (PC) o tu foto arriba a la derecha (móvil). Lleva lo que es de la persona y vale para todas sus casas: foto y nombre; contraseña (pide la actual; si la cuenta solo tenía Google, se pone una nueva) y, al cambiarla, se cierra la sesión en los demás dispositivos; conectar o desconectar Google; cerrar la sesión en los demás dispositivos o en este; qué avisos recibes; y *Este dispositivo* (tema, avisos push, instalar). En *Casa* queda solo lo de la casa. Tu foto sin imagen lleva tu color en la casa activa.

### 3.1 Tareas

- **Tres pestañas, en este orden:** *Personales* (`/tareas`, la que se abre al entrar), las tuyas, que solo ves tú; *Del hogar* (`/tareas/hogar`), las de la casa, que ven todos sus miembros; e *Ideas* (`/tareas/ideas`, ver 3.2). Ideas ya no tiene entrada propia en el menú; si una casa oculta las tareas pero usa las ideas, «Tareas» lleva a ellas. Los dos tableros funcionan igual (columnas, prioridad, fecha, categoría). Una tarea personal no se asigna a nadie más: es de quien la crea y lleva su color. Tampoco pasa de una pestaña a la otra.
- **Personales:** salen en tu calendario y en tu recordatorio de las 9:00, nunca en los de los demás. Si sales de una casa, se borran tus personales de esa casa. Las recurrentes son solo del hogar.
- **Columnas:** Por hacer, En curso y Hecho. Se mueven arrastrando, también en el móvil.
- **Campos:** título, notas, prioridad, fecha límite (opcional), personas asignadas (ninguna, una o varias) y categoría (por ejemplo Casa, Recados o Papeleo) para filtrar.
- **Tarjetas:** el lateral lleva el color de la persona asignada; si hay varias, se reparte a partes iguales entre sus colores (con dos, mitad y mitad). Sin nadie asignado, el lateral es gris. La prioridad se ve en su etiqueta.
- **Comentarios:** al abrir una tarea o una idea, debajo de sus campos sale la conversación (del más antiguo al más reciente) y una caja para escribir (Ctrl+Intro también envía). La tarjeta enseña 💬 con cuántos tiene. Cada uno borra los suyos; un administrador, cualquiera. Al comentar se avisa a quien la creó o propuso, a sus personas asignadas y a quien ya había comentado (salvo a quien escribe y a quien ya no está en la casa); el aviso abre la tarea o la idea con sus comentarios. En una tarea personal solo comenta su dueño y no avisa a nadie.
- **Orden:** dentro de cada columna, primero por prioridad y luego por antigüedad. Las tareas vencidas se marcan.
- **Archivar:** al pasar a Hecho se apunta cuándo. A los 7 días en Hecho se archivan solas (cada noche a las 00:05 y al arrancar el servidor), para que el tablero no se llene. Se pueden archivar antes a mano: una desde su diálogo o todas las hechas del tablero con *Archivar todas*. En *Ver archivadas* (al pie de Hecho) se recuperan, y vuelven a Hecho con la semana de nuevo, o se borran. Sacar una tarea de Hecho la deja sin fecha de hecha.
- **Lista dentro de una tarea:** cosas que tachar («Limpiar la cocina»: horno, nevera, campana…), hasta 30. La tarjeta enseña cuántas van (☑ 2/5, en verde cuando están todas). Tachar se guarda al momento y solo cambia esa cosa, así dos personas pueden ir tachando a la vez sin pisarse; añadir, cambiar el texto o quitar se guarda con *Guardar*.
- **Tareas recurrentes:** una plantilla (título, notas, prioridad, personas, categoría y lista) más una frecuencia: cada N días, semanas o meses, o ciertos días de la semana. Se gestionan en *Tareas → Del hogar → Recurrentes*.
  - **Fecha de inicio:** en semanas y meses marca el ritmo (el mismo día de la semana o del mes; si el mes no tiene ese día, el último).
  - **Cuándo se crean:** cada noche a las 00:01 (y al arrancar el servidor) se crean las que tocan ese día, con ese día como fecha límite. Si se crea una que empieza hoy, su tarea aparece ya.
  - **Sin duplicados:** si la tarea anterior de la misma plantilla sigue sin hacer, ese día se salta. Si el servidor estuvo apagado varios días, se crea una sola tarea, no una por día perdido.
  - **Pausar:** una plantilla en pausa no crea tareas; al reactivarla sigue desde hoy, sin recuperar lo perdido.
  - Las tareas creadas llevan el icono ↻ en el tablero. Borrar la plantilla no borra las tareas que ya creó.

### 3.1b Avisos y app instalable

- **App instalable (PWA):** manifiesto, iconos y un service worker. Se instala desde el menú del navegador o desde *Tu cuenta → Este dispositivo*; en iPhone, con Compartir → Añadir a pantalla de inicio. El service worker guarda la app y lo que necesita la compra para usarla sin conexión (ver 3.3), pero siempre pide primero a la red: lo guardado solo se usa cuando no hay conexión, así nunca se queda una versión vieja. Al arrancar se descargan todas las secciones para que también se puedan abrir sin conexión.
- **Avisos push:** cada persona los activa en cada dispositivo desde *Tu cuenta → Este dispositivo*, donde también puede mandarse uno de prueba. En iPhone y iPad solo funcionan con la app instalada (iOS 16.4 o posterior).
  - **Recordatorio diario a las 9:00:** un aviso por casa con las tareas sin hacer que vencen ese día o ya han vencido. Las asignadas le llegan a quien las tiene; las sin asignar, a toda la casa.
  - **Al asignar una tarea:** aviso a quien acaba de entrar en ella, salvo a quien la asigna.
  - Tocar un aviso abre la página en la casa que corresponde (`?casa=`), aunque la activa fuera otra.
- **Qué avisos recibes** (*Tu cuenta*): cada persona activa o desactiva cada tipo: tareas que te asignan, comentarios, tareas pendientes, calendario y cumpleaños, facturas y revisiones. Es de la persona, para todos sus dispositivos y la campanita: lo desactivado no le llega por ningún sitio. Por defecto, todos activados. El aviso de prueba llega siempre.
- **Campanita:** cada aviso que manda la app (tareas asignadas, recordatorios de las 9:00, facturas, calendario, mantenimiento y el de prueba) queda guardado para su destinatario, tenga o no push en ese dispositivo. La campanita va arriba (en el móvil, en la barra de la casa; en el PC, junto al nombre de la app) con el número de no leídos. Al tocar un aviso se abre su página y queda leído; también se pueden marcar todos. Para quitar uno se desliza hacia un lado (en el PC, con la × al pasar el ratón), y «Borrar leídos» quita todos los ya leídos. Son de la persona, de todas sus casas. Se miran al abrir la app, cada minuto y al volver a ella, y se guardan 60 días.
- **Claves VAPID:** el servidor las genera la primera vez y las guarda en la base de datos; no hay nada que configurar. Al cerrar sesión se quitan los avisos de ese dispositivo.

### 3.2 Ideas

- Es la tercera pestaña de *Tareas*. Se puede ocultar por separado en *Casa → Secciones*.
- **Campos:** título, descripción, categoría (casa, viaje, compra grande, proyecto…), quién la propone y fecha.
- **Estados:** Nueva, En valoración, Aceptada y Descartada.
- **Aceptar:** se elige la prioridad y a qué tareas va: *Del hogar* (la opción de siempre) o *Personales*, las de quien la acepta, que solo verá esa persona (los demás ven «En las tareas personales de…»). Se crea una tarea en «Por hacer» con el título, la descripción (como notas) y la categoría de la idea, que queda enlazada a ella. Una idea aceptada ya no cambia de estado; si su tarea se borra, la idea sigue como aceptada.
- **Comentarios:** como en las tareas (ver 3.1). Se quedan en la idea al aceptarla.
- **Descartar:** las descartadas se archivan en su pestaña y se pueden recuperar. Borrar una idea solo pueden hacerlo quien la propuso o un administrador.

### 3.3 Lista de la compra

- **Una lista por casa**, compartida. Mientras está abierta se actualiza sola cada pocos segundos, para que dos personas puedan comprar a la vez cada una con su móvil.
- **Artículo:** nombre, cantidad en texto libre ("2", "1 kg", "una caja grande") y sección. Añadir algo que ya está en la lista no lo repite: si estaba en el carro vuelve a pendiente y, si se indica cantidad, se cambia.
- **Secciones fijas**, en el orden en que se muestran: Fruta y verdura, Carne y pescado, Lácteos y huevos, Panadería, Despensa, Congelados, Bebidas, Limpieza, Higiene y Otros. La primera vez se adivina por el nombre (leche → Lácteos y huevos); si se cambia a mano, se recuerda para la próxima.
- **Comprado:** se marca con un toque y pasa, tachado, a *En el carro*. Se puede desmarcar. *Quitar comprados* los quita todos al terminar.
- **Habituales:** cada producto añadido se guarda con su sección y su última cantidad. Los más comprados aparecen como botones para añadirlos con un toque y, al escribir, se sugieren los que coinciden (salvo los que ya están en la lista). Un producto mal escrito se puede olvidar desde las sugerencias.
- **Sin conexión** (en el súper sin cobertura): la app abre y enseña la última lista guardada, con un aviso de que no hay conexión y de cuándo es. Lo que se tache se guarda en el móvil (aunque se cierre la app) y se envía solo al volver la conexión. Añadir, editar o quitar artículos necesita conexión. Con conexión siempre se usa lo último del servidor; lo guardado solo cuando la red no responde (o tarda más de 5 s). Al cerrar sesión se borra lo guardado.

### 3.4 Recetas y menús

**Plato / receta**

- **Nombre** y **foto** (opcional).
- **Tipo:** primer plato, segundo plato, plato único o postre.
- **Duración:** rápido, medio o largo, siempre presente. Además, **minutos exactos** opcionales.
- **Raciones** para las que está pensada; las cantidades se escalan al cambiarlas.
- **Ingredientes:** nombre, cantidad y unidad (g, kg, ml, l, unidades; por defecto, unidades) o texto libre ("al gusto").
- **Pasos** ordenados.
- **Privada** (casilla, sin marcar por defecto). Si no es privada, es pública: la ven todas las casas de la app.

**Menú semanal (opcional)**

- Vista de la semana con comida y cena por día para elegir platos: una receta del recetario o un plato escrito a mano ("Pizza fuera", "Sobras"), que no necesita receta (se le puede cambiar el nombre; no lleva raciones ni ingredientes).
- **Mostrar en el calendario** (interruptor del menú, de la casa, lo cambia cualquiera): los platos salen en el calendario. Por defecto, sí. Los escritos a mano llevan al menú al tocarlos.
- No es obligatorio usarlo: el recetario funciona por sí solo.
- Botón "Añadir a la compra": suma los ingredientes de los platos con receta de la semana (una sola línea por ingrediente repetido) y los pasa a la lista.

**Cómo funciona**

- **Varios platos por comida:** cada hueco (día y comida o cena) admite varios platos, cada uno con sus raciones.
- **Cantidades:** número con unidad (g, kg, ml, l, ud.) o un texto ("al gusto"). Al cambiar las raciones se multiplican; en la ficha se ven con decimales (1,5 ud.) y en la compra las unidades se redondean hacia arriba.
- **Añadir a la compra** (desde una receta o desde la semana): se ve antes la lista de ingredientes para desmarcar lo que ya hay en casa; los que no llevan cantidad ("sal al gusto") salen desmarcados. Las cantidades de la misma magnitud se suman (500 g + 1 kg = 1,5 kg), también con lo que ya estuviera pendiente en la lista; si no se pueden sumar, se juntan ("6 bricks + 1 l").
- **Fotos:** el navegador las reduce a 1600 px de lado antes de subirlas. Se guardan como archivos en `PHOTOS_DIR` (por defecto, junto a la base de datos) y entran en la copia diaria.
- Borrar una receta la quita también del menú.
- **Recetas de la casa:** cualquier miembro puede editar o borrar las recetas de su casa, las apuntara quien las apuntara. Filtros: *Todas*, *Favoritas*, *Mías* (las que apuntaste tú), *De esta casa* y *De otras casas*.
- **Favoritas de la casa:** la estrella de una receta (también de una pública de otra casa) la marca como favorita para toda la casa; en la ficha se ve quién la marcó. Cualquiera puede quitarla. Cada casa tiene sus favoritas. Si una receta de otra casa se hace privada o se borra, deja de verse, también en favoritas.
- **Recetas de otras casas:** el recetario enseña también las públicas de las demás casas (de las que usan Recetas), con quién la apuntó y un filtro *De esta casa / De otras casas*. Se pueden ver y pasar a la compra, pero no cambiar ni poner en el menú. *Guardar en mi recetario* hace una copia (con foto) que ya es de la casa: se puede editar y usar en el menú. La copia empieza privada para que no salga repetida en las demás casas. Si la casa de origen la hace privada o la borra, deja de verse fuera, pero las copias se quedan.

### 3.5 Gastos y facturas

- **Opcional por casa**, como las demás secciones (ver 3.0): útil en una casa donde no se llevan cuentas.
- **Gasto:** concepto, importe, fecha, quién pagó, entre quiénes se reparte (por defecto, toda la casa), categoría con sugerencias (Supermercado, Casa, Facturas, Ocio…) y notas. Importes en céntimos.
- **Reparto:** a partes iguales; los céntimos que sobran van a los primeros por orden de llegada a la casa (10 € entre 3 = 3,34 + 3,33 + 3,33). El reparto se guarda con el gasto, así que no cambia si luego entra o sale alguien.
- **Saldos:** lo que pagó cada uno menos lo que le toca, contando los pagos entre personas. Debajo, los pagos mínimos para quedar en paz ("Ana → Luis 12,30 €") con un botón *Saldar* que apunta el pago. Quien se va de la casa con saldo pendiente sigue saliendo.
- **Facturas fijas:** nombre, importe aproximado, cada cuántos meses y próximo vencimiento. *Pagar* crea su gasto (categoría Facturas) y la pasa a la siguiente fecha. Las que vencen en los próximos 3 días o ya vencieron entran en el aviso de las 9:00, a toda la casa.
- **Resumen del mes:** total, por categoría y, por persona, lo que pagó y lo que le tocaba.

### 3.6 Calendario

- **Vista de mes y de semana** con lo que tiene fecha en las secciones que use la casa: tareas con fecha límite, las próximas veces de las tareas recurrentes, platos del menú y vencimientos de facturas (también los de los meses siguientes). Cada cosa lleva a su sección. En el mes, al tocar un día se ve su lista; en el móvil, cada día enseña puntos de colores (personas, casa, cada tipo y uno gris para mantenimiento y garantías).
- **Cumpleaños:** nombre, día y mes, y año si se sabe (para decir cuántos cumple). El aviso llega a todos el mismo día del cumpleaños, sin antelación que elegir. Se repiten cada año; el 29 de febrero, los años no bisiestos, cae el 28. Pestaña propia, del más cercano al más lejano.
- **Eventos** propios: título, día, hora opcional, fecha de fin si dura varios días, notas y de quién es: una o varias personas de la casa, o ninguna: entonces es para todos. Se pinta con el color de su persona; si es de varias, con los colores de todas en franjas y sus iconos; si es para todos, con el color de la casa (el oscuro de la app) y el icono de la casa. En el móvil, los puntos de cada día llevan esos colores.
- **Colores de lo que no es un evento** (tonos que no usa ninguna persona): cumpleaños en rosa oscuro, menú en naranja tostado, tareas en rojo intenso, recurrentes en lima, facturas en amarillo mostaza; mantenimiento y garantías, en gris. Sin iconos: debajo de cada cosa pone qué es. En el móvil, cada uno tiene su punto de color y el gris es uno solo.
- **Filtro por persona** (encima del calendario, si sois más de uno): «Todos» o una persona. Con una persona se ve lo suyo (eventos y tareas asignadas) y lo que es de toda la casa; no lo que es solo de los demás. Se recuerda en ese navegador.
- **Avisos:** los eventos con hora avisan **una hora antes** («Dentro de una hora · Dentista a las 17:00»; si se crean con menos margen, en cuanto se puede); los de todo el día, en el aviso de las 9:00. Siempre solo a sus personas (a toda la casa si no tienen). Cada evento avisa una vez; si se le cambia la hora, vuelve a avisar. Los cumpleaños de ese día, a las 9:00, a toda la casa. Quien sale de una casa deja de estar en sus eventos.
- Es una sección más: se puede ocultar en *Casa → Secciones*.

### 3.7 Inventario

- **Despensa y casa:** cada cosa con su sitio (Despensa, Nevera, Limpieza, Baño, Botiquín… o uno propio), cantidad con decimales, unidad opcional y un mínimo opcional. Con `+` y `−` se cambia la cantidad al momento. Se agrupa por sitio.
- **Se acaba:** lo que está en su mínimo o por debajo sale arriba, con un botón *Pasar a la compra* que lo añade a la lista (si la casa usa Compra); lo que ya está en la lista no se duplica.
- **Equipos y garantías:** electrodomésticos, aparatos o vehículos con marca, modelo, fecha de compra, fin de la garantía y notas. Se les adjuntan archivos (manual, factura, ticket): PDF o imagen JPG, PNG o WebP, hasta 20 MB. El tipo se comprueba por el contenido, no por el nombre, y se guardan con un nombre al azar en el volumen de datos. Entran en la copia diaria.
- El fin de la garantía sale en el calendario.

### 3.8 Mantenimiento

- **Revisión:** nombre (ITV, caldera, filtros…), grupo con sugerencias (Casa, Coche…), cada cuántos meses (o sin repetir), próxima fecha, con cuántos días de antelación avisar (por defecto 7) y notas.
- **Hecha:** se apunta la fecha, el coste opcional y notas. Queda en su historial y la próxima fecha pasa a esa fecha más su intervalo. Las entradas del historial se pueden borrar.
- **Estado:** vencida, toca pronto (dentro de sus días de aviso) o en orden, con el color en el borde de la tarjeta.
- **Avisos** a las 9:00, a toda la casa: cuando faltan sus días de aviso, el día que toca y, si sigue vencida, una vez por semana.
- Las próximas fechas salen en el calendario.

## 4. Arquitectura

| Parte | Tecnología | Por qué |
|-------|-----------|---------|
| Frontend | **Angular** (componentes standalone, signals) + Angular CDK | Elección del proyecto. CDK para arrastrar y soltar. |
| Backend | **NestJS** (TypeScript) | Mismo lenguaje que el frontend y misma forma de organizarse (módulos, servicios, inyección de dependencias). |
| Base de datos | **SQLite** con **Prisma** | Sobra para dos personas, es un único archivo fácil de copiar. Prisma da migraciones para ir añadiendo módulos y permite pasar a PostgreSQL si algún día hace falta. |
| Tipos comunes | Carpeta `shared/` | Los modelos (tarea, receta, gasto…) se definen una vez y los usan frontend y backend. |
| Tareas programadas | `@nestjs/schedule` | Tareas recurrentes, recordatorios y avisos de cumpleaños. |
| Notificaciones | Web Push (PWA) | Avisos en móvil y PC sin tienda de apps. Requiere HTTPS. |
| Fotos y documentos | Archivos en un volumen de Docker | Fotos de platos y documentos de los equipos (manuales, facturas). |

**Estructura del repositorio**

```
gestion-hogar/
├── frontend/     Angular: un módulo de rutas por cada módulo de la app
├── backend/      NestJS: un módulo Nest por cada módulo de la app
├── shared/       tipos y constantes comunes
└── docs/         este documento y otros
```

## 5. Despliegue y seguridad

- **Servidor:** un mini PC en casa, con Docker y Portainer. Un único contenedor sirve la web y la API (`/api`).
- **Acceso exterior:** **Cloudflare Tunnel** hacia el subdominio de la app. No se abren puertos en el router y el HTTPS es automático.
- **Login:** contraseñas cifradas (argon2), sesión de 30 días en cookie `HttpOnly` y `Secure` (en la base de datos solo se guarda el hash del token), límite de intentos fallidos por correo e IP y de registros por IP.
- **Acceso a datos:** todas las rutas de un módulo cuelgan de `/api/households/:householdId/…` y un guard comprueba que el usuario es miembro de esa casa. A quien no lo es se le responde como si la casa no existiera.
- **Capa extra opcional:** Cloudflare Access delante de la app.
- **Copias de seguridad:** copia automática diaria de la base de datos, las fotos y los documentos, guardando varias versiones.

## 6. Hoja de ruta

Cada fase deja algo que ya se puede usar.

| Fase | Contenido |
|------|-----------|
| 1 | **Base + Tareas + Ideas:** login, hogar, navegación, Prisma y migraciones, tablero de tareas con asignación, módulo de ideas con paso a tarea, despliegue en un dominio propio. |
| 2 | **Tareas recurrentes y notificaciones:** frecuencias, proceso programado, PWA instalable y avisos push. |
| 3 | **Lista de la compra.** |
| 4 | **Recetas y menús**, conectados con la compra. |
| 5 | **Gastos y facturas.** |
| 6 | **Calendario**, con cumpleaños. |
| 7 | **Inventario y mantenimiento.** |

## 7. Estado actual

**Fases 1 a 7 hechas: toda la hoja de ruta.** La app está en uso en producción.

- Hecho: estructura del repositorio con npm workspaces (`shared/`, `backend/`, `frontend/`), Prisma 7 con SQLite, navegación entre módulos (barra lateral en PC y barra inferior en móvil). El prototipo de tablero inicial se ha eliminado.
- Hecho: usuarios y casas (registro, login, varias casas por persona, administradores, invitaciones y selector de casa activa).
- Hecho: tablero de Tareas (columnas con arrastrar y soltar, prioridad, fecha límite con marca de vencida, asignación a miembros, categoría con sugerencias, filtros por persona, categoría y prioridad).
- Hecho: módulo de Ideas (pestañas Abiertas, Aceptadas y Descartadas; valorar, aceptar con prioridad creando la tarea enlazada, descartar y recuperar).
- Hecho: copia de seguridad diaria de la base de datos (VACUUM INTO a las 03:30, últimas 14) y guía de despliegue en [`DESPLIEGUE.md`](DESPLIEGUE.md).
- Hecho: acceso con Google (OpenID Connect con PKCE), opcional según la configuración del servidor.
- Hecho: publicada en producción (cierra la fase 1). El acceso con Google aún no está configurado en producción.
- Hecho: colores por persona, varias personas por tarea, tema claro u oscuro y paleta inspirada en Trello.
- Hecho (fase 2): tareas recurrentes, app instalable y avisos push (recordatorio diario y al asignar).
- Hecho (fase 3): lista de la compra compartida, con secciones, habituales y sincronización entre móviles.
- Hecho (fase 4): recetario con fotos, raciones escalables y menú semanal, conectados con la compra. Las fotos entran en la copia diaria.
- Hecho (fase 5): gastos repartidos, saldos y pagos para quedar en paz, facturas fijas con aviso y resumen del mes.
- Hecho: cada casa elige qué secciones usa (los administradores, en *Casa → Secciones*).
- Hecho (fase 6): calendario de mes y semana con lo de las demás secciones, cumpleaños y eventos, con avisos.
- Hecho (fase 7): inventario con aviso de lo que se acaba y paso a la compra, equipos con garantía y archivos adjuntos, y revisiones de mantenimiento con historial y avisos. En el móvil, si hay más de cinco secciones, las que no caben van a un menú *Más*.

## 8. Decisiones tomadas

| Fecha | Decisión |
|-------|----------|
| 2026-10-28 | Frontend en Angular, backend en NestJS, base de datos SQLite con Prisma. |
| 2026-10-28 | Acceso desde fuera por un subdominio propio con Cloudflare. |
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
| 2026-10-29 | Gastos: reparto a partes iguales guardado con cada gasto; saldos y pagos mínimos para quedar en paz; facturas fijas cada N meses. |
| 2026-10-29 | Calendario: no copia datos de las otras secciones, los junta al pedirlos (una sola ruta de la API). Eventos y cumpleaños son suyos. |
| 2026-10-29 | Cada casa elige qué secciones usa. Se guarda la lista de las ocultas, así que una sección nueva aparece visible en todas las casas. Ocultar no borra datos. |
| 2026-10-29 | Compra: una lista por casa, secciones fijas (adivinadas y luego recordadas por producto), lo comprado se queda en el carro hasta quitarlo y los habituales salen solos de lo ya comprado. Se sincroniza consultando al servidor cada pocos segundos. |
| 2026-10-29 | Inventario: cantidades con decimales y un mínimo por cosa; lo que se acaba se pasa a la compra con un botón, no de forma automática. |
| 2026-10-29 | Archivos de los equipos: PDF o imagen de hasta 20 MB, subidos tal cual (sin multipart) y comprobados por su contenido. Se guardan en `data/files` con un nombre al azar. |
| 2026-10-29 | Mantenimiento: intervalo en meses; al marcarla hecha, la próxima fecha se cuenta desde el día en que se hizo. |
| 2026-10-29 | Recetas públicas por defecto: todas las casas ven las que no están marcadas como privadas, sin poder cambiarlas. Para usarlas en el menú se copian a la casa. |
| 2026-10-29 | Tareas personales: viven en la misma casa y el mismo tablero, en su propia pestaña, pero solo las ve quien las crea. |
| 2026-10-30 | Las tareas hechas se archivan solas a los 7 días (o antes, a mano) y se pueden recuperar. |
| 2026-10-30 | Tareas con tres pestañas: Personales (la primera), Del hogar e Ideas. Ideas deja de tener entrada propia en el menú. |
| 2026-11-12 | Los eventos del calendario pueden ser de una o varias personas; el aviso les llega solo a ellas. |
| 2026-11-12 | Recetas favoritas por casa: las marca cualquiera y las ve toda la casa. |
| 2026-11-12 | Campanita de avisos: se guarda cada aviso que se manda (en el mismo sitio que el push), 60 días. |
| 2026-11-13 | Comentarios en tareas e ideas, con aviso a quien está metido en la tarjeta. |
| 2026-11-13 | Al aceptar una idea se elige si la tarea va al hogar o a las personales de quien la acepta. |
| 2026-11-13 | Cumpleaños: el aviso llega a todos el mismo día; se quita elegir la antelación. |
| 2026-11-13 | Foto de perfil de cada persona, en el mismo círculo que sus iniciales. |
| 2026-11-13 | Formularios: * en los obligatorios (sin «opcional») y en rojo lo que está mal. |
| 2026-11-13 | Listas dentro de las tareas (y en las plantillas de las recurrentes); tachar se guarda al momento, cosa a cosa. |
| 2026-11-13 | Cada persona elige qué tipos de aviso recibe; lo desactivado no llega ni al móvil ni a la campanita. |
| 2026-11-13 | Compra sin conexión: el service worker guarda la app y la última lista; lo tachado se envía al volver la conexión. |
| 2026-11-13 | Casas nuevas con Inventario y Mantenimiento desactivados; el botón de Casa pasa junto a la campanita (móvil) o junto a tu nombre (PC); los ingredientes nuevos van en unidades. |
| 2026-11-13 | *Tu cuenta* sale de *Casa* a su propia página, desde tu nombre (PC) o tu foto (móvil): foto, nombre, contraseña, Google, cerrar sesión en los demás dispositivos, avisos y este dispositivo. |
| 2026-11-13 | Calendario: cada evento con el color de su persona (varias: todos sus colores; nadie: de toda la casa). |
| 2026-11-13 | Menú: platos escritos a mano sin receta, e interruptor para que el menú salga o no en el calendario. |
| 2026-11-14 | Calendario: el color es de quién (personas o la casa) y el icono, de qué; lo demás va en gris. Filtro por persona. |
| 2026-11-14 | 15 colores para las personas (rosa y naranja más vivos; nuevos coral, fucsia, caramelo, índigo y turquesa). Los rosa y naranja de antes pasan a los cumpleaños y al menú del calendario. |
| 2026-11-14 | Calendario sin emojis: tareas en rojo intenso, recurrentes en lima y facturas en mostaza; mantenimiento y garantías en gris. Personas: amarillo más vivo y sin lima (quien lo tenía pasa a verde). |
| 2026-11-14 | Adornos de fiestas: un dibujo junto al nombre de la app los días de cada fiesta y el día marcado en el calendario; se quitan en cada dispositivo. |
| 2026-11-14 | Más fiestas con adorno: San Patricio, Noche de San Juan, San Fermín y Santiago. |
| 2026-11-14 | Más adornos: Oktoberfest, Sant Jordi, Día de Muertos, Año Nuevo Chino, Día de la Marmota, Star Wars, Día de Pi y el cambio de cada estación. |
| 2026-11-14 | Tu cumpleaños en la cuenta: ese día, globos en tu foto para ti y para los de tus casas. |
| 2026-11-14 | Los cumpleaños puestos en la cuenta salen en el calendario de la casa. |
| 2026-11-14 | Más días con adorno: Inocentes, Gato, Perro, Chocolate, Orgullo Friki, 29 de febrero y viernes 13. Dibujos rehechos con el estilo de los globos. |
| 2026-11-14 | Los cumpleaños de la cuenta salen también en la pestaña Cumpleaños y en el aviso del día. |
| 2026-11-14 | Los avisos de la campanita se quitan deslizándolos (o con la ×), y se pueden borrar todos los leídos. |
| 2026-11-14 | Los eventos con hora avisan una hora antes; los de todo el día y las tareas siguen a las 9:00. |
| 2026-11-14 | Moderación de recetas públicas: moderadores por MODERATOR_EMAILS; quitar de públicas, quitar foto, borrar e impedir publicar a una casa. |
