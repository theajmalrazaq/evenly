import React, { useEffect, useState } from 'react'

export default function Splash({ onFinish }) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    // Start fade out slightly before finishing
    const fadeTimer = setTimeout(() => {
      setFade(true)
    }, 2200)

    const finishTimer = setTimeout(() => {
      onFinish()
    }, 2500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 bg-bg-app z-50 flex flex-col justify-center items-center transition-all duration-300 ${
        fade ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated Glowing Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-accent/30 rounded-3xl blur-xl animate-pulse"></div>
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-accent to-[#182fff99] flex items-center justify-center text-white text-4xl font-extrabold shadow-lg shadow-accent/20 animate-bounce">
            e
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black tracking-tight mt-4 grad animate-pulse">
          evenly
        </h1>
        <p className="text-sm text-text-secondary font-medium tracking-wide">
          Finance, split and settled.
        </p>

        {/* Loading Progress Bar */}
        <div className="w-40 h-1 bg-bg-card-inner rounded-full overflow-hidden mt-6">
          <div className="h-full bg-gradient-to-r from-accent to-[#7c6fd6] rounded-full animate-shine" style={{ width: '100%', backgroundSize: '200% 200%' }}></div>
        </div>
      </div>
    </div>
  )
}
