import { createContext, useContext, useState } from 'react'
import api from '../utils/api'
const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('deer_user')) } catch { return null } })
  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('deer_token', data.token)
    localStorage.setItem('deer_user', JSON.stringify(data.user))
    setUser(data.user); return data.user
  }
  const logout = () => { localStorage.removeItem('deer_token'); localStorage.removeItem('deer_user'); setUser(null) }
  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    localStorage.setItem('deer_token', data.token)
    localStorage.setItem('deer_user', JSON.stringify(data.user))
    setUser(data.user); return data
  }
  return <Ctx.Provider value={{ user, login, logout, register, isAdmin: user?.role==='company_admin', isVoditelj: user?.role==='voditelj', canEdit: ['company_admin','voditelj'].includes(user?.role) }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
