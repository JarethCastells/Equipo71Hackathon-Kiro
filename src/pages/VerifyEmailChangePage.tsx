import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { ApiError, confirmEmailChange } from '../lib/api'

type Status = 'verifying' | 'success' | 'error'

/**
 * Destino del enlace de confirmación enviado a la dirección NUEVA cuando el
 * usuario solicita cambiar su correo desde Ajustes → Seguridad. El cambio
 * solo se aplica de verdad después de confirmar aquí.
 */
export default function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    if (!token) {
      setStatus('error')
      setMessage('Falta el token de confirmación en el enlace.')
      return
    }

    confirmEmailChange(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof ApiError ? err.message : 'No se pudo confirmar el cambio de correo.')
      })
  }, [token])

  return (
    <AuthLayout
      title={status === 'verifying' ? 'Confirmando tu nuevo correo...' : status === 'success' ? '¡Correo actualizado!' : 'No pudimos confirmar el cambio'}
      subtitle={status === 'verifying' ? 'Esto toma solo un segundo.' : ''}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 text-center ${
          status === 'error' ? 'border-rose-500/20 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
        }`}
      >
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            status === 'error' ? 'bg-rose-500/15' : 'bg-gradient-to-br from-accent-500 to-violet-500'
          }`}
        >
          {status === 'verifying' && <Loader2 size={24} className="animate-spin text-white" />}
          {status === 'success' && <CheckCircle2 size={24} className="text-white" />}
          {status === 'error' && <XCircle size={24} className="text-rose-400" />}
        </div>
        <p className="mt-4 text-sm text-slate-300">{message}</p>
      </motion.div>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link to="/login" className="font-semibold text-accent-400 hover:text-accent-300">
          Ir a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
