import axios from 'axios'

export const httpClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    withCredentials: true,
})

httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const isSessionCheck = error.config?.url === '/api/auth/session'
        if (error.response?.status === 401 && !isSessionCheck && window.location.pathname !== '/login') {
            window.location.assign('/login')
        }
        return Promise.reject(error)
    },
)
