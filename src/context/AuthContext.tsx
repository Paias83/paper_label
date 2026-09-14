import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type ProfileSummary = { name: string | null }

type AuthContextValue = {
  user: User | null
  profile: ProfileSummary | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadProfile(nextUser: User | null) {
      setUser(nextUser)
      if (!nextUser) {
        if (active) setProfile(null)
        return
      }
      const { data } = await supabase.from('profiles').select('name').eq('id', nextUser.id).single()
      if (active) setProfile(data)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      await loadProfile(data.session?.user ?? null)
      if (active) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return <AuthContext.Provider value={{ user, profile, loading, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
