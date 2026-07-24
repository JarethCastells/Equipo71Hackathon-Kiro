export interface WallPerson {
  name: string
  role: string
  initials: string
  color: string
}

// Mosaico de perfiles ficticios usados únicamente para simular actividad masiva
// en tiempo real dentro del hero (miles de personas usando la plataforma).
export const WALL_PEOPLE: WallPerson[] = [
  { name: 'Lucía F.', role: 'UX/UI Designer', initials: 'LF', color: 'from-sky-400 to-blue-500' },
  { name: 'Diego R.', role: 'Full-Stack Dev', initials: 'DR', color: 'from-violet-400 to-purple-500' },
  { name: 'Sofía T.', role: 'Voluntaria', initials: 'ST', color: 'from-emerald-400 to-teal-500' },
  { name: 'Mateo S.', role: 'Marketing Digital', initials: 'MS', color: 'from-amber-400 to-orange-500' },
  { name: 'Valentina O.', role: 'Traductora', initials: 'VO', color: 'from-rose-400 to-pink-500' },
  { name: 'Julián C.', role: 'DevOps Engineer', initials: 'JC', color: 'from-cyan-400 to-sky-500' },
  { name: 'Camila V.', role: 'Redactora SEO', initials: 'CV', color: 'from-indigo-400 to-violet-500' },
  { name: 'Andrés M.', role: 'Soporte IT', initials: 'AM', color: 'from-lime-400 to-green-500' },
  { name: 'Renata P.', role: 'Data Analyst', initials: 'RP', color: 'from-fuchsia-400 to-pink-500' },
  { name: 'Tomás G.', role: 'Video Editor', initials: 'TG', color: 'from-orange-400 to-red-500' },
  { name: 'Isabela N.', role: 'Voluntaria', initials: 'IN', color: 'from-teal-400 to-emerald-500' },
  { name: 'Sebastián L.', role: 'Backend Dev', initials: 'SL', color: 'from-blue-400 to-indigo-500' },
  { name: 'Paula R.', role: 'Community Manager', initials: 'PR', color: 'from-pink-400 to-rose-500' },
  { name: 'Nicolás A.', role: 'Mobile Dev', initials: 'NA', color: 'from-purple-400 to-violet-500' },
  { name: 'Emilia D.', role: 'Product Designer', initials: 'ED', color: 'from-sky-400 to-cyan-500' },
  { name: 'Gabriel H.', role: 'Voluntario', initials: 'GH', color: 'from-green-400 to-lime-500' },
  { name: 'Martina Q.', role: 'Copywriter', initials: 'MQ', color: 'from-amber-400 to-yellow-500' },
  { name: 'Bruno K.', role: 'QA Engineer', initials: 'BK', color: 'from-slate-400 to-slate-500' },
  { name: 'Antonella F.', role: 'Traductora', initials: 'AF', color: 'from-rose-400 to-fuchsia-500' },
  { name: 'Ricardo E.', role: 'Cloud Architect', initials: 'RE', color: 'from-cyan-400 to-blue-500' },
  { name: 'Daniela J.', role: 'Voluntaria', initials: 'DJ', color: 'from-emerald-400 to-cyan-500' },
  { name: 'Federico B.', role: 'Growth Marketer', initials: 'FB', color: 'from-violet-400 to-fuchsia-500' },
  { name: 'Constanza U.', role: 'Ilustradora', initials: 'CU', color: 'from-pink-400 to-purple-500' },
  { name: 'Agustín Y.', role: 'Soporte Técnico', initials: 'AY', color: 'from-lime-400 to-teal-500' },
]
