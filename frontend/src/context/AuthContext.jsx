import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('gv_user')
    const token  = localStorage.getItem('gv_token')
    if (stored && token) setUser(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('gv_token', data.data.token)
    localStorage.setItem('gv_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
    return data.data.user
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    localStorage.setItem('gv_token', data.data.token)
    localStorage.setItem('gv_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
    return data.data.user
  }

  const logout = () => {
    localStorage.removeItem('gv_token')
    localStorage.removeItem('gv_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
