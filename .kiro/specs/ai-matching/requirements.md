# AI Matching — Requisitos

## Contexto
Scoring real basado en IA (Google Gemini) que evalúa
la compatibilidad entre postulantes reales y ofertas reales, añade recomendaciones inteligentes,
y un mini-chat contextual para que el reclutador consulte sobre sus candidatos.

---

## Proveedor de IA: Google Gemini Flash

- **Modelo:** `gemini-2.0-flash`
- **SDK:** `@google/generative-ai` (paquete npm oficial de Google)
- **Costo:** Gratis hasta 15 requests/minuto y 1M tokens/día (no requiere tarjeta de crédito)
- **Ventaja:** Para un hackathon, cero costo y suficiente cuota para demos en vivo.

### Cómo obtener la API key

1. Ir a [Google AI Studio](https://aistudio.google.com/apikey)
2. Iniciar sesión con cualquier cuenta de Google.
3. Clic en **"Create API Key"** → seleccionar cualquier proyecto de GCP (se crea uno automáticamente si no tienes).
4. Copiar la key generada (formato `AIza...`).
5. Pegarla en `server/.env` como `GEMINI_API_KEY=AIzaSy...`

No se necesita habilitar billing, ni crear proyecto manualmente, ni configurar OAuth.
Es literal: entrar, crear key, copiar, pegar.

---

## Requisitos funcionales

### RF-01 — Scoring de compatibilidad por IA (CORE)
- El sistema debe calcular un score de compatibilidad (0–100) entre un postulante real
  y una oferta real usando los datos del perfil del postulante en la BD.
- Campos del postulante usados: `profession`, `bio`, `interests`, `availability`, `rate_amount`.
- Campos de la oferta usados: `title`, `description`, `skills`, `budgetPerHour`.
- Dos modos de scoring:
  - **Modo Gemini** (cuando `GEMINI_API_KEY` está configurada): llama a la API de Google
    para obtener score + razón + tags de fortalezas.
  - **Modo heurístico** (fallback sin API key): scoring por coincidencia de keywords.
- Si se postula alguien nuevo, el score se calcula al consultar (no se cachea).

### RF-02 — Ranking de postulantes con score (CORE)
- Endpoint autenticado `GET /job-postings/:id/ranked-applicants`.
- Solo accesible por el reclutador dueño de la oferta.
- Devuelve postulantes ordenados de mayor a menor score.
- Cada postulante incluye: datos básicos, `matchScore`, `matchReason`, `strengthTags[]`.

### RF-03 — Badge visual de "% match" con colores (CORE)
- En el panel de postulantes del reclutador, cada postulante muestra su score con color:
  - 🟢 Verde: score > 80
  - 🟡 Amarillo: score 50–80
  - 🔴 Rojo: score < 50

### RF-04 — Tags de fortalezas por candidato (CORE)
- Junto al score, mostrar 2-3 tags cortos que explican por qué matchea.
- Ejemplos: "React ✓", "Disponibilidad inmediata ✓", "Dentro del presupuesto ✓"
- En modo Gemini los genera la IA; en modo heurístico se generan por reglas simples.

### RF-05 — Bloque "La IA recomienda" (CORE)
- Arriba del listado de postulantes, un bloque destacado muestra al candidato con mejor
  score y una explicación de por qué es el mejor para esta oferta.
- Si solo hay 1 postulante, el bloque simplemente muestra su evaluación.
- Si no hay postulantes, no se muestra el bloque.

### RF-06 — Mini-chat contextual "Pregúntale a la IA" (CORE)
- Debajo del bloque de recomendación, un input permite al reclutador hacer preguntas
  en lenguaje natural sobre los postulantes.
- Endpoint `POST /job-postings/:id/ask-ai` con `{ question }` en el body.
- La IA recibe como contexto: la oferta completa + los perfiles de todos los postulantes.
- Responde en español, máximo 2-3 párrafos.
- Ejemplos de preguntas: "¿Quién tiene más experiencia en backend?", "Compara a los dos
  mejores", "¿Alguno puede empezar esta semana?"

### RF-07 — Resumen ejecutivo de postulaciones (OPCIONAL)
- Al abrir el panel de postulantes, mostrar un resumen generado por IA:
  "Recibiste X postulaciones. Y son altamente compatibles. El presupuesto promedio
  de los candidatos está Z% debajo/arriba de tu oferta."
- Se genera en la misma llamada que el ranking (un solo request a Gemini).

### RF-08 — Sugerencia para mejorar la oferta (OPCIONAL)
- Si todos los postulantes tienen score < 60, mostrar un bloque con ícono 💡:
  "Podrías mejorar las postulaciones mencionando si el trabajo es remoto o
  agregando las tecnologías específicas que necesitas."
- Solo aparece cuando los scores son bajos. Se genera por la IA o por regla simple.

### RF-09 — Animación "La IA está analizando..." (OPCIONAL)
- Mientras se espera la respuesta del endpoint de ranking, mostrar un skeleton
  con efecto shimmer y texto "La IA está analizando los perfiles..." con ícono
  de Sparkles animado.
- Aplica también al mini-chat mientras espera respuesta.

---

## Requisitos no funcionales

### RNF-01 — Degradación elegante
- Si la API de Gemini falla, no está configurada, o se excede el rate limit,
  el sistema usa el scoring heurístico automáticamente.
- El frontend nunca muestra un error. En el peor caso muestra scores heurísticos
  sin `matchReason` ni tags.

### RNF-02 — Rendimiento
- El scoring de múltiples postulantes se hace en paralelo (`Promise.all`).
- Timeout de 10 segundos por llamada a Gemini.
- Para el mini-chat: timeout de 15 segundos (puede ser una respuesta más larga).

### RNF-03 — Configuración por variable de entorno
- `GEMINI_API_KEY`: API key de Google AI. Si vacía → modo heurístico.
- `GEMINI_MODEL`: modelo a usar (default: `gemini-2.0-flash`).
- Ambas variables documentadas en `server/.env.example` con instrucciones.

### RNF-04 — Sin breaking changes
- El flujo actual de postulaciones, notificaciones y panel de postulantes sigue
  funcionando igual. Los nuevos features se agregan encima.
- `candidates.ts` y el tipo `Candidate` se conservan intactos en la landing page.

---

## Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | Con `GEMINI_API_KEY` configurada, el endpoint de ranked-applicants devuelve scores, `matchReason` no vacío y `strengthTags` con al menos 1 tag. |
| CA-02 | Sin `GEMINI_API_KEY`, el endpoint devuelve scores heurísticos coherentes (no todos en cero). |
| CA-03 | El panel de postulantes muestra badge colorido `X% match` para cada postulante. |
| CA-04 | El bloque "IA recomienda" aparece con el mejor candidato y su razón. |
| CA-05 | El mini-chat responde preguntas sobre los postulantes en español. |
| CA-06 | Si se postula un nuevo candidato, aparece con su score al recargar el panel. |
| CA-07 | El frontend compila sin errores TypeScript. |
| CA-08 | El backend compila sin errores TypeScript. |
