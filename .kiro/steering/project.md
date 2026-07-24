# TalentFlow AI — Contexto del proyecto

## Descripción

TalentFlow AI es una plataforma que conecta **freelancers**, **voluntarios** y **reclutadores**
mediante emparejamiento inteligente por presupuesto, perfil y disponibilidad.

## Stack

### Frontend (`/`)
- React 18 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- React Router v6
- Variable de entorno: `VITE_API_URL` (por defecto `http://localhost:4000`)

### Backend (`/server`)
- Node.js + Express + TypeScript (`tsx` en desarrollo)
- MySQL vía `mysql2` (pool en `src/db.ts`)
- JWT (`jsonwebtoken`) + bcrypt para autenticación
- Nodemailer para correo transaccional
- Scripts: `npm run dev` (puerto 4000), `npm run migrate`

## Roles de usuario

| Rol | Descripción |
|---|---|
| `freelancer` | Perfil profesional con tarifa por hora o proyecto |
| `voluntario` | Sin tarifa, declara disponibilidad e intereses |
| `reclutador` | Publica ofertas, revisa postulantes, contrata |

## Campos de perfil relevantes para matching (tabla `users`)

| Campo DB | Tipo | Descripción |
|---|---|---|
| `profession` | string | Título profesional |
| `bio` | string | Descripción libre del perfil |
| `interests` | string | Áreas de interés (voluntarios) |
| `rate_amount` | number | Tarifa por hora o proyecto |
| `rate_type` | `hourly`\|`project` | Tipo de tarifa |
| `availability` | string | Disponibilidad declarada |
| `location` | string | País / ciudad |

## Estructura de archivos clave

```
server/src/
  jobPostingStore.ts     ← findMatchingUsersForPosting (función a reemplazar)
  userStore.ts           ← acceso a datos de usuarios
  types.ts               ← tipos compartidos (JobPosting, User, PublicUser)
  routes/jobPostings.ts  ← endpoints REST de ofertas

src/
  data/candidates.ts     ← datos mock con matchScore hardcodeado (a reemplazar)
  components/CandidateFeed.tsx   ← feed de candidatos en la landing page
  components/CandidateCard.tsx   ← tarjeta individual con badge "% match"
  pages/JobBoardPage.tsx          ← tablero de ofertas con postulantes reales
  lib/api.ts                      ← cliente HTTP del frontend
  types.ts                        ← tipo Candidate (incluye matchScore)
```

## Convenciones

- Los stores (`*Store.ts`) acceden directamente al pool MySQL, sin ORM.
- Los endpoints usan `requireAuth` de `auth.ts` y helpers `asyncRoute`.
- El frontend consume la API vía funciones en `src/lib/api.ts`.
- Los tipos del backend viven en `server/src/types.ts`; los del frontend en `src/types.ts`.
