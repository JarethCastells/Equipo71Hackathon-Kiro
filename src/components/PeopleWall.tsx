import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { WALL_PEOPLE } from '../data/peopleWall'

/**
 * Fondo de "miles de personas conectadas": un mosaico denso de mini-tarjetas
 * de perfil que titilan de forma escalonada, simulando actividad masiva y
 * simultánea de usuarios navegando la plataforma. Se apoya sobre gradientes
 * y blur para no competir con el contenido principal del hero.
 */
export default function PeopleWall() {
  const tiles = useMemo(() => {
    const cols = 14
    const rows = 9
    const total = cols * rows
    return Array.from({ length: total }, (_, i) => {
      const person = WALL_PEOPLE[i % WALL_PEOPLE.length]
      const col = i % cols
      const row = Math.floor(i / cols)
      // Desplazamiento determinista (no random) para dar variedad orgánica sin
      // riesgo de "saltos" entre renders.
      const jitterX = ((i * 37) % 11) - 5
      const jitterY = ((i * 53) % 9) - 4
      const delay = ((i * 0.13) % 4.5)
      return { person, col, row, jitterX, jitterY, delay, key: `${i}-${person.initials}` }
    })
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="grid h-[130%] w-[130%] -translate-x-[8%] -translate-y-[10%] grid-cols-[repeat(14,minmax(0,1fr))] gap-2 opacity-[0.55] sm:gap-3"
        aria-hidden
      >
        {tiles.map(({ person, jitterX, jitterY, delay, key }) => (
          <motion.div
            key={key}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 backdrop-blur-[1px] sm:gap-2 sm:px-2.5"
            style={{ transform: `translate(${jitterX}px, ${jitterY}px)` }}
            initial={{ opacity: 0.15 }}
            animate={{ opacity: [0.15, 0.55, 0.15] }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              delay,
              ease: 'easeInOut',
            }}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${person.color} text-[6px] font-bold text-white sm:h-5 sm:w-5 sm:text-[7px]`}
            >
              {person.initials}
            </span>
            <span className="hidden truncate text-[8px] font-medium text-slate-300 sm:block sm:text-[9px]">
              {person.role}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Overlays de legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/95 via-ink-950/80 to-ink-950/95" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_rgba(5,6,10,0.9)_75%)]" />
    </div>
  )
}
