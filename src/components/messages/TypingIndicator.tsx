import { motion, AnimatePresence } from 'framer-motion'

interface TypingIndicatorProps {
  /** Nombres de los usuarios que están escribiendo. */
  names: string[]
}

/**
 * Indicador "escribiendo…" animado.
 *
 * - Desaparece automáticamente cuando `names` queda vacío.
 * - Muestra tres puntos animados en secuencia.
 */
export default function TypingIndicator({ names }: TypingIndicatorProps) {
  const visible = names.length > 0

  let label = ''
  if (names.length === 1) label = `${names[0]} está escribiendo`
  else if (names.length === 2) label = `${names[0]} y ${names[1]} están escribiendo`
  else label = 'Varios usuarios están escribiendo'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="typing"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 px-4 pb-1"
        >
          {/* Tres puntos pulsantes */}
          <span className="flex h-6 items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.07] px-3">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-slate-400"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </span>
          <span className="text-xs text-slate-400">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
