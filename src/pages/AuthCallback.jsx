import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import LoadingPulseOverlay from '../components/Loading'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Supabase auto-handles URL session parsing if detectSessionInUrl is true.
      // But we can check if there's a session.
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) throw error

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profileError || !profile || !profile.onboarding_completed) {
            // No profile or onboarding not completed
            setTimeout(() => navigate('/onboarding'), 500)
          } else {
            // Profile exists and onboarding completed
            setTimeout(() => navigate('/home'), 500)
          }
        } else {
          navigate('/login')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/login')
      }
    }
    
    handleAuthCallback()
  }, [navigate])

  return <LoadingPulseOverlay />
}
