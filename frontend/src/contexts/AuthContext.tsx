import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import * as api from '../api'

interface AuthState {
  username: string | null
  token: string | null
  isLoggedIn: boolean
}

interface AuthActions {
  login: (username: string, password: string, captcha_id: string, captcha_code: string) => Promise<void>
  register: (params: api.RegisterParams) => Promise<void>
  sendCode: (username: string, email: string, captcha_id: string) => Promise<void>
  logout: () => Promise<void>
  destroy: (password: string) => Promise<void>
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'synapse_token'
const USERNAME_KEY = 'synapse_username'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const username = localStorage.getItem(USERNAME_KEY)
    return { username, token, isLoggedIn: !!token }
  })

  // Persist token to localStorage
  useEffect(() => {
    if (state.token && state.username) {
      localStorage.setItem(TOKEN_KEY, state.token)
      localStorage.setItem(USERNAME_KEY, state.username)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
    }
  }, [state.token, state.username])

  const sendCode = useCallback(async (username: string, email: string, captcha_id: string) => {
    await api.sendVerifyCode({ username, email, captcha_id })
  }, [])

  const login = useCallback(async (username: string, password: string, captcha_id: string, captcha_code: string) => {
    const res = await api.login({ username, password, captcha_id, captcha_code })
    setState({ username: res.username, token: res.token, isLoggedIn: true })
  }, [])

  const register = useCallback(async (params: api.RegisterParams) => {
    const res = await api.register(params)
    setState({ username: res.username, token: res.token, isLoggedIn: true })
  }, [])

  const logout = useCallback(async () => {
    if (state.token) {
      try {
        await api.logout(state.token)
      } catch {
        // Ignore — clear local state regardless
      }
    }
    setState({ username: null, token: null, isLoggedIn: false })
  }, [state.token])

  const destroy = useCallback(async (password: string) => {
    if (!state.token) throw new Error('未登录')
    await api.destroyAccount({ password }, state.token)
    setState({ username: null, token: null, isLoggedIn: false })
  }, [state.token])

  return (
    <AuthContext.Provider value={{ ...state, login, register, sendCode, logout, destroy }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
