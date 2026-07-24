# Requisitos — Mensajería directa en tiempo real

## Introducción

TalentFlow conecta tres roles (`freelancer`, `voluntario`, `reclutador`) a través de un tablero de
ofertas. Hoy el ítem "Mensajes" del sidebar existe pero no tiene pantalla propia (cae a
`DashboardPage`). Esta funcionalidad añade **mensajería directa 1:1 entre usuarios en tiempo real**,
como un módulo vertical aislado que reutiliza la infraestructura existente (autenticación JWT,
notificaciones in-app, correo, cliente `fetch`) sin modificar tablas ni módulos actuales.

El canal principal de tiempo real es **WebSockets (socket.io)**; REST se mantiene como fuente de
verdad para historial paginado y como fallback cuando el socket no está disponible.

### Objetivos
- Conversaciones directas 1:1 con entrega instantánea de mensajes.
- Bandeja de conversaciones con último mensaje, orden por actividad y contador de no leídos.
- Reutilizar el sistema de notificaciones in-app y de correos ya existente.
- Acoplamiento mínimo con archivos compartidos (`App.tsx`, `DashboardLayout.tsx`).

### Fuera de alcance (mejoras futuras)
- Grupos (el esquema queda preparado), adjuntos, recibos de lectura por mensaje, edición/borrado,
  búsqueda full-text, escalado multi-instancia del socket con adapter Redis.

### Decisiones tomadas
- **Modelo**: 1:1 ahora, con `conversations` + `conversation_members` + `messages` para extensibilidad.
- **Permisos**: cualquier usuario autenticado puede escribir a otro; autorización por membresía
  centralizada en una función (`assertMembership`) preparada para restringir por relación después.
- **Tiempo real**: WebSockets principal; REST fallback. Correo con throttling y solo si el receptor
  está inactivo.
- **Notificaciones**: se reutiliza `createNotification` con el tipo existente `system` (sin tocar el
  tipado ni el render de la campana).

---

## Requisitos

### Requisito 1 — Iniciar u obtener una conversación directa
**Historia:** Como usuario autenticado, quiero iniciar una conversación con otro usuario o reabrir la
existente, para poder comunicarme sin crear conversaciones duplicadas.

#### Criterios de aceptación
1. CUANDO un usuario solicita crear una conversación con un `recipientId` válido y no existe una
   previa ENTONCES el sistema DEBERÁ crear una conversación directa con ambos como miembros y
   devolverla.
2. CUANDO un usuario solicita crear una conversación con alguien con quien ya tiene una directa
   ENTONCES el sistema DEBERÁ devolver la conversación existente (idempotente, sin duplicar).
3. SI el `recipientId` es el propio usuario ENTONCES el sistema DEBERÁ rechazar con error en español.
4. SI el `recipientId` no existe ENTONCES el sistema DEBERÁ responder con un error en español.
5. MIENTRAS dos peticiones concurrentes intenten crear la misma conversación directa EL sistema
   DEBERÁ garantizar unicidad a nivel de base de datos (clave única del par).

### Requisito 2 — Listar conversaciones del usuario (bandeja)
**Historia:** Como usuario, quiero ver mis conversaciones ordenadas por actividad reciente con el
último mensaje y cuántas tengo sin leer, para priorizar a quién responder.

#### Criterios de aceptación
1. CUANDO un usuario solicita su bandeja ENTONCES el sistema DEBERÁ devolver solo las conversaciones
   en las que es miembro.
2. CUANDO se devuelve la bandeja ENTONCES cada entrada DEBERÁ incluir el otro participante, el último
   mensaje (o vacío) y el número de mensajes no leídos para ese usuario.
3. CUANDO existan varias conversaciones ENTONCES el sistema DEBERÁ ordenarlas por `last_message_at`
   descendente.
4. SI el usuario no tiene conversaciones ENTONCES el sistema DEBERÁ devolver una lista vacía (no error).

### Requisito 3 — Ver el historial de mensajes
**Historia:** Como usuario, quiero abrir una conversación y ver sus mensajes con carga incremental,
para revisar el historial sin penalizar el rendimiento.

#### Criterios de aceptación
1. CUANDO un usuario abre una conversación de la que es miembro ENTONCES el sistema DEBERÁ devolver
   los mensajes más recientes paginados (keyset por cursor).
2. CUANDO el usuario solicita más historial con un cursor ENTONCES el sistema DEBERÁ devolver la
   página anterior de mensajes.
3. SI el usuario NO es miembro de la conversación ENTONCES el sistema DEBERÁ responder 403 con error
   en español.
4. CUANDO se devuelven mensajes ENTONCES cada uno DEBERÁ incluir emisor, cuerpo y fecha, sin exponer
   campos internos.

### Requisito 4 — Enviar mensajes en tiempo real
**Historia:** Como usuario, quiero enviar un mensaje y que el receptor lo reciba al instante, para
conversar con fluidez.

#### Criterios de aceptación
1. CUANDO un usuario envía un mensaje con cuerpo válido a una conversación de la que es miembro
   ENTONCES el sistema DEBERÁ persistirlo y difundirlo por WebSocket a los miembros conectados en esa
   conversación.
2. CUANDO se persiste un mensaje ENTONCES el sistema DEBERÁ actualizar `last_message_at` de la
   conversación.
3. SI el cuerpo está vacío o excede el límite ENTONCES el sistema DEBERÁ rechazarlo con error en
   español y no persistir nada.
4. SI el WebSocket no está disponible en el cliente ENTONCES el envío DEBERÁ funcionar por REST
   (fallback) usando la misma lógica de servidor.
5. MIENTRAS un usuario supere el límite de envío configurado EL sistema DEBERÁ aplicar rate limit y
   rechazar con error en español.
6. SI el emisor no es miembro de la conversación ENTONCES el sistema DEBERÁ rechazar el envío.

### Requisito 5 — Estado "escribiendo…" y confirmaciones en vivo
**Historia:** Como usuario, quiero ver cuándo la otra persona está escribiendo y cuándo leyó, para
tener contexto de la conversación.

#### Criterios de aceptación
1. CUANDO un usuario está escribiendo en una conversación ENTONCES el sistema DEBERÁ notificar por
   WebSocket a los demás miembros conectados.
2. CUANDO un usuario deja de escribir o envía el mensaje ENTONCES el indicador DEBERÁ desaparecer.
3. CUANDO un usuario marca leído ENTONCES el sistema DEBERÁ emitir el evento de lectura a los miembros
   conectados.

### Requisito 6 — Marcar como leído y contador de no leídos
**Historia:** Como usuario, quiero que los mensajes se marquen como leídos al abrir la conversación y
ver un indicador global de no leídos, para saber qué me falta revisar.

#### Criterios de aceptación
1. CUANDO un usuario abre una conversación ENTONCES el sistema DEBERÁ actualizar su `last_read_at` y
   poner en cero los no leídos de esa conversación.
2. CUANDO llega un mensaje de otro usuario y no está leyendo esa conversación ENTONCES el contador de
   no leídos DEBERÁ incrementarse.
3. CUANDO cambian los no leídos ENTONCES el badge del sidebar DEBERÁ reflejarlo en vivo por WebSocket
   (con polling REST como fallback).
4. CUANDO se calculan los no leídos ENTONCES el sistema DEBERÁ contar solo mensajes de otros con
   `created_at > last_read_at`.

### Requisito 7 — Notificación in-app y correo al recibir mensaje
**Historia:** Como receptor, quiero enterarme de un mensaje nuevo aunque no tenga el chat abierto, vía
notificación in-app y correo, sin recibir spam.

#### Criterios de aceptación
1. CUANDO se persiste un mensaje ENTONCES el sistema DEBERÁ crear una notificación in-app para el
   receptor mediante `createNotification` (tipo `system`).
2. CUANDO el receptor está inactivo en esa conversación Y ha pasado el periodo de enfriamiento
   (`last_email_at`) Y su preferencia lo permite ENTONCES el sistema DEBERÁ enviarle un correo con la
   plantilla de nuevo mensaje.
3. SI el envío de correo falla ENTONCES el sistema DEBERÁ registrar el fallo y continuar sin cancelar
   el envío del mensaje.
4. MIENTRAS el receptor esté activo en la conversación EL sistema NO DEBERÁ enviar correo.

### Requisito 8 — Autenticación y autorización del canal en tiempo real
**Historia:** Como plataforma, quiero que solo usuarios autenticados y autorizados usen el canal
WebSocket, para proteger las conversaciones.

#### Criterios de aceptación
1. CUANDO un cliente abre el socket ENTONCES el sistema DEBERÁ verificar el JWT en el handshake y
   rechazar la conexión si es inválido.
2. CUANDO un cliente intenta unirse a la sala de una conversación ENTONCES el sistema DEBERÁ validar
   su membresía antes de permitirlo.
3. CUANDO el sistema difunde un mensaje ENTONCES DEBERÁ hacerlo solo a la sala de esa conversación y a
   los canales de usuario correspondientes.
4. CUANDO el CORS del socket se configura ENTONCES DEBERÁ alinearse con `CLIENT_URL`.

### Requisito 9 — Integración con el dashboard sin romper lo existente
**Historia:** Como usuario, quiero acceder a "Mensajes" desde el sidebar con su badge de no leídos,
sin que se altere el resto del dashboard.

#### Criterios de aceptación
1. CUANDO el usuario navega a `/dashboard/mensajes` ENTONCES el sistema DEBERÁ mostrar la pantalla de
   mensajería dentro de `DashboardLayout`, protegida por sesión.
2. CUANDO haya mensajes sin leer ENTONCES el ítem "Mensajes" del sidebar DEBERÁ mostrar un badge con
   la cantidad.
3. CUANDO se integra la funcionalidad ENTONCES los cambios en archivos compartidos DEBERÁN limitarse a
   `App.tsx` (una ruta) y `DashboardLayout.tsx` (badge), sin alterar navegación ni lógica existentes.
4. CUANDO se añaden tablas ENTONCES NO se DEBERÁ modificar ninguna tabla existente.
