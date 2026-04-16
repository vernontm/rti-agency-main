import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Tables, UserRole } from '../types/database.types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Tables<'users'> | null
  loading: boolean
  initialized: boolean
  viewAsRole: UserRole | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
  fetchProfile: () => Promise<void>
  initialize: () => Promise<void>
  setViewAsRole: (role: UserRole | null) => void
  getEffectiveRole: () => UserRole | undefined
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,
  viewAsRole: null,

  initialize: async () => {
    // Prevent multiple initializations
    if (get().initialized) return

    let profileFetchInProgress = false

    // Set up auth state listener FIRST
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ user: session?.user ?? null, session })

      // Fetch profile if we have a session but no profile loaded yet
      // Skip if another fetch is already in progress to avoid race conditions
      if (session?.user && !get().profile && !profileFetchInProgress) {
        profileFetchInProgress = true
        try {
          await get().fetchProfile()
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Error fetching profile:', e)
        } finally {
          profileFetchInProgress = false
        }
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null })
      }
    })

    try {
      profileFetchInProgress = true
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        set({ user: session.user, session })
        await get().fetchProfile()
      }
    } catch (error: any) {
      // Ignore AbortError - happens during component unmount/remount
      if (error?.name !== 'AbortError') {
        console.error('Error initializing auth:', error)
      }
    } finally {
      profileFetchInProgress = false
      set({ initialized: true })
    }
  },

  fetchProfile: async (retries = 3) => {
    const { user } = get()
    if (!user) return

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          // PGRST116 = no rows found — user row may not exist yet (trigger timing)
          // AbortError = component unmount, safe to retry
          const isRetryable = error.message?.includes('AbortError') || error.code === '' || error.code === 'PGRST116'
          if (isRetryable && attempt < retries - 1) {
            await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
            continue
          }
          console.error('Error fetching profile:', error)
          return
        }

        if (data) {
          set({ profile: data })
          return
        }
      } catch (e: any) {
        if (e?.name === 'AbortError' && attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
          continue
        }
        console.error('fetchProfile error:', e)
        return
      }
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Set user/session immediately and fetch profile before returning
      // so ProtectedRoute has the profile ready when we navigate
      if (data.session) {
        set({ user: data.session.user, session: data.session })
        await get().fetchProfile()
      }
      // Verify profile was actually loaded — if not, auth succeeded but profile
      // fetch failed (missing user row, RLS issue, or trigger timing)
      if (!get().profile) {
        // One more retry after a short delay (trigger may still be running)
        await new Promise(r => setTimeout(r, 1000))
        await get().fetchProfile()
      }
      if (!get().profile) {
        throw new Error('Login succeeded but your profile could not be loaded. Please try again or contact an administrator.')
      }
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      set({ loading: false })
    }
  },

  signUp: async (email: string, password: string, fullName: string, role: UserRole = 'client') => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      })
      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      await supabase.auth.signOut()
      set({ user: null, session: null, profile: null })
    } finally {
      set({ loading: false })
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      set({ loading: false })
    }
  },

  updatePassword: async (newPassword: string) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      set({ loading: false })
    }
  },

  setViewAsRole: (role: UserRole | null) => {
    set({ viewAsRole: role })
  },

  getEffectiveRole: () => {
    const { profile, viewAsRole } = get()
    if (viewAsRole && profile?.role === 'admin') {
      return viewAsRole
    }
    return profile?.role
  },
}))
