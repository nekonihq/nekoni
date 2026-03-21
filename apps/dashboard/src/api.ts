const TOKEN_KEY = 'nekoni_token'

export const getToken = () =>
  localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) =>
  localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event('auth:logout'))
}

export const apiFetch = async (
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  const token = getToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
  })
  if (res.status === 401 || res.status === 403) clearToken()
  return res
}
