import { create } from 'zustand'
import { httpClient } from '../lib/httpClient'

export type AuthUser = {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
}

interface AuthState {
    status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
    user: AuthUser | null
    fetchSession: () => Promise<void>
    logout: () => Promise<void>
}

export const useAuth = create<AuthState>()((set) => ({
    status: 'idle',
    user: null,
    fetchSession: async () => {
        set({ status: 'loading' })
        try {
            const { data } = await httpClient.get('/api/auth/session')
            if (data?.user) {
                set({ user: data.user, status: 'authenticated' })
            } else {
                set({ user: null, status: 'unauthenticated' })
            }
        } catch (error) {
            console.error('Error fetching session:', error)
            set({ user: null, status: 'unauthenticated' })
        }
    },
    logout: async () => {
        const { data } = await httpClient.get('/api/auth/csrf')

        const form = document.createElement('form')
        form.method = 'POST'
        form.action = `${httpClient.defaults.baseURL}/api/auth/signout`

        const fields: Record<string, string> = {
            csrfToken: data.csrfToken,
            callbackUrl: `${window.location.origin}/login`,
        }
        for (const [name, value] of Object.entries(fields)) {
            const input = document.createElement('input')
            input.type = 'hidden'
            input.name = name
            input.value = value
            form.appendChild(input)
        }

        document.body.appendChild(form)
        form.submit()
    },
}))
