import { Navigate } from 'react-router-dom'
import React, { useState } from 'react'
import Toast from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import LoadingPulseOverlay from '../components/Loading'
import logo from '../assets/logo.svg'
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react'

export default function Login() {
  const { signInWithEmail, signUpWithEmail, loading, user } = useAuth()
  
  const [authMode, setAuthMode] = useState('signin') // 'signin' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  if (loading) {
    return <LoadingPulseOverlay />
  }

  // Redirect to home if already logged in
  if (user) {
    return <Navigate to="/home" replace />
  }

  // Show loading overlay when submitting forms
  if (isSubmitting) {
    return <LoadingPulseOverlay />
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please fill in all required fields')
      return
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)

      if (authMode === 'signin') {
        const { error: signInError } = await signInWithEmail(email.trim(), password)
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await signUpWithEmail(email.trim(), password)
        if (signUpError) throw signUpError
        setSuccess('Account created successfully! Please proceed to set up your profile details.')
      }
    } catch (err) {
      console.error('Authentication error:', err)
      setError(err.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Toast show={!!error} message={error} type="error" onClose={() => setError(null)} duration={4000} />
      <Toast show={!!success} message={success} type="success" onClose={() => setSuccess(null)} duration={4000} />

      <div className="min-h-screen bg-bg-app text-text-primary flex flex-col justify-between items-center px-4 py-8 md:py-12 transition-colors duration-300 font-figtree">
        
        {/* Top Header branding */}
        <div className="flex flex-col items-center gap-2 mt-4 text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 user-select-none mb-1 hover:scale-105 transition duration-300" />
          <h1 className="text-2xl font-black tracking-tight text-text-primary grad">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-xs text-text-secondary">
            {authMode === 'signin' ? 'Sign in to split expenses and settle bills' : 'Get started to manage split expenses easily'}
          </p>
        </div>

        {/* Central Auth Box */}
        <div className="w-full max-w-sm bg-bg-card border border-border-primary rounded-[2.5rem] p-6 md:p-8 shadow-sm backdrop-blur-xl transition-all duration-300 my-6">
          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition duration-200"
                  required
                />
                <Mail className="absolute left-3.5 top-3.5 text-text-secondary w-4 h-4" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary pl-10 pr-10 py-3 rounded-2xl text-sm outline-none transition duration-200"
                  required
                />
                <Lock className="absolute left-3.5 top-3.5 text-text-secondary w-4 h-4" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-text-secondary hover:text-text-primary transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field (Sign Up Mode) */}
            {authMode === 'signup' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-bg-input border border-border-input focus:border-accent text-text-primary pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition duration-200"
                    required
                  />
                  <Lock className="absolute left-3.5 top-3.5 text-text-secondary w-4 h-4" />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-accent to-[#7c6fd6] hover:opacity-95 text-white py-3.5 rounded-2xl font-bold text-sm transition shadow-md shadow-accent/15 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authMode === 'signin' ? (
                  <>
                    <LogIn className="w-4 h-4" /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Create Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Toggle Mode Link */}
        <div className="mb-4 text-center">
          {authMode === 'signin' ? (
            <p className="text-xs text-text-secondary">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup')
                  setError(null)
                  setSuccess(null)
                }}
                className="text-accent font-bold hover:underline cursor-pointer bg-transparent border-0"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs text-text-secondary">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin')
                  setError(null)
                  setSuccess(null)
                }}
                className="text-accent font-bold hover:underline cursor-pointer bg-transparent border-0"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

      </div>
    </>
  )
}
