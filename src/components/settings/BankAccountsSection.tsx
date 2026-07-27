import { useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Building2, Check, Landmark, Star, Trash2 } from 'lucide-react'
import { ApiError, addBankAccount, listBankAccounts, removeBankAccount } from '../../lib/api'
import type { BankAccount } from '../../lib/api'

export default function BankAccountsSection() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [bankName, setBankName] = useState('')
  const [holderName, setHolderName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listBankAccounts()
      setAccounts(res.accounts)
    } catch {
      setError('No se pudieron cargar tus cuentas bancarias.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      await addBankAccount({ bankName, holderName, accountNumber, isDefault: accounts.length === 0 })
      setBankName('')
      setHolderName('')
      setAccountNumber('')
      setShowForm(false)
      setMessage('Cuenta bancaria agregada correctamente.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar la cuenta bancaria.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta cuenta bancaria?')) return
    setError(null)
    try {
      await removeBankAccount(id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la cuenta.')
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Cuentas bancarias</h2>
          <p className="mt-1 text-sm text-slate-400">
            Para recibir tus pagos por proyectos completados. Solo guardamos los últimos 4 dígitos
            de forma visible; el resto se almacena cifrado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="w-full shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:w-auto"
        >
          {showForm ? 'Cancelar' : 'Agregar cuenta'}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </motion.div>
      )}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <Check size={16} className="shrink-0" />
          {message}
        </motion.div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-5 space-y-3 rounded-xl bg-white/5 p-4">
          <input
            type="text"
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Nombre del banco (ej. BBVA, Santander)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
          <input
            type="text"
            required
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="Nombre del titular de la cuenta"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
          <input
            type="text"
            required
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Número de cuenta o CLABE (10-20 dígitos)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? 'Guardando...' : 'Guardar cuenta'}
          </button>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-slate-500">Cargando cuentas...</p>}

        <AnimatePresence>
          {accounts.map((account) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <Landmark size={16} className="text-accent-400" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-white">
                    <span className="truncate">{account.bankName}</span>
                    {account.isDefault && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        <Star size={9} className="fill-amber-400" />
                        Principal
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {account.holderName} · •••• {account.accountLast4}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(account.id)}
                aria-label="Eliminar cuenta bancaria"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-10 text-center">
            <Building2 size={24} className="text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">Aún no has agregado ninguna cuenta bancaria.</p>
          </div>
        )}
      </div>
    </div>
  )
}
