import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Bell, Briefcase, Landmark, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ProfileSection from '../components/settings/ProfileSection'
import SecuritySection from '../components/settings/SecuritySection'
import BankAccountsSection from '../components/settings/BankAccountsSection'
import NotificationsSection from '../components/settings/NotificationsSection'
import ActivitySection from '../components/settings/ActivitySection'
import FreelancerDetailsSection from '../components/settings/FreelancerDetailsSection'
import VolunteerDetailsSection from '../components/settings/VolunteerDetailsSection'
import PlansSection from '../components/settings/PlansSection'
import { useAuth } from '../context/AuthContext'

type Tab = 'profile' | 'plans' | 'roleDetails' | 'security' | 'bank' | 'notifications' | 'activity'

export default function SettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  const roleDetailsLabel = user?.role === 'voluntario' ? 'Voluntariado' : 'Perfil profesional'

  const TABS: { key: Tab; label: string; icon: typeof UserRound }[] = [
    { key: 'profile', label: 'Perfil', icon: UserRound },
    { key: 'plans', label: 'Planes & Gemini IA', icon: Sparkles },
    ...(user?.role !== 'reclutador'
      ? [{ key: 'roleDetails' as Tab, label: roleDetailsLabel, icon: Briefcase }]
      : []),
    { key: 'security', label: 'Seguridad', icon: ShieldCheck },
    ...(user?.role === 'freelancer'
      ? [{ key: 'bank' as Tab, label: 'Cuentas bancarias', icon: Landmark }]
      : []),
    { key: 'notifications', label: 'Notificaciones', icon: Bell },
    { key: 'activity', label: 'Actividad', icon: Activity },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Ajustes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Administra tu perfil, paquete Gemini AI, seguridad, cuentas bancarias y notificaciones.
        </p>

        <div className="candidate-scroll mt-6 flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                tab === key
                  ? 'bg-gradient-to-r from-accent-500 to-violet-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          {tab === 'profile' && <ProfileSection />}
          {tab === 'plans' && <PlansSection />}
          {tab === 'roleDetails' && user?.role === 'freelancer' && <FreelancerDetailsSection />}
          {tab === 'roleDetails' && user?.role === 'voluntario' && <VolunteerDetailsSection />}
          {tab === 'security' && <SecuritySection />}
          {tab === 'bank' && <BankAccountsSection />}
          {tab === 'notifications' && <NotificationsSection />}
          {tab === 'activity' && <ActivitySection />}
        </motion.div>
      </div>
    </DashboardLayout>
  )
}

