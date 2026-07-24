# AI Matching — Diseño técnico

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  JobBoardPage.tsx ──┬── GET /:id/ranked-applicants          │
│  (panel reclutador) │   (scores + recomendación + resumen)  │
│                     └── POST /:id/ask-ai                    │
│                         (mini-chat contextual)              │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────┐
│                        BACKEND                              │
│                                                             │
│  routes/jobPostings.ts                                      │
│    ├── GET /:id/ranked-applicants  (requireAuth, owner)     │
│    └── POST /:id/ask-ai           (requireAuth, owner)      │
│                                                             │
│  aiMatcher.ts  (NUEVO)                                      │
│    ├── scoreApplicants(applicants[], posting) → ScoredResult│
│    ├── askAboutApplicants(question, applicants[], posting)   │
│    ├── scoreApplicantsLLM()   ← Google Gemini               │
│    └── scoreApplicantsHeuristic()  ← fallback sin API key   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP (si hay API key)
                    ┌──────────▼──────────┐
                    │   Google Gemini API  │
                    │   gemini-2.0-flash   │
                    │   (gratis 15 RPM)   │
                    └─────────────────────┘
```

---

## Configuración de la API de Gemini

### Variables de entorno (`server/.env`)

```env
# --- IA / Matching inteligente (Google Gemini) ---
# Obtener gratis en: https://aistudio.google.com/apikey
# 1. Iniciar sesión con cuenta Google
# 2. Clic "Create API Key"
# 3. Copiar y pegar aquí
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

### Inicialización del SDK con cadena de fallback automática

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Cadena de modelos: si uno da 429 o falla, prueba el siguiente automáticamente.
const MODEL_CHAIN = [
  process.env.GEMINI_MODEL || 'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

function getModel(modelName: string) {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  })
}
```

### Cómo se hacen las peticiones (con fallback automático)

```typescript
async function callGemini(prompt: string): Promise<string> {
  for (const modelName of MODEL_CHAIN) {
    try {
      const model = getModel(modelName)
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err: any) {
      const status = err?.status ?? err?.httpError?.status
      // 429 = rate limit, 503 = overloaded → probar siguiente modelo
      if (status === 429 || status === 503) {
        console.warn(`[aiMatcher] ${modelName} dio ${status}, probando siguiente...`)
        continue
      }
      throw err // Otro error → no reintentar
    }
  }
  throw new Error('Todos los modelos de Gemini fallaron')
}
```

- Se intenta cada modelo en orden.
- Si da 429 (rate limit) o 503 (saturado) → pasa al siguiente.
- Si todos fallan → el catch externo activa el scoring heurístico.
- Otros errores (400 bad request, 401 auth) NO reintentan (sería inútil).

---

## Módulo nuevo: `server/src/aiMatcher.ts`

### Tipos exportados

```typescript
export interface MatchResult {
  score: number           // 0–100
  reason: string          // Explicación breve (vacío en modo heurístico)
  strengthTags: string[]  // ["React ✓", "Disponible ya ✓"] (max 3)
  mode: 'llm' | 'heuristic'
}

export interface ScoredApplicant {
  applicantId: string
  matchScore: number
  matchReason: string
  strengthTags: string[]
}

export interface RankingResult {
  applicants: ScoredApplicant[]
  recommendation: {
    applicantId: string
    reason: string
  } | null
  summary: string         // Resumen ejecutivo (RF-07)
  suggestion: string      // Sugerencia si scores bajos (RF-08), vacío si no aplica
}

export interface CandidateProfile {
  id: string
  name: string
  profession: string | null
  bio: string | null
  interests: string | null
  availability: string | null
  rateAmount: number | null
}

export interface PostingContext {
  title: string
  description: string
  skills: string | null
  budgetPerHour: number
}
```

### Función principal: `scoreApplicants`

```typescript
export async function scoreApplicants(
  applicants: CandidateProfile[],
  posting: PostingContext,
): Promise<RankingResult>
```

- Si `GEMINI_API_KEY` está configurada → `scoreApplicantsLLM()`
- Si no → `scoreApplicantsHeuristic()`
- Si LLM falla → fallback automático a heurístico + `console.warn`

### Función de chat: `askAboutApplicants`

```typescript
export async function askAboutApplicants(
  question: string,
  applicants: CandidateProfile[],
  posting: PostingContext,
): Promise<string>
```

- Si no hay API key → responde un mensaje genérico: "El chat con IA requiere configurar GEMINI_API_KEY."
- Timeout: 15 segundos.

---

## Prompt para scoring (modo Gemini)

Se hace UN solo prompt para todos los postulantes a la vez (más eficiente que uno por uno):

```
System/Instruction:
  Eres un asistente de recursos humanos experto en evaluar compatibilidad laboral.
  Responde SOLO con JSON válido en el formato especificado. Responde en español.

Prompt:
  OFERTA DE TRABAJO:
  - Título: {posting.title}
  - Descripción: {posting.description}
  - Habilidades requeridas: {posting.skills ?? 'No especificadas'}
  - Presupuesto: ${posting.budgetPerHour}/hora

  CANDIDATOS POSTULADOS:
  {applicants.map((a, i) => `
  Candidato ${i+1} (ID: ${a.id}):
  - Nombre: ${a.name}
  - Profesión: ${a.profession ?? 'No indicada'}
  - Bio: ${a.bio ?? 'Sin descripción'}
  - Intereses: ${a.interests ?? 'No indicados'}
  - Disponibilidad: ${a.availability ?? 'No indicada'}
  - Tarifa: ${a.rateAmount ? '$'+a.rateAmount+'/hora' : 'Voluntario (sin costo)'}
  `).join('\n')}

  INSTRUCCIONES:
  1. Evalúa cada candidato del 0 al 100 según qué tan compatible es con la oferta.
  2. Para cada uno, da una razón breve (máx 100 chars) y 2-3 tags de fortalezas.
  3. Recomienda al mejor candidato con una explicación.
  4. Genera un resumen ejecutivo breve (1 oración).
  5. Si TODOS los scores son menores a 60, sugiere cómo mejorar la oferta. Si no, deja suggestion vacío.

  Responde con este JSON exacto:
  {
    "applicants": [
      { "applicantId": "...", "score": 85, "reason": "...", "strengthTags": ["Tag1 ✓", "Tag2 ✓"] }
    ],
    "recommendation": { "applicantId": "...", "reason": "..." },
    "summary": "...",
    "suggestion": ""
  }
```

### Prompt para mini-chat

```
System/Instruction:
  Eres un asistente de RRHH. Tienes acceso a la información de una oferta de trabajo
  y los perfiles de los candidatos postulados. Responde en español, máximo 2-3 párrafos.
  Sé conciso y útil.

Prompt:
  CONTEXTO DE LA OFERTA:
  {misma info de la oferta}

  CANDIDATOS:
  {misma info de los candidatos}

  PREGUNTA DEL RECLUTADOR:
  "{question}"
```

---

## Modo heurístico (`scoreApplicantsHeuristic`)

Para cuando no hay API key. Funciona 100% offline:

### Algoritmo por candidato:

1. **Tokenizar**: lowercase, split por espacios/comas/puntos, filtrar stopwords.
2. **Texto candidato**: `[profession, bio, interests].filter(Boolean).join(' ')`
3. **Texto oferta**: `[title, description, skills].filter(Boolean).join(' ')`
4. **Score base por keywords** (0–60): `(tokensCoinciden / tokensOferta.size) * 60`
5. **Bonus disponibilidad** (0–20): "inmediata" → +20, "semana" → +15, "2 semanas" → +5
6. **Bonus tarifa** (0–20): `rateAmount <= budget` → +20, `rateAmount <= budget*1.3` → +10, voluntario → +15
7. **Clamp**: `Math.min(100, Math.max(0, Math.round(total)))`

### Tags heurísticos:

- Si `rateAmount <= budget` → "Dentro del presupuesto ✓"
- Si `availability` incluye "inmediata" → "Disponibilidad inmediata ✓"
- Si hay ≥ 3 tokens coincidentes con skills → "Habilidades relevantes ✓"

### Recomendación heurística:

- El de mayor score es el recomendado.
- `reason`: "Tiene el mejor puntaje de compatibilidad basado en habilidades, disponibilidad y tarifa."

### Resumen heurístico:

- "Tienes X postulantes. Y tienen score alto (>70). Promedio de compatibilidad: Z%."

---

## Cambios en `server/src/routes/jobPostings.ts`

### Endpoint nuevo: `GET /:id/ranked-applicants`

```
GET /job-postings/:id/ranked-applicants
Authorization: Bearer <token>
```

Flujo:
1. `requireAuth` → verificar que la oferta existe y `posting.createdBy === req.auth.sub`.
2. Obtener postulaciones con JOIN a `users` (traer `profession`, `bio`, `interests`, `availability`, `rate_amount`, `name`, `avatar_url`, `role`).
3. Mapear a `CandidateProfile[]`.
4. Llamar `scoreApplicants(profiles, posting)`.
5. Merge los scores con los datos de la postulación.
6. Devolver `{ ...RankingResult, applicants: FullRankedApplicant[] }`.

Respuesta:
```json
{
  "applicants": [
    {
      "id": "application-uuid",
      "applicantId": "user-uuid",
      "applicantName": "Diego Ramírez",
      "applicantRole": "freelancer",
      "applicantAvatarUrl": "/uploads/avatars/...",
      "message": "Me interesa mucho",
      "status": "pending",
      "createdAt": "...",
      "matchScore": 94,
      "matchReason": "Experiencia directa en React y Node.js...",
      "strengthTags": ["React ✓", "Node.js ✓", "Disponible ya ✓"]
    }
  ],
  "recommendation": {
    "applicantId": "user-uuid",
    "reason": "Diego es el más compatible porque..."
  },
  "summary": "4 postulaciones, 2 altamente compatibles.",
  "suggestion": ""
}
```

### Endpoint nuevo: `POST /:id/ask-ai`

```
POST /job-postings/:id/ask-ai
Authorization: Bearer <token>
Body: { "question": "¿Quién tiene más experiencia en React?" }
```

Flujo:
1. `requireAuth` → verificar owner.
2. Obtener postulantes con datos de perfil (mismo query que ranked-applicants).
3. Llamar `askAboutApplicants(question, profiles, posting)`.
4. Devolver `{ answer: string }`.

Respuesta:
```json
{
  "answer": "Diego Ramírez tiene la mayor experiencia en React según su perfil..."
}
```

**Importante:** Ambos endpoints se registran ANTES de `/:id/apply` para que Express
no confunda `ranked-applicants` o `ask-ai` como un `:id`.

---

## Cambios en el frontend

### `src/lib/api.ts` — nuevas interfaces y funciones

```typescript
export interface RankedApplicant extends JobApplicationWithApplicant {
  matchScore: number
  matchReason: string
  strengthTags: string[]
}

export interface RankingResponse {
  applicants: RankedApplicant[]
  recommendation: { applicantId: string; reason: string } | null
  summary: string
  suggestion: string
}

export function listRankedApplicants(postingId: string): Promise<RankingResponse>
export function askAI(postingId: string, question: string): Promise<{ answer: string }>
```

### `src/pages/JobBoardPage.tsx` — cambios en ApplicantsPanel

1. Reemplazar `listPostingApplications` por `listRankedApplicants`.
2. Estado de carga con animación "IA analizando..." (RF-09).
3. Bloque "Resumen" arriba si `summary` no vacío (RF-07).
4. Bloque "IA recomienda" con el candidato recomendado (RF-05).
5. Mini-chat con input + botón + respuesta (RF-06).
6. Cada postulante con badge colorido + tags (RF-03, RF-04).
7. Bloque "Sugerencia 💡" si `suggestion` no vacío (RF-08).

---

## Dependencia nueva

| Paquete | Versión | Donde |
|---|---|---|
| `@google/generative-ai` | `^0.21.0` | `server/` |

---

## Variables de entorno nuevas

| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `GEMINI_API_KEY` | API key de Google AI | https://aistudio.google.com/apikey → Create API Key → copiar |
| `GEMINI_MODEL` | Modelo (default: `gemini-2.0-flash`) | No cambiar a menos que quieras otro modelo |
