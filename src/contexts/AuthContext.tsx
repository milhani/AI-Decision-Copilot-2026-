import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  bootstrapAuthSession,
  markSessionReady,
  onAccessTokenChange,
  resetSessionReady,
  setAccessToken,
} from '@/lib/auth-session'
import { supabase } from '@/lib/supabase'
import {
  clearProfileCache,
  fetchUserProfile,
  readProfileCache,
  writeProfileCache,
} from '@/lib/profile-api'
import type { UserProfile } from '@/types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  applyProfile: (profile: UserProfile) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const profileUserIdRef = useRef<string | null>(null)
  const profileLoadRef = useRef<Promise<void> | null>(null)

  const applySession = useCallback((s: Session | null) => {
    setSession(s)
    setUser(s?.user ?? null)
    setAccessToken(s?.access_token ?? null)
    markSessionReady()
  }, [])

  const applyProfile = useCallback((data: UserProfile) => {
    setProfile(data)
    profileUserIdRef.current = data.id
    writeProfileCache(data.id, data)
  }, [])

  const loadProfile = useCallback(
    async (userId: string, refresh = false) => {
      if (!refresh && profileUserIdRef.current === userId) {
        return
      }

      if (profileLoadRef.current) {
        await profileLoadRef.current
        if (!refresh && profileUserIdRef.current === userId) return
      }

      const task = (async () => {
        try {
          const data = await fetchUserProfile(refresh)
          if (data) {
            applyProfile(data)
          } else {
            setProfile(null)
            profileUserIdRef.current = userId
          }
        } catch (e) {
          console.error('[AuthContext] profile', e)
        } finally {
          profileLoadRef.current = null
        }
      })()

      profileLoadRef.current = task
      await task
    },
    [applyProfile],
  )

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    profileUserIdRef.current = null
    await loadProfile(user.id, true)
  }, [loadProfile, user?.id])

  useEffect(() => {
    let mounted = true

    void (async () => {
      try {
        const bootSession = await bootstrapAuthSession()
        if (!mounted) return

        if (!bootSession?.user) {
          applySession(null)
          return
        }

        applySession(bootSession)

        const cached = readProfileCache(bootSession.user.id)
        if (cached) {
          setProfile(cached)
          profileUserIdRef.current = bootSession.user.id
        }

        await loadProfile(bootSession.user.id)
      } catch (e) {
        console.error('[AuthContext] bootstrap', e)
        if (mounted) applySession(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const unsubscribeToken = onAccessTokenChange((token) => {
      if (!token) return
      setSession((prev) => (prev ? { ...prev, access_token: token } : prev))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return

      void (async () => {
        if (!s?.user) {
          if (event === 'SIGNED_OUT') {
            applySession(null)
            setProfile(null)
            profileUserIdRef.current = null
            clearProfileCache()
          }
          return
        }

        applySession(s)

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await loadProfile(s.user.id, event === 'USER_UPDATED')
        }
      })()
    })

    return () => {
      mounted = false
      unsubscribeToken()
      subscription.unsubscribe()
    }
  }, [applySession, loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    profileUserIdRef.current = null
    clearProfileCache()
    resetSessionReady()
    setAccessToken(null)
    setSession(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      applyProfile,
    }),
    [user, session, profile, loading, refreshProfile, applyProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
