import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingPulseOverlay from './Loading'

export function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingPulseOverlay />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile || !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export function OnboardingGuard({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingPulseOverlay />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && profile.onboarding_completed) {
    return <Navigate to="/home" replace />
  }

  return children
}

export function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingPulseOverlay />
  }

  if (user) {
    if (profile && profile.onboarding_completed) {
      return <Navigate to="/home" replace />
    } else {
      return <Navigate to="/onboarding" replace />
    }
  }

  return children
}
