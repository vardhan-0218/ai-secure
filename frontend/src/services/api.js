import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor - handle 401s globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth')
      window.location.href = '/login'
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
