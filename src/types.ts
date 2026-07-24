export type ProfileType = 'freelancer' | 'voluntario'

export interface Candidate {
  id: string
  name: string
  role: string
  type: ProfileType
  initials: string
  color: string
  hourlyRate: number
  rating: number
  reviews: number
  location: string
  skills: string[]
  availability: 'Inmediata' | 'Esta semana' | 'Próx. 2 semanas'
  verified: boolean
  bio: string
  matchScore: number
}
