import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from '../lib/api'
import type { AccountRole, LoginResponse, PublicUser } from '../lib/api'

const TOKEN_KEY = 'talentflow_token'

interface AuthContextValue {
  user: PublicUser | null
  token: string | null
  isLoading: boolean
  signup: (input: { name: string; email: string; password: string; role: AccountRole }) => Promise<{ emailSent: boolean; emailPreviewUrl?: string }>
  login: (input: { email: string; password: string }) => Promise<LoginResponse>
  loginWithToken: (jwt: string, user: PublicUser) => void
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<PublicUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    api
      .fetchMe(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const signup: AuthContextValue['signup'] = useCallback(async (input) => {
    // No autentica: la cuenta queda inactiva hasta hacer clic en el enlace
    // de verificación que llega por correo.
    const res = await api.signup(input)
    return { emailSent: res.emailSent, emailPreviewUrl: res.emailPreviewUrl }
  }, [])

  const login: AuthContextValue['login'] = useCallback(async (input) => {
    const res = await api.login(input)
    // Si la cuenta tiene 2FA activado, el backend NO entrega token todavía:
    // solo un pendingToken de corta duración. El llamador (LoginPage) debe
    // pedir el código de la app de autenticación y llamar a loginWithToken.
    if (res.requiresTwoFactor) {
      return res
    }
    if (res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token)
      setToken(res.token)
      setUser(res.user)
    }
    return res
  }, [])

  const loginWithToken: AuthContextValue['loginWithToken'] = useCallback((jwt, verifiedUser) => {
    localStorage.setItem(TOKEN_KEY, jwt)
    setToken(jwt)
    setUser(verifiedUser)
  }, [])

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (!currentToken) return
    const { user } = await api.fetchMe(currentToken)
    setUser(user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, signup, login, loginWithToken, refreshUser, logout }),
    [user, token, isLoading, signup, login, loginWithToken, refreshUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
