import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthProvider from './contexts/AuthContext'
import AuthCallback from './pages/AuthCallback'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Friends from './pages/Friends'
import Groups from './pages/Groups'
import Spending from './pages/Spending'
import Profile from './pages/Profile'
import Splash from './components/Splash'
import { ProtectedRoute, OnboardingGuard, AuthGuard } from './components/RouteGuard'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />
  }

  return (
    <AuthProvider>
      <Routes>
        {/* Root route - redirect to home (Route guards will route properly) */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Supabase OAuth callback route */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Login route - protected from authenticated users */}
        <Route
          path="/login"
          element={
            <AuthGuard>
              <Login />
            </AuthGuard>
          }
        />

        {/* Onboarding route - requires authenticated but incomplete profile */}
        <Route
          path="/onboarding"
          element={
            <OnboardingGuard>
              <Onboarding />
            </OnboardingGuard>
          }
        />

        {/* Main core pages - require authenticated & complete profile */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />

        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <Groups />
            </ProtectedRoute>
          }
        />

        <Route
          path="/spending"
          element={
            <ProtectedRoute>
              <Spending />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
