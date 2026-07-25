import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Briefcase,
  Building2,
  FileCheck2,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import type { GlobalSearchResult, NotificationEntry } from '../../lib/api';
import { listNotifications, markAllNotificationsRead, markNotificationRead, searchGlobal } from '../../lib/api';
import PlanUpgradeModal from './PlanUpgradeModal';
import CvViewerModal from '../common/CvViewerModal';

// Label de "Ofertas" varía según el rol: quien publica ofertas (reclutador)
// las administra, mientras que quien se postula (freelancer/voluntario)
// las busca. Es una diferencia de intención, no solo de texto.
const OFERTAS_LABEL: Record<string, string> = {
  reclutador: 'Mis ofertas',
  freelancer: 'Buscar ofertas',
  voluntario: 'Oportunidades',
};

function getNavItems(role: string | undefined, unreadMessages = 0) {
  const items = [
    { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard, badge: 0 },
    {
      to: '/dashboard/ofertas',
      label: role ? OFERTAS_LABEL[role] : 'Ofertas',
      icon: Users,
      badge: 0,
    },
    { to: '/dashboard/mensajes', label: 'Mensajes', icon: MessageSquare, badge: unreadMessages },
  ];

  if (role === 'freelancer' || role === 'voluntario') {
    items.push({
      to: '/dashboard/cv-optimizer',
      label: 'Optimizador CV IA',
      icon: FileCheck2,
      badge: 0,
    });
  }

  items.push({ to: '/dashboard/configuracion', label: 'Configuración', icon: Settings, badge: 0 });

  return items;
}

const ROLE_LABEL: Record<string, string> = {
  freelancer: 'Freelancer',
  voluntario: 'Voluntario/a',
  reclutador: 'Reclutador/a',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

const NOTIF_ICON = { new_match: Briefcase, security: ShieldAlert, system: Info } as const;

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await listNotifications();
      setEntries(res.entries);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silencioso: la campana simplemente no se actualiza si falla la red.
    }
  };

  useEffect(() => {
    load();
    // Refresca cada 30s para reflejar nuevas ofertas/alertas sin recargar la página.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleOpen = async () => {
    setOpen((v) => !v);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
    setEntries((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead(id);
    setEntries((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className='relative' ref={containerRef}>
      <button
        type='button'
        aria-label='Notificaciones'
        onClick={handleOpen}
        className='relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:bg-white/5'>
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className='absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-accent-400' />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className='absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/10 bg-ink-900 shadow-2xl'>
            <div className='flex items-center justify-between border-b border-white/5 px-4 py-3'>
              <p className='text-sm font-semibold text-white'>Notificaciones</p>
              {unreadCount > 0 && (
                <button
                  type='button'
                  onClick={handleMarkAll}
                  className='text-xs font-medium text-accent-400 hover:text-accent-300'>
                  Marcar todas leídas
                </button>
              )}
            </div>
            <div className='max-h-80 overflow-y-auto candidate-scroll'>
              {entries.length === 0 && (
                <p className='px-4 py-6 text-center text-sm text-slate-500'>
                  Sin notificaciones todavía.
                </p>
              )}
              {entries.map((n) => {
                const Icon = NOTIF_ICON[n.type] ?? Info;
                return (
                  <button
                    key={n.id}
                    type='button'
                    onClick={() => handleMarkOne(n.id)}
                    className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/5 ${
                      n.readAt ? 'opacity-60' : ''
                    }`}>
                    <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5'>
                      <Icon size={14} className='text-accent-400' />
                    </span>
                    <span className='flex-1'>
                      <span className='block text-sm font-medium text-white'>{n.title}</span>
                      <span className='mt-0.5 block text-xs text-slate-400'>{n.body}</span>
                      <span className='mt-1 block text-[11px] text-slate-500'>
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.readAt && (
                      <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400' />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlobalHeaderSearch({ onSelectUserCv }: { onSelectUserCv: (user: any) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      searchGlobal(q.trim())
        .then((res) => {
          setResults(res.results);
          setIsOpen(true);
        })
        .catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="relative hidden md:block w-72 lg:w-96">
      <div className="relative">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Buscar vacantes, servicios, personas o empresas..."
          className="w-full rounded-full border border-white/15 bg-white/5 pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500 focus:bg-slate-950 transition-all"
        />
        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
      </div>

      {isOpen && results && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full max-h-96 overflow-y-auto rounded-2xl border border-white/20 bg-slate-950 p-4 shadow-2xl space-y-4 backdrop-blur-2xl text-xs candidate-scroll">
          {/* Vacantes y Servicios */}
          {results.jobs.length > 0 && (
            <div>
              <p className="mb-2 font-bold uppercase tracking-wider text-accent-400 flex items-center gap-1.5 text-[11px]">
                <Briefcase size={13} />
                Vacantes & Servicios ({results.jobs.length})
              </p>
              <div className="space-y-1">
                {results.jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setQ('');
                      navigate('/dashboard/ofertas');
                    }}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <span className="font-semibold text-white truncate">📌 {job.title}</span>
                    <span className="shrink-0 text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-full">
                      ${job.budgetPerHour} MXN/h
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personas y Candidatos */}
          {results.people.length > 0 && (
            <div>
              <p className="mb-2 font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 text-[11px]">
                <User size={13} />
                Personas & Freelancers ({results.people.length})
              </p>
              <div className="space-y-1">
                {results.people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setQ('');
                      onSelectUserCv(person);
                    }}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-white">{person.name}</p>
                      <p className="text-[10px] text-slate-400">{person.profession || (person.role || '').toUpperCase()}</p>
                    </div>
                    <span className="text-[10px] font-bold text-accent-400 bg-accent-500/10 border border-accent-500/30 px-2.5 py-1 rounded-full">
                      Ver CV
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empresas y Reclutadores */}
          {results.companies.length > 0 && (
            <div>
              <p className="mb-2 font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5 text-[11px]">
                <Building2 size={13} />
                Empresas & Reclutadores ({results.companies.length})
              </p>
              <div className="space-y-1">
                {results.companies.map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setQ('');
                      onSelectUserCv(comp);
                    }}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-white">{comp.name}</p>
                      <p className="text-[10px] text-slate-400">{comp.email}</p>
                    </div>
                    <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2.5 py-1 rounded-full">
                      Ver Perfil
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.jobs.length === 0 && results.people.length === 0 && results.companies.length === 0 && (
            <p className="p-4 text-center text-slate-500">
              No se encontraron coincidencias para "{q}".
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedCvUser, setSelectedCvUser] = useState<any | null>(null);
  const { count: unreadMessages } = useUnreadMessages();

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatarSrc = user?.avatarUrl ? `${API_URL}${user.avatarUrl}` : null;

  return (
    <div className='flex min-h-screen w-full bg-ink-950 text-white'>
      <PlanUpgradeModal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} />

      {/* Sidebar desktop */}
      <aside className='hidden w-64 shrink-0 flex-col border-r border-white/5 bg-ink-900/50 lg:flex'>
        <SidebarContent
          currentPath={location.pathname}
          role={user?.role}
          plan={user?.plan}
          unreadMessages={unreadMessages}
          onNavigate={() => {}}
          onOpenPlanModal={() => setPlanModalOpen(true)}
        />
      </aside>

      {/* Sidebar móvil (drawer) */}
      {mobileOpen && (
        <div className='fixed inset-0 z-40 lg:hidden'>
          <div
            className='absolute inset-0 bg-black/60'
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className='relative z-50 flex h-full w-64 flex-col bg-ink-900'>
            <SidebarContent
              currentPath={location.pathname}
              role={user?.role}
              plan={user?.plan}
              unreadMessages={unreadMessages}
              onNavigate={() => setMobileOpen(false)}
              onOpenPlanModal={() => {
                setMobileOpen(false);
                setPlanModalOpen(true);
              }}
            />
          </motion.aside>
        </div>
      )}

      <div className='flex min-h-screen flex-1 flex-col'>
        {/* Topbar */}
        <header className='flex items-center justify-between border-b border-white/5 bg-ink-950/80 px-4 py-4 backdrop-blur-md sm:px-6'>
          <button
            type='button'
            className='text-slate-300 lg:hidden'
            onClick={() => setMobileOpen(true)}
            aria-label='Abrir menú'>
            <Menu size={22} />
          </button>

          <GlobalHeaderSearch onSelectUserCv={(u) => setSelectedCvUser(u)} />

          <div className='flex items-center gap-4'>
            <NotificationsBell />

            <div className='flex items-center gap-2.5'>
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt='Foto de perfil'
                  className='h-9 w-9 rounded-full border border-white/10 object-cover'
                />
              ) : (
                <span className='flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white'>
                  {initials}
                </span>
              )}
              <div className='hidden text-left sm:block'>
                <p className='text-sm font-medium leading-tight text-white'>{user?.name}</p>
                <p className='text-[11px] leading-tight text-slate-400'>
                  {user ? ROLE_LABEL[user.role] : ''}
                </p>
              </div>
            </div>

            <button
              type='button'
              onClick={logout}
              aria-label='Cerrar sesión'
              className='flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400'>
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className='flex-1 px-4 py-6 sm:px-6 lg:px-8'>{children}</main>

        {selectedCvUser && (
          <CvViewerModal
            isOpen={Boolean(selectedCvUser)}
            onClose={() => setSelectedCvUser(null)}
            userProfile={selectedCvUser}
            onUpgradeProRequest={() => {
              setSelectedCvUser(null);
              setPlanModalOpen(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Texto del panel de plan, distinto por rol.
const PLAN_COPY: Record<string, string> = {
  reclutador:
    'Mejora tu plan Gemini AI para publicar ofertas ilimitadas, agendar juntas por correo y destacar vacantes.',
  freelancer:
    'Mejora tu plan Gemini AI para optimizar tu CV, postularte automáticamente y agendar juntas.',
  voluntario: 'Mejora tu plan Gemini AI para acceder a más oportunidades y match autónomo.',
};

function SidebarContent({
  currentPath,
  role,
  plan,
  unreadMessages = 0,
  onNavigate,
  onOpenPlanModal,
}: {
  currentPath: string;
  role: string | undefined;
  plan?: string;
  unreadMessages?: number;
  onNavigate: () => void;
  onOpenPlanModal: () => void;
}) {
  const navItems = getNavItems(role, unreadMessages);
  const userPlanLabel = plan
    ? `Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
    : 'Plan Gratuito';

  return (
    <>
      <div className='flex items-center justify-between px-6 py-6'>
        <Link to='/' className='flex items-center gap-2 text-white'>
          <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-violet-500'>
            <Sparkles size={18} className='text-white' />
          </span>
          <span className='text-lg font-bold tracking-tight'>TalentFlow AI</span>
        </Link>
        <button
          type='button'
          className='text-slate-400 lg:hidden'
          onClick={onNavigate}
          aria-label='Cerrar menú'>
          <X size={20} />
        </button>
      </div>

      <nav className='flex-1 space-y-1 px-4'>
        {navItems.map((item) => {
          const active = currentPath === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gradient-to-r from-accent-500/15 to-violet-500/15 text-white border border-accent-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}>
              <item.icon size={16} />
              <span className='flex-1'>{item.label}</span>
              {item.badge > 0 && (
                <span className='flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white'>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className='m-4 rounded-2xl border border-white/10 bg-gradient-to-br from-accent-500/10 to-violet-500/10 p-4'>
        <div className='flex items-center justify-between'>
          <p className='text-xs font-semibold text-white'>{userPlanLabel}</p>
          <span className='rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-bold text-accent-400 uppercase'>
            Gemini AI
          </span>
        </div>
        <p className='mt-1 text-[11px] text-slate-400'>
          {role ? PLAN_COPY[role] : PLAN_COPY.freelancer}
        </p>
        <button
          type='button'
          onClick={onOpenPlanModal}
          className='mt-3 w-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105'>
          Mejorar plan
        </button>
      </div>
    </>
  );
}
