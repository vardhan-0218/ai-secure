import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor - always attach latest token from localStorage
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { accessToken } = JSON.parse(stored)
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`
      }
    }
  } catch { /* ignore parse errors */ }
  return config
})

// Response interceptor - handle 401s globally
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'success')) {
      if (body.success) {
        response.data = body.data;
        return response;
      }
      // Standard error payload -> throw so callers hit their catch blocks
      const err = new Error(body.error || 'Request failed');
      err.response = response;
      throw err;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth')
      // Dispatch event so AuthContext can react without hard redirect
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(error)
  }
)

export const analyzeContent = async (payload) => {
  const { data } = await api.post('/analyze', payload)
  return data
}

export const analyzeFile = async (file, inputType, options) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('input_type', inputType)
  formData.append('options', JSON.stringify(options))
  const { data } = await api.post('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getHistory = async (limit = 10) => {
  const { data } = await api.get(`/analyze/history?limit=${limit}`)
  return data
}

export default api
