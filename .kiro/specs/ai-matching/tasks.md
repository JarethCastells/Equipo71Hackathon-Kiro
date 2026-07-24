# AI Matching — Tareas de implementación

Referencia: #[[file:.kiro/specs/ai-matching/requirements.md]] · #[[file:.kiro/specs/ai-matching/design.md]]

---

## Tarea 0 — Obtener y configurar credenciales de Google Gemini API

**Objetivo:** Tener la API key de Gemini lista y funcional antes de escribir una sola línea de código.

### Paso 1: Crear la API key en Google AI Studio

1. Abrir el navegador e ir a: **https://aistudio.google.com/apikey**
2. Iniciar sesión con una cuenta de Google (cualquier cuenta personal sirve, no necesita ser corporativa).
3. Si es la primera vez, aceptar los términos de servicio de Google AI.
4. Clic en el botón **"Create API Key"**.
5. Te pedirá seleccionar un proyecto de Google Cloud:
   - Si ya tienes uno → selecciónalo.
   - Si no tienes → clic en **"Create new project"** (se crea instantáneamente, no requiere configuración).
6. Se genera la key. Tiene el formato: `AIzaSyC...` (empieza con `AIza`, ~39 caracteres).
7. **Copiar la key** (botón de copiar al lado).

### Paso 2: Verificar que la key funciona (opcional pero recomendado)

Desde la terminal, ejecutar:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=TU_API_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Responde solo con: hola"}]}]}'
```

Si responde con JSON que incluye `"hola"` → la key funciona.
Si dice `API_KEY_INVALID` → la key está mal copiada, repetir paso 1.

### Paso 3: Configurar en el proyecto

1. Abrir el archivo `server/.env`
2. Agregar al final (o reemplazar si ya existe):
   ```env
   # --- IA / Matching inteligente (Google Gemini) ---
   GEMINI_API_KEY=AIzaSyC_tu_key_real_aqui
   GEMINI_MODEL=gemini-2.0-flash
   ```
3. Verificar que `server/.gitignore` incluye `.env` (ya lo tiene por defecto en este proyecto).

### Paso 4: Documentar en .env.example (para el equipo)

En `server/.env.example` agregar al final:
```env
# --- IA / Matching inteligente (Google Gemini) ---
# API key GRATUITA. Obtenerla en: https://aistudio.google.com/apikey
# Pasos:
#   1. Iniciar sesión con cuenta Google
#   2. Clic "Create API Key"
#   3. Seleccionar o crear proyecto
#   4. Copiar la key (formato AIza...) y pegar aquí
# Sin esta key el sistema funciona con scoring heurístico (sin IA real).
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

### Información importante sobre la API

| Concepto | Detalle |
|---|---|
| **Costo** | Gratis. No requiere tarjeta de crédito ni billing. |
| **Límites (tier gratuito)** | 15 requests/min, 1,500 requests/día, 1M tokens/día |
| **Modelo recomendado** | `gemini-2.0-flash` (rápido, bueno para JSON estructurado) |
| **Alternativa si se excede** | El sistema cae automáticamente a scoring heurístico |
| **Formato de respuesta** | Se usa `responseMimeType: 'application/json'` para forzar JSON válido |
| **Autenticación** | Solo la API key en el header/parámetro. No OAuth, no service account. |
| **SDK npm** | `@google/generative-ai` — cliente oficial de Google |

### Cómo se usa la key en el código (preview)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

// Se inicializa una sola vez al arrancar el servidor
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Se obtiene el modelo
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.3,          // Respuestas consistentes
    maxOutputTokens: 1024,     // Suficiente para el JSON de scoring
    responseMimeType: 'application/json',  // Fuerza respuesta en JSON
  },
})

// Se hace una petición
const result = await model.generateContent('Tu prompt aquí')
const text = result.response.text()   // String con el JSON
const parsed = JSON.parse(text)        // Parsear a objeto
```

### Qué pasa si NO se configura la key

- El servidor arranca normal.
- El módulo `aiMatcher.ts` detecta que `GEMINI_API_KEY` está vacía.
- Automáticamente usa el scoring heurístico (por keywords).
- El mini-chat responde: "El chat con IA no está disponible. Configura GEMINI_API_KEY para habilitarlo."
- Todo sigue funcionando, solo que sin la inteligencia del LLM.

**Cubre:** RNF-03, RNF-01

---

## Tarea 1 — Instalar dependencia y configurar variables de entorno

**Archivos:**
- `server/package.json`
- `server/.env.example`
- `server/.env`

**Pasos:**
1. Ejecutar `npm install @google/generative-ai` en `server/`.
2. Agregar al final de `server/.env.example`:
   ```env
   # --- IA / Matching inteligente (Google Gemini) ---
   # Obtener gratis en: https://aistudio.google.com/apikey
   # 1. Iniciar sesión con cuenta Google
   # 2. Clic "Create API Key" → seleccionar proyecto
   # 3. Copiar la key (formato AIza...) y pegar aquí
   # Sin esta key, el sistema usa scoring heurístico (funciona igual, sin IA)
   GEMINI_API_KEY=
   GEMINI_MODEL=gemini-2.0-flash
   ```
3. Agregar lo mismo en `server/.env` con la key real si se tiene.

**Cubre:** RNF-03

---

## Tarea 2 — Crear módulo `server/src/aiMatcher.ts`

**Archivo nuevo:** `server/src/aiMatcher.ts`

**Contenido:**
- Tipos: `MatchResult`, `ScoredApplicant`, `RankingResult`, `CandidateProfile`, `PostingContext`.
- Inicialización condicional del SDK de Gemini (solo si hay API key).
- Función `scoreApplicants(applicants[], posting)` → `Promise<RankingResult>`:
  - Selecciona modo según `process.env.GEMINI_API_KEY`.
  - Try/catch con fallback a heurístico.
- Función `scoreApplicantsLLM()`:
  - Un solo prompt con todos los candidatos (eficiente).
  - `responseMimeType: 'application/json'` para respuesta estructurada.
  - Timeout 10s con `setTimeout` + `AbortController`.
  - Parseo defensivo del JSON.
- Función `scoreApplicantsHeuristic()`:
  - Tokenización + stopwords ES/EN.
  - Score por overlap de keywords (0–60) + bonus disponibilidad (0–20) + bonus tarifa (0–20).
  - Tags generados por reglas.
  - Recomendación = el de mayor score.
  - Resumen generado por template.
- Función `askAboutApplicants(question, applicants[], posting)` → `Promise<string>`:
  - Prompt contextual con oferta + perfiles + pregunta.
  - Si no hay API key → retorna mensaje informativo.
  - Timeout 15s.

**Cubre:** RF-01, RF-04, RF-05, RF-06, RF-07, RF-08, RNF-01, RNF-02

---

## Tarea 3 — Agregar endpoints en `server/src/routes/jobPostings.ts`

**Archivo:** `server/src/routes/jobPostings.ts`

**Cambios:**
1. Importar `scoreApplicants` y `askAboutApplicants` de `../aiMatcher.js`.
2. **Nuevo endpoint `GET /:id/ranked-applicants`** (antes de `/:id/apply`):
   - `requireAuth`.
   - Verificar que la oferta existe y el usuario es el owner.
   - Query: JOIN `job_applications` + `users` para obtener postulantes con datos de perfil.
   - Mapear a `CandidateProfile[]`.
   - Llamar `scoreApplicants(profiles, posting)`.
   - Mergear scores con datos de la aplicación (nombre, avatar, mensaje, status).
   - Ordenar por `matchScore` desc.
   - Responder con `{ applicants, recommendation, summary, suggestion }`.
3. **Nuevo endpoint `POST /:id/ask-ai`** (antes de `/:id/apply`):
   - `requireAuth`.
   - Verificar owner.
   - Validar que `question` es string de 5-500 chars.
   - Obtener postulantes con perfil (mismo query).
   - Llamar `askAboutApplicants(question, profiles, posting)`.
   - Responder `{ answer }`.
   - Rate limit: 10 preguntas/hora por usuario.

**Cubre:** RF-02, RF-06

---

## Tarea 4 — Actualizar `src/lib/api.ts` (frontend)

**Archivo:** `src/lib/api.ts`

**Agregar:**
1. Interface `RankedApplicant` (extiende `JobApplicationWithApplicant` + `matchScore` + `matchReason` + `strengthTags`).
2. Interface `RankingResponse` con `applicants`, `recommendation`, `summary`, `suggestion`.
3. Función `listRankedApplicants(postingId: string): Promise<RankingResponse>`.
4. Función `askAI(postingId: string, question: string): Promise<{ answer: string }>`.

**Cubre:** RF-02, RF-06

---

## Tarea 5 — Actualizar `src/pages/JobBoardPage.tsx` (panel de postulantes)

**Archivo:** `src/pages/JobBoardPage.tsx`

**Cambios en `ApplicantsPanel`:**

1. **Reemplazar** la llamada `listPostingApplications` por `listRankedApplicants`.
2. **Nuevos estados:** `ranking` (RankingResponse), `aiAnswer`, `aiQuestion`, `aiLoading`, `loading`.
3. **Loading state (RF-09 OPCIONAL):**
   - Mientras carga, mostrar skeleton con shimmer + "La IA está analizando los perfiles..."
4. **Bloque Resumen (RF-07 OPCIONAL):**
   - Si `ranking.summary` no vacío → mostrar en un banner sutil arriba.
5. **Bloque "IA recomienda" (RF-05):**
   - Si `ranking.recommendation` existe → bloque dorado/gradiente con nombre del recomendado + razón.
6. **Mini-chat (RF-06):**
   - Input + botón "Preguntar".
   - Al enviar: llamar `askAI(posting.id, question)`, mostrar spinner, luego la respuesta.
   - Estado `aiAnswer` se muestra debajo del input.
7. **Lista de postulantes (RF-02, RF-03, RF-04):**
   - Cada tarjeta de postulante muestra:
     - Badge `X% match` con color (verde/amarillo/rojo).
     - Tags de fortalezas como pills debajo del nombre.
     - `matchReason` como texto pequeño gris (si no vacío).
   - Orden: ya viene ordenado del backend.
8. **Sugerencia (RF-08 OPCIONAL):**
   - Si `ranking.suggestion` no vacío → bloque con 💡 al final.

**Cubre:** RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09

---

## Tarea 6 — Compilar y verificar

**Pasos:**
1. `cd server && npm run build` → cero errores TypeScript.
2. `cd .. && npm run build` → cero errores TypeScript.
3. Prueba manual:
   - Sin `GEMINI_API_KEY`: verificar que el panel muestra scores heurísticos y el chat dice que necesita API key.
   - Con `GEMINI_API_KEY`: verificar scores con razón, tags, recomendación, y chat funcional.
   - Postularse con un nuevo usuario → recargar panel → el nuevo aparece con score.

**Cubre:** CA-01 a CA-08

---

## Orden de ejecución

```
Tarea 1 (dependencia + env)          ← 5 min
  ↓
Tarea 2 (aiMatcher.ts)               ← 45 min (el más denso)
  ↓
Tarea 3 (endpoints backend)          ← 30 min
  ↓
Tarea 4 (api.ts frontend)            ← 10 min
  ↓
Tarea 5 (JobBoardPage UI)            ← 45 min
  ↓
Tarea 6 (compilar + probar)          ← 15 min
```

**Tiempo total estimado: ~2.5 horas**

---

## Features marcadas como OPCIONALES

Las siguientes se implementan si da tiempo, pero el sistema funciona completo sin ellas:

- RF-07: Resumen ejecutivo (se incluye en el prompt de scoring, así que viene "gratis" si Gemini lo devuelve)
- RF-08: Sugerencia para mejorar oferta (mismo caso, viene en el JSON de Gemini)
- RF-09: Animación de loading con shimmer (puro CSS/Framer Motion, se agrega rápido)

Todas las opcionales requieren mínimo código extra porque el backend ya las devuelve en la respuesta de `ranked-applicants`. Es solo mostrarlas o no en el frontend.

---

## Tarea OPCIONAL FINAL — Notificaciones inteligentes con score para freelancers

**Archivo:** `server/src/routes/jobPostings.ts` (función `notifyMatchingUsers`)  
**Archivo:** `server/src/jobPostingStore.ts` (función `findMatchingUsersForPosting`)

**Qué hace hoy:** Cuando un reclutador publica una oferta, notifica a TODOS los usuarios con el rol correcto.

**Qué haría con IA:**
1. En `findMatchingUsersForPosting`, traer también `profession`, `bio`, `interests`, `availability`, `rate_amount`.
2. Llamar `scoreApplicants()` con esos perfiles contra la oferta recién publicada.
3. Filtrar: solo notificar a los que tengan score ≥ 50.
4. En la notificación incluir el score: "Nueva oferta: {título} — {score}% compatible con tu perfil."
5. En el correo, mencionar por qué matchea (el `matchReason`).

**Resultado visible para el freelancer:**
- Recibe notificación: "Nueva oferta: Desarrollador Full-Stack — 94% compatible con tu perfil"
- Solo le llegan ofertas relevantes, no spam de todas las ofertas.

**Esfuerzo:** ~15 min (ya tenemos `scoreApplicants` listo, solo es conectarlo).

**Hacer solo si sobra tiempo después de completar las tareas 0-6.**
