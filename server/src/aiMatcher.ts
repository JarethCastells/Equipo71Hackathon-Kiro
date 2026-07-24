import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Tipos ──────────────────────────────────────────────────────────────────

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

export interface ScoredApplicant {
  applicantId: string
  matchScore: number
  matchReason: string
  strengthTags: string[]
}

export interface RankingResult {
  applicants: ScoredApplicant[]
  recommendation: { applicantId: string; reason: string } | null
  summary: string
  suggestion: string
}

// ─── Configuración de Gemini ────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

const MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
]

let genAI: GoogleGenerativeAI | null = null
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
}

function getModel(modelName: string) {
  return genAI!.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  })
}

// ─── Llamada a Gemini con fallback automático entre modelos ─────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGemini(prompt: string): Promise<string> {
  if (!genAI) throw new Error('No GEMINI_API_KEY configured')

  // Primer intento: probar todos los modelos
  for (const modelName of MODEL_CHAIN) {
    try {
      const model = getModel(modelName)
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err: any) {
      console.warn(`[aiMatcher] ${modelName} falló: ${err?.message?.slice(0, 80) ?? 'error desconocido'}`)
      continue
    }
  }

  // Segundo intento: esperar 5s y reintentar con el primer modelo
  console.warn('[aiMatcher] Todos los modelos fallaron, esperando 5s y reintentando...')
  await sleep(5000)
  try {
    const model = getModel(MODEL_CHAIN[0])
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch {
    throw new Error('Todos los modelos de Gemini fallaron (rate limit)')
  }
}

// ─── Función pública: scoring de postulantes ────────────────────────────────

export async function scoreApplicants(
  applicants: CandidateProfile[],
  posting: PostingContext,
): Promise<RankingResult> {
  if (applicants.length === 0) {
    return { applicants: [], recommendation: null, summary: 'No hay postulantes aún.', suggestion: '' }
  }

  try {
    if (GEMINI_API_KEY) {
      return await scoreApplicantsLLM(applicants, posting)
    }
  } catch (err) {
    console.warn('[aiMatcher] LLM falló, usando scoring heurístico:', (err as Error).message)
  }

  return scoreApplicantsHeuristic(applicants, posting)
}

// ─── Función pública: chat con IA sobre postulantes ─────────────────────────

export async function askAboutApplicants(
  question: string,
  applicants: CandidateProfile[],
  posting: PostingContext,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return 'El chat con IA no está disponible. Configura GEMINI_API_KEY en el servidor para habilitarlo.'
  }

  if (applicants.length === 0) {
    return 'No hay postulantes todavía para esta oferta.'
  }

  const candidatesText = applicants
    .map(
      (a, i) =>
        `Candidato ${i + 1} (${a.name}):\n` +
        `  Profesión: ${a.profession ?? 'No indicada'}\n` +
        `  Bio: ${a.bio ?? 'Sin descripción'}\n` +
        `  Intereses: ${a.interests ?? 'No indicados'}\n` +
        `  Disponibilidad: ${a.availability ?? 'No indicada'}\n` +
        `  Tarifa: ${a.rateAmount ? '$' + a.rateAmount + '/hora' : 'Voluntario (sin costo)'}`,
    )
    .join('\n\n')

  const prompt = `Eres un asistente de recursos humanos. Tienes acceso a la información de una oferta de trabajo y los perfiles de los candidatos postulados. Responde en español de forma concisa (máximo 3-4 oraciones por candidato). Sé directo y útil.

OFERTA DE TRABAJO:
- Título: ${posting.title}
- Descripción: ${posting.description}
- Habilidades requeridas: ${posting.skills ?? 'No especificadas'}
- Presupuesto: $${posting.budgetPerHour}/hora

CANDIDATOS POSTULADOS:
${candidatesText}

PREGUNTA DEL RECLUTADOR:
"${question}"

Responde de forma directa y útil. Máximo 150 palabras.`

  try {
    // Para el chat usamos generación de texto libre (no JSON)
    if (!genAI) throw new Error('No API key')
    for (const modelName of MODEL_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        })
        const result = await model.generateContent(prompt)
        return result.response.text()
      } catch (err: any) {
        if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429 || err?.status === 503) {
          continue
        }
        throw err
      }
    }
    return 'La IA está temporalmente saturada. Intenta de nuevo en unos segundos.'
  } catch (err) {
    console.warn('[aiMatcher] Chat IA falló:', (err as Error).message)
    return 'No se pudo obtener una respuesta de la IA en este momento. Intenta de nuevo.'
  }
}

// ─── Scoring con LLM (Gemini) ───────────────────────────────────────────────

async function scoreApplicantsLLM(
  applicants: CandidateProfile[],
  posting: PostingContext,
): Promise<RankingResult> {
  const candidatesText = applicants
    .map(
      (a, i) =>
        `Candidato ${i + 1} (ID: ${a.id}):\n` +
        `  Nombre: ${a.name}\n` +
        `  Profesión: ${a.profession ?? 'No indicada'}\n` +
        `  Bio: ${a.bio ?? 'Sin descripción'}\n` +
        `  Intereses: ${a.interests ?? 'No indicados'}\n` +
        `  Disponibilidad: ${a.availability ?? 'No indicada'}\n` +
        `  Tarifa: ${a.rateAmount ? '$' + a.rateAmount + '/hora' : 'Voluntario (sin costo)'}`,
    )
    .join('\n\n')

  const prompt = `Eres un evaluador experto de compatibilidad laboral. Responde SOLO con JSON válido en el formato especificado. Responde en español.

OFERTA DE TRABAJO:
- Título: ${posting.title}
- Descripción: ${posting.description}
- Habilidades requeridas: ${posting.skills ?? 'No especificadas'}
- Presupuesto: $${posting.budgetPerHour}/hora

CANDIDATOS POSTULADOS:
${candidatesText}

INSTRUCCIONES:
1. Evalúa cada candidato del 0 al 100 según qué tan compatible es con la oferta.
2. Para cada uno, da una razón breve (máx 100 caracteres) y exactamente 2-3 tags cortos de fortalezas (ej: "React ✓", "Disponible ya ✓").
3. Recomienda al mejor candidato con una explicación de por qué es el mejor.
4. Genera un resumen ejecutivo breve (1 oración sobre el estado general de las postulaciones).
5. Si TODOS los scores son menores a 60, sugiere cómo mejorar la oferta para atraer mejores candidatos. Si no, deja suggestion como string vacío.

Responde con este JSON exacto:
{
  "applicants": [
    { "applicantId": "id-del-candidato", "score": 85, "reason": "razón breve", "strengthTags": ["Tag1 ✓", "Tag2 ✓"] }
  ],
  "recommendation": { "applicantId": "id-del-mejor", "reason": "por qué es el mejor" },
  "summary": "resumen ejecutivo breve",
  "suggestion": ""
}`

  const raw = await callGemini(prompt)
  const parsed = parseGeminiResponse(raw, applicants)
  return parsed
}

// ─── Parseo defensivo de la respuesta de Gemini ─────────────────────────────

function parseGeminiResponse(raw: string, applicants: CandidateProfile[]): RankingResult {
  try {
    // Limpiar la respuesta: a veces Gemini envuelve el JSON en markdown o añade texto extra
    let cleaned = raw.trim()

    // Remover bloques de código markdown (```json ... ``` o ``` ... ```)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim()
    }

    // Si empieza con texto antes del {, extraer solo el JSON
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    if (jsonStart > 0 || (jsonEnd > 0 && jsonEnd < cleaned.length - 1)) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
    }

    const data = JSON.parse(cleaned)

    const scored: ScoredApplicant[] = (data.applicants ?? []).map((a: any) => ({
      applicantId: String(a.applicantId ?? ''),
      matchScore: Math.min(100, Math.max(0, Number(a.score ?? a.matchScore ?? 50))),
      matchReason: String(a.reason ?? a.matchReason ?? ''),
      strengthTags: Array.isArray(a.strengthTags) ? a.strengthTags.map(String).slice(0, 3) : [],
    }))

    // Asegurar que todos los applicants están representados
    for (const ap of applicants) {
      if (!scored.find((s) => s.applicantId === ap.id)) {
        scored.push({
          applicantId: ap.id,
          matchScore: 50,
          matchReason: 'No evaluado por la IA',
          strengthTags: [],
        })
      }
    }

    const recommendation = data.recommendation
      ? { applicantId: String(data.recommendation.applicantId ?? ''), reason: String(data.recommendation.reason ?? '') }
      : scored.length > 0
        ? { applicantId: scored.sort((a, b) => b.matchScore - a.matchScore)[0].applicantId, reason: 'Tiene el mayor puntaje de compatibilidad.' }
        : null

    return {
      applicants: scored.sort((a, b) => b.matchScore - a.matchScore),
      recommendation,
      summary: String(data.summary ?? `${applicants.length} postulantes evaluados.`),
      suggestion: String(data.suggestion ?? ''),
    }
  } catch (parseErr) {
    console.warn('[aiMatcher] No se pudo parsear respuesta de Gemini, usando heurístico')
    console.warn('[aiMatcher] Raw response (500 chars):', raw.slice(0, 500))
    return scoreApplicantsHeuristic(applicants, {
      title: '',
      description: '',
      skills: null,
      budgetPerHour: 0,
    })
  }
}

// ─── Scoring heurístico (fallback sin API) ──────────────────────────────────

const STOPWORDS = new Set([
  // Español
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'un', 'una', 'es', 'que',
  'por', 'con', 'para', 'se', 'al', 'su', 'no', 'más', 'como', 'pero', 'o', 'este',
  'esta', 'estos', 'estas', 'lo', 'le', 'les', 'me', 'mi', 'nos', 'ya', 'muy',
  // Inglés
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'or', 'and', 'not',
  'it', 'this', 'that', 'but', 'if', 'so', 'as', 'its', 'can', 'than',
])

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü\w\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  return new Set(words)
}

function scoreApplicantsHeuristic(
  applicants: CandidateProfile[],
  posting: PostingContext,
): RankingResult {
  const postingText = [posting.title, posting.description, posting.skills].filter(Boolean).join(' ')
  const postingTokens = tokenize(postingText)

  const scored: ScoredApplicant[] = applicants.map((applicant) => {
    const candidateText = [applicant.profession, applicant.bio, applicant.interests].filter(Boolean).join(' ')
    const candidateTokens = tokenize(candidateText)

    // Score base por keywords (0–60)
    let matches = 0
    for (const token of postingTokens) {
      if (candidateTokens.has(token)) matches++
    }
    const keywordScore = postingTokens.size > 0 ? (matches / postingTokens.size) * 60 : 30

    // Bonus disponibilidad (0–20)
    let availabilityBonus = 0
    const avail = (applicant.availability ?? '').toLowerCase()
    if (avail.includes('inmediata') || avail.includes('immediate')) availabilityBonus = 20
    else if (avail.includes('semana') || avail.includes('week')) availabilityBonus = 15
    else if (avail.includes('2 semana') || avail.includes('2 week')) availabilityBonus = 5
    else if (avail) availabilityBonus = 10

    // Bonus tarifa (0–20)
    let rateBonus = 0
    if (applicant.rateAmount === null || applicant.rateAmount === 0) {
      rateBonus = 15 // Voluntario
    } else if (posting.budgetPerHour > 0) {
      if (applicant.rateAmount <= posting.budgetPerHour) rateBonus = 20
      else if (applicant.rateAmount <= posting.budgetPerHour * 1.3) rateBonus = 10
    } else {
      rateBonus = 10
    }

    const totalScore = Math.min(100, Math.max(0, Math.round(keywordScore + availabilityBonus + rateBonus)))

    // Tags heurísticos
    const tags: string[] = []
    if (matches >= 3) tags.push('Habilidades relevantes ✓')
    else if (matches >= 1) tags.push('Algunas habilidades ✓')
    if (availabilityBonus >= 15) tags.push('Disponibilidad inmediata ✓')
    if (rateBonus >= 15) {
      if (applicant.rateAmount === 0 || applicant.rateAmount === null) tags.push('Voluntario ✓')
      else tags.push('Dentro del presupuesto ✓')
    }

    return {
      applicantId: applicant.id,
      matchScore: totalScore,
      matchReason: '',
      strengthTags: tags.slice(0, 3),
    }
  })

  // Ordenar por score
  scored.sort((a, b) => b.matchScore - a.matchScore)

  // Recomendación: el de mayor score
  const best = scored[0]
  const recommendation = best
    ? {
        applicantId: best.applicantId,
        reason: 'Tiene el mejor puntaje de compatibilidad basado en habilidades, disponibilidad y tarifa.',
      }
    : null

  // Resumen
  const highScoreCount = scored.filter((s) => s.matchScore >= 70).length
  const avgScore = Math.round(scored.reduce((sum, s) => sum + s.matchScore, 0) / scored.length)
  const summary = `${scored.length} postulante${scored.length > 1 ? 's' : ''}. ${highScoreCount} con alta compatibilidad. Promedio: ${avgScore}%.`

  // Sugerencia si todos los scores son bajos
  const allLow = scored.every((s) => s.matchScore < 60)
  const suggestion = allLow
    ? 'Los candidatos actuales tienen baja compatibilidad. Intenta agregar habilidades específicas o mencionar si el trabajo es remoto para atraer mejores perfiles.'
    : ''

  return { applicants: scored, recommendation, summary, suggestion }
}
