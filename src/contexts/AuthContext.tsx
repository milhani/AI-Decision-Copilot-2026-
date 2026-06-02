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
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { markSessionReady, resetSessionReady, setAccessToken } from '@/lib/auth-session'
import { supabase } from '@/lib/supabase'
import { fetchUserProfile } from '@/lib/profile-api'
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

function shouldFetchProfile(event: AuthChangeEvent): boolean {
  return event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED'
}

async function ensureSessionFresh(s: Session): Promise<Session> {
  const expiresAt = s.expires_at ?? 0
  const skewMs = 60_000
  if (expiresAt * 1000 >= Date.now() + skewMs) return s

  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) return s
  return data.session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const profileUserIdRef = useRef<string | null>(null)
  const profileLoadRef = useRef<Promise<void> | null>(null)

  const loadProfile = useCallback(async (userId: string, refresh = false) => {
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
        setProfile(data)
        profileUserIdRef.current = userId
      } catch (e) {
        console.error('[AuthContext] profile', e)
      } finally {
        profileLoadRef.current = null
      }
    })()

    profileLoadRef.current = task
    await task
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    profileUserIdRef.current = null
    await loadProfile(user.id, true)
  }, [loadProfile, user?.id])

  useEffect(() => {
    let active = true

    const applySession = (s: Session | null) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAccessToken(s?.access_token ?? null)
      if (s?.access_token) markSessionReady()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return

      void (async () => {
        if (!s?.user) {
          applySession(null)
          setProfile(null)
          profileUserIdRef.current = null
          setLoading(false)
          return
        }

        const fresh =
          event === 'INITIAL_SESSION' || event === 'SIGNED_IN'
            ? await ensureSessionFresh(s)
            : s

        applySession(fresh)

        if (event === 'TOKEN_REFRESHED') {
          setLoading(false)
          return
        }

        if (shouldFetchProfile(event)) {
          await loadProfile(fresh.user.id)
        }

        if (active) setLoading(false)
      })()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

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
    resetSessionReady()
    setAccessToken(null)
  }

  const value = useMemo(
    () => ({ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }),
    [user, session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
