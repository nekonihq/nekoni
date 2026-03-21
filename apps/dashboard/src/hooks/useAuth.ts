import { useEffect, useState } from 'react'
import { clearToken, getToken, setToken } from '../api'

export const useAuth = () => {
  const [token, setTokenState] = useState<string | null>(
    getToken(),
  )

  useEffect(() => {
    const handler = () => setTokenState(null)
    window.addEventListener('auth:logout', handler)
    return () =>
      window.removeEventListener('auth:logout', handler)
  }, [])

  const login = async (
    username: string,
    password: string,
  ) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('Invalid credentials')
    const data = await res.json()
    setToken(data.token)
    setTokenState(data.token)
  }

  const logout = () => {
    clearToken()
    setTokenState(null)
  }

  return { token, login, logout }
}
