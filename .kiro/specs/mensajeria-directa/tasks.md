# Plan de implementación — Mensajería directa en tiempo real

Cada tarea deja un incremento funcional demostrable, construye sobre la anterior y termina integrada
(sin código huérfano). Las referencias apuntan a los requisitos de `requirements.md`.

- [x] 1. Esquema de base de datos
  - Añadir a `server/src/schema.sql` las tablas `conversations`, `conversation_members` y `messages`
    de forma idempotente (índices, FKs `ON DELETE CASCADE`, `dm_key CHAR(73) UNIQUE`, índice de
    paginación `(conversation_id, created_at, id)`, `UNIQUE (conversation_id, user_id)`).
  - No modificar ninguna tabla existente.
  - Ejecutar `npm run migrate` (dos veces para verificar idempotencia).
  - Prueba: insertar filas de prueba y comprobar que un `dm_key` duplicado es rechazado.
  - Demo: mostrar las 3 tablas en MySQL y el bloqueo de una conversación directa duplicada.
  - _Requisitos: 1.5, 9.4_

- [x] 2. Tipos y `toPublicX` de mensajería
  - En `server/src/types.ts` definir `Conversation`, `ConversationSummary`, `Message` y
    `toPublicConversation()` / `toPublicMessage()` (sin exponer columnas internas).
  - Prueba: unit de que `toPublicX` no incluye campos internos.
  - Demo: type-check del backend en verde con los nuevos tipos.
  - _Requisitos: 2.2, 3.4_

- [x] 3. `conversationStore.ts`
  - Implementar `ConversationRow`/`mapRow`, `findOrCreateDirectConversation()` (idempotente vía
    `dm_key`), `listConversationsForUser()`, `findConversationById()`, `isMember()`,
    `touchLastMessage()`. SQL parametrizado.
  - Prueba: unit de dedupe de DM (dos creaciones → misma conversación) y aislamiento por miembro.
  - Demo: script que crea/recupera un DM entre dos usuarios y lista la bandeja de uno.
  - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.3_

- [x] 4. `messageStore.ts`
  - Implementar `createMessage()`, `listMessages(conversationId, cursor, limit)` (keyset),
    `countUnreadForUser()`, `countTotalUnread()`, `markRead()`, `getMembership()`, `setLastEmailAt()`.
  - Prueba: unit de paginación keyset y de conteo de no leídos según `last_read_at`.
  - Demo: insertar N mensajes, paginarlos y ver el contador de no leídos cambiar tras `markRead`.
  - _Requisitos: 3.1, 3.2, 6.1, 6.4_

- [x] 5. Correo de nuevo mensaje (plantilla + envío)
  - Añadir `renderNewMessageEmail()` en `server/src/emailTemplates.ts` y `sendNewMessageEmail()` en
    `server/src/mailer.ts` reutilizando `dispatch()`.
  - Prueba: render de la plantilla y que `sendNewMessageEmail` usa `dispatch` (preview Ethereal).
  - Demo: disparar un envío de prueba y ver la URL de vista previa en consola.
  - _Requisitos: 7.2_

- [x] 6. `messageService.postMessage()` (punto único de escritura)
  - Implementar `postMessage({ conversationId, senderId, body })`: validar (trim/longitud/no vacío),
    persistir (`createMessage` + `touchLastMessage`), crear notificación in-app con
    `createNotification(receptor, 'system', ...)`, y enviar correo solo si el receptor está inactivo,
    fuera del cooldown (`last_email_at`) y con preferencia activa. Los fallos de correo no cancelan el
    envío. Devolver el mensaje público.
  - Prueba: unit de que un fallo de correo no rompe el envío y de que el cooldown omite correos repetidos.
  - Demo: llamar a `postMessage` y verificar mensaje persistido + notificación creada.
  - _Requisitos: 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 7.4_

- [x] 7. Router REST `routes/conversations.ts` + montaje
  - Implementar los 7 endpoints (`POST /`, `GET /`, `GET /:id/messages`, `POST /:id/messages`,
    `POST /:id/read`, `GET /unread-count`, `GET /contacts`) con `requireAuth`, `asyncRoute`,
    validación en español, `assertMembership` y rate limit (`express-rate-limit`). El envío usa
    `postMessage()`. Montar en `server/src/index.ts` como `/api/conversations`.
  - Prueba: integración de crear/listar/enviar/leer/unread y de 403 cuando no se es miembro.
  - Demo: flujo completo por curl/Postman entre dos usuarios reales.
  - _Requisitos: 1.1-1.4, 2.1-2.4, 3.1-3.3, 4.3-4.6, 6.1, 6.4_

- [x] 8. Extraer `verifyToken` y preparar `http.Server`
  - En `server/src/auth.ts` extraer `verifyToken(token): AuthPayload | null` y hacer que `requireAuth`
    lo reutilice (sin cambiar su comportamiento).
  - En `server/src/index.ts` crear `http.createServer(app)` y usar `httpServer.listen(...)` en lugar
    de `app.listen(...)` (cambio aditivo, sin alterar rutas existentes).
  - Prueba: la API sigue respondiendo (health + un endpoint existente) tras el cambio.
  - Demo: servidor arranca igual y `verifyToken` valida un JWT real.
  - _Requisitos: 8.1_

- [x] 9. Capa WebSocket `realtime.ts`
  - Implementar `initRealtime(httpServer)` con socket.io: auth de handshake con `verifyToken`, CORS a
    `CLIENT_URL`, unión a sala `user:<userId>`; eventos `conversation:join`/`leave` (con
    `assertMembership`), `message:send` (usa `postMessage`, difunde `message:new` a
    `conversation:<id>` y `unread:update` a `user:<receptor>`), `message:read`, `typing`. Rate limit en
    el handler de envío. Llamar `initRealtime` desde `index.ts`.
  - Añadir dependencia `socket.io` (versión fijada).
  - Prueba: handshake válido/inválido; join no autorizado rechazado; broadcast a la sala correcta.
  - Demo: dos clientes WS (script) intercambian mensajes en vivo y reciben `unread:update`.
  - _Requisitos: 4.1, 4.4, 5.1, 5.2, 5.3, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4_
  - _Nota de implementación: el ACK de `message:send` fue corregido de `ack({ message })` a
    `ack({ ok: true, message })` para evitar que el cliente siempre cayera al fallback REST y cada
    mensaje se guardara dos veces en BD._

- [x] 10. Cliente API REST (`src/lib/api.ts`)
  - Añadir tipos (`Conversation`, `ConversationSummary`, `Message`) y funciones (`createConversation`,
    `listConversations`, `listMessages`, `sendMessage`, `markConversationRead`,
    `getUnreadMessageCount`, `searchContacts`) siguiendo el patrón del cliente `fetch` con Bearer JWT.
  - Prueba: type-check y una llamada real autenticada contra el backend.
  - Demo: desde la consola del navegador, listar conversaciones autenticado.
  - _Requisitos: 2.1, 3.1, 4.4, 6.1_
  - _Nota de implementación: las 4 funciones de mensajería (`createConversation`, `listConversations`,
    `getUnreadMessageCount`, `searchContacts`) tuvieron que ser corregidas para desempaquetar
    correctamente las respuestas envueltas del backend (`{ conversation }`, `{ conversations }`,
    `{ unreadCount }`, `{ contacts }`)._

- [x] 11. `SocketContext` + `useSocket`
  - Crear `src/context/SocketContext.tsx` (conexión socket.io única autenticada con el JWT de
    `localStorage`, reconexión automática, estado `connected`) y `src/hooks/useSocket.ts`.
  - Añadir dependencia `socket.io-client` (versión fijada).
  - Prueba: conexión/reconexión y recepción de un evento de prueba.
  - Demo: socket conectado con un evento recibido visible en consola del navegador.
  - _Requisitos: 8.1_

- [x] 12. Bandeja de conversaciones (pantalla + hooks)
  - Crear `src/pages/MessagesPage.tsx` (dentro de `DashboardLayout`, layout de 2 columnas),
    `useConversations` (carga REST + refresco por evento `conversation:updated`, polling fallback),
    `ConversationList`, `ConversationListItem`, `ConversationSearch`, `MessagesEmptyState`, con estados
    de carga/error/vacío.
  - Prueba: render con datos, vacío y error; reordenado por `conversation:updated`.
  - Demo: abrir la pantalla y ver la lista real que se reordena en vivo.
  - _Requisitos: 2.1-2.4, 9.1_

- [x] 13. Panel de conversación en tiempo real
  - Crear `MessagePanel`, `MessageList` (scroll invertido + "cargar más"), `MessageBubble`,
    `MessageComposer`, `TypingIndicator`; `useMessages` (historial REST + `message:new`/`message:read`/
    `typing` + `markRead` al abrir/enfocar) y `useSendMessage` (envío por WS con fallback REST (sin capa optimista para evitar duplicados visuales)).
  - Prueba: mensaje en vivo entre dos sesiones; indicador "escribiendo…"; cargar más; marcar leído.
  - Demo: chatear entre dos navegadores con entrega instantánea.
  - _Requisitos: 3.1-3.4, 4.1-4.6, 5.1-5.3, 6.1_
  - _Nota de implementación: el sistema de mensajes optimistas fue eliminado porque el `tempId`
    nunca reconciliaba con el ID real del servidor, causando duplicados visuales. `useMessages` es
    ahora la única fuente de verdad. También se añadió `.reverse()` al cargar historial (el backend
    devuelve `DESC`, la UI necesita `ASC`)._

- [x] 14. Iniciar conversación (modal + búsqueda de contactos)
  - Crear `NewConversationModal` que use `searchContacts` para buscar un usuario e iniciar/abrir un DM
    idempotente y seleccionarlo.
  - Prueba: iniciar chat con alguien nuevo vs. reabrir uno existente (misma conversación).
  - Demo: crear un chat desde cero contra un usuario buscado.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [x] 15. Integración con el layout (ruta + badge)
  - En `src/App.tsx` añadir la ruta protegida `/dashchatboard/mensajes` → `MessagesPage` antes del catch
    `/dashboard/*`.
  - En `src/components/dashboard/DashboardLayout.tsx` añadir el badge de no leídos al ítem "Mensajes"
    usando `useUnreadMessages` (arranque por `getUnreadMessageCount`, actualización en vivo por
    `unread:update`, polling fallback). Crear `useUnreadMessages`.
  - Prueba: el badge sube al recibir y baja al leer; la navegación existente no cambia.
  - Demo: badge del sidebar reaccionando en tiempo real al recibir/leer mensajes.
  - _Requisitos: 6.2, 6.3, 9.1, 9.2, 9.3_

- [x] 16. Pruebas y endurecido final
  - Completar/estabilizar la suite (stores, endpoints REST, eventos socket, hooks/UI); si no hay runner
    configurado, añadir el estándar del ecosistema como primer paso. Verificar permisos, rate limits y
    validaciones. Limpiar archivos temporales de verificación.
  - Prueba: suite en verde; casos de autorización (403/join no autorizado) y validación cubiertos.
  - Demo: reporte de pruebas pasando y recorrido E2E del flujo completo en tiempo real.
  - _Requisitos: 4.5, 4.6, 8.1, 8.2, 8.3_
  - _Nota de implementación: las tablas de mensajería no existían en la BD de desarrollo; se ejecutó
    `npm run migrate`. También se corrigió un error SQL ambiguo en `conversationStore.ts` donde
    `SELECT conversation_id` / `GROUP BY conversation_id` eran ambiguos en un JOIN; corregido a
    `m.conversation_id`._
