import React, { useEffect, useState } from 'react'
import { supabase } from '../config/supabase'
import { AuthContext } from '../hooks/useAuth'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      setWallet(null)
      return
    }
    try {
      // Fetch profile
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (profError) {
        console.error('Error fetching profile:', profError)
      } else {
        setProfile(profData)
      }

      // Fetch wallet
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (walletError) {
        console.error('Error fetching wallet:', walletError)
      } else {
        setWallet(walletData)
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err)
    }
  }

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      
      if (!error && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setWallet(null)
      }
      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setWallet(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { data, error }
  }

  const signInWithEmail = async (email, password) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    return { data, error }
  }

  const signUpWithEmail = async (email, password) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    setLoading(false)
    return { data, error }
  }

  const signOut = async () => {
    try {
      setUser(null)
      setProfile(null)
      setWallet(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: error.message }
    }
  }

  const value = {
    user,
    profile,
    wallet,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}