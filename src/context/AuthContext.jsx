import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    refreshProfile(session.user.id)
  }, [session?.user?.id])

  async function refreshProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: () => session?.user && refreshProfile(session.user.id),

    async signUpWithEmail(email, password, username) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { preferred_username: username } },
      })
      if (error) throw error
    },

    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },

    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    },

    async signInWithSpotify() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    },

    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}