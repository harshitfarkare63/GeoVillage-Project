import axios from 'axios'

// In production (Vercel), VITE_API_URL points to the deployed backend.
// In dev, Vite proxies /api → localhost:4000 so baseURL stays '/api'.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL })

// Attach JWT on every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gv_token')
      localStorage.removeItem('gv_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
